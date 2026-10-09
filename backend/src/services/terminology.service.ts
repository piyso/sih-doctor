/**
 * Clinical terminology search (NAMASTE / ICD-11 TM2 / AFI formulations / modern molecules) on an
 * SQLite FTS5 trigram index.
 *
 * Seeded at start-up from shared/ayush_ontology.json so the search works out of the box, and
 * extended with the official NAMASTE export via `npm run import:namaste -- <file.csv>` (see
 * scripts/import-namaste.ts). Results are ranked, never a single guess, so the clinician confirms
 * a code rather than inheriting a keyword match.
 */

import { db } from '../db/database';
import ayushOntology from '../shared/ayush_ontology.json';

export type TerminologySystem = 'NAMASTE' | 'ICD-11-TM2' | 'AFI' | 'MOLECULE';

export interface TerminologyEntry {
  system: TerminologySystem;
  code: string;
  term: string;
  synonyms: string[];
  mapping: Record<string, string | undefined>; // e.g. { icd10, icd11, snomed, english, sanskrit }
}

export interface TerminologyHit extends TerminologyEntry {
  score: number;
  matchedOn: 'code' | 'term' | 'synonym' | 'fuzzy';
}

const SEED_VERSION = 'ontology-seed-v3'; // v3: SNOMED codes corrected after a tx.fhir.org check (2026-10-09)

db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS terminology USING fts5(
    system UNINDEXED, code, term, synonyms, mapping_json UNINDEXED, tokenize='trigram'
  );
  CREATE TABLE IF NOT EXISTS terminology_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'Vataja Jwara': ['fever', 'bukhar', 'pyrexia', 'tap', 'बुखार', 'ज्वर'],
  'Kaphaja Kasa': ['cough', 'khansi', 'bronchitis', 'खांसी'],
  'Tamaka Shwasa': ['asthma', 'dama', 'shwas', 'wheeze', 'दमा', 'सांस फूलना'],
  'Amlapitta': ['acidity', 'gerd', 'heartburn', 'dyspepsia', 'एसिडिटी', 'खट्टी डकार'],
  'Sandhivata': ['osteoarthritis', 'joint pain', 'knee pain', 'ghutne', 'crepitus', 'घुटने में दर्द'],
  'Amavata': ['rheumatoid', 'gathiya', 'polyarthritis', 'गठिया'],
  'Kaphaja Prameha': ['diabetes', 'sugar', 'prameha', 'madhumeha', 'शुगर', 'मधुमेह'],
  'Mutrakrichhra': ['uti', 'urinary', 'dysuria', 'peshab me jalan', 'पेशाब में जलन'],
  'Grahani Roga': ['ibs', 'loose motions', 'grahani', 'dast', 'दस्त'],
  'Gridhrasi': ['sciatica', 'lumbar', 'radiculopathy', 'kamar dard', 'back pain', 'कमर दर्द'],
  'Hridshula': ['angina', 'ischemic chest pain'],
  'Hridroga': ['cardiac', 'chest pain', 'heart', 'chhati', 'सीने में दर्द'],
  'Arsha': ['piles', 'bawaseer', 'hemorrhoids', 'bawasir', 'बवासीर'],
  'Bhagandara': ['fistula', 'bhagandar'],
  'Pakshaghata': ['paralysis', 'stroke', 'lakwa', 'लकवा'],
  'Apasmara': ['epilepsy', 'seizure', 'mirgi', 'daura', 'मिर्गी'],
  'Vrikkashotha': ['nephritis', 'kidney swelling', 'glomerulonephritis'],
  'Kushtha': ['eczema', 'skin', 'khujli', 'dermatitis', 'खुजली']
};

function seed(): void {
  const current = (db.prepare("SELECT value FROM terminology_meta WHERE key = 'seed_version'").get() as any)?.value;
  if (current === SEED_VERSION) return;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM terminology WHERE system IN ('NAMASTE', 'AFI')").run();
    const ins = db.prepare('INSERT INTO terminology (system, code, term, synonyms, mapping_json) VALUES (?, ?, ?, ?, ?)');
    for (const e of ayushOntology.namasteEntries) {
      const syn = Array.from(new Set([e.englishEquivalent, ...(Object.entries(KEYWORD_SYNONYMS).find(([k]) => e.sanskritTerm.includes(k))?.[1] || [])]));
      ins.run('NAMASTE', e.aCode, e.sanskritTerm, syn.join(' | '), JSON.stringify({ english: e.englishEquivalent, icd10: e.icd10DualCode, snomed: e.snomedConceptId, icmr: e.icmrStandardWorkflowId, system: e.system }));
      for (const f of e.classicalFormulations) {
        ins.run('AFI', f.toLowerCase().replace(/[^a-z0-9]+/g, '-'), f, `${e.sanskritTerm} | ${e.englishEquivalent}`, JSON.stringify({ indication: e.sanskritTerm, anupana: e.recommendedAnupana }));
      }
    }
    for (const f of ayushOntology.classicalFormulations) {
      ins.run('AFI', f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), f.name, (f.indications || []).join(' | '), JSON.stringify({ category: f.category, dosage: f.standardDosage, frequency: f.standardFrequency, anupana: f.statutoryAnupana }));
    }
    db.prepare("INSERT INTO terminology_meta (key, value) VALUES ('seed_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(SEED_VERSION);
  });
  tx();
}
seed();

const toEntry = (r: any): TerminologyEntry => ({ system: r.system, code: r.code, term: r.term, synonyms: String(r.synonyms || '').split(' | ').filter(Boolean), mapping: JSON.parse(r.mapping_json || '{}') });
const ftsEscape = (q: string) => `"${q.replace(/"/g, '""')}"`;

export const TerminologyService = {
  count(system?: TerminologySystem): number {
    const row = (system ? db.prepare('SELECT COUNT(*) AS n FROM terminology WHERE system = ?').get(system) : db.prepare('SELECT COUNT(*) AS n FROM terminology').get()) as { n: number } | undefined;
    return row?.n || 0;
  },

  /** Ranked search. Exact code or term first, then whole-word synonym hits, then trigram fuzzy matches. */
  search(query: string, opts: { system?: TerminologySystem; limit?: number } = {}): TerminologyHit[] {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const limit = Math.max(1, Math.min(50, opts.limit || 10));
    const sysClause = opts.system ? ' AND system = ?' : '';
    const sysArgs = opts.system ? [opts.system] : [];
    const out = new Map<string, TerminologyHit>();
    const put = (r: any, score: number, matchedOn: TerminologyHit['matchedOn']) => {
      const key = `${r.system}:${r.code}`;
      const prev = out.get(key);
      if (!prev || prev.score < score) out.set(key, { ...toEntry(r), score, matchedOn });
    };
    for (const r of db.prepare(`SELECT * FROM terminology WHERE (LOWER(code) = ? OR LOWER(term) = ?)${sysClause}`).all(q, q, ...sysArgs) as any[]) put(r, 1.0, LOWER(r.code) === q ? 'code' : 'term');
    for (const r of db.prepare(`SELECT * FROM terminology WHERE LOWER(term) LIKE ?${sysClause} LIMIT 25`).all(`${q}%`, ...sysArgs) as any[]) put(r, 0.9, 'term');
    for (const r of db.prepare(`SELECT * FROM terminology WHERE (' ' || LOWER(synonyms) || ' ') LIKE ?${sysClause} LIMIT 25`).all(`% ${q} %`, ...sysArgs) as any[]) put(r, 0.8, 'synonym');
    for (const r of db.prepare(`SELECT * FROM terminology WHERE (' ' || LOWER(synonyms) || ' |') LIKE ?${sysClause} LIMIT 25`).all(`%| ${q} |%`, ...sysArgs) as any[]) put(r, 0.8, 'synonym');
    if (q.length >= 3) {
      try {
        for (const r of db.prepare(`SELECT *, bm25(terminology) AS rank FROM terminology WHERE terminology MATCH ?${sysClause} ORDER BY rank LIMIT 25`).all(ftsEscape(q), ...sysArgs) as any[]) {
          const rank = Math.abs(Number(r.rank) || 0);
          put(r, Math.max(0.3, Math.min(0.75, 0.75 - rank / 100)), 'fuzzy');
        }
      } catch { /* FTS syntax edge cases: fall through with what we have */ }
    }
    return Array.from(out.values()).sort((a, b) => b.score - a.score || a.term.localeCompare(b.term)).slice(0, limit);
  },

  /** Upsert rows (import script). Rows with the same system+code replace the old row. */
  upsert(entries: TerminologyEntry[]): number {
    const del = db.prepare('DELETE FROM terminology WHERE system = ? AND code = ?');
    const ins = db.prepare('INSERT INTO terminology (system, code, term, synonyms, mapping_json) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((rows: TerminologyEntry[]) => {
      let n = 0;
      for (const e of rows) {
        if (!e.code || !e.term) continue;
        del.run(e.system, e.code);
        ins.run(e.system, e.code, e.term, (e.synonyms || []).join(' | '), JSON.stringify(e.mapping || {}));
        n++;
      }
      return n;
    });
    return tx(entries);
  },

  stats(): Record<string, number> {
    const rows = db.prepare('SELECT system, COUNT(*) AS n FROM terminology GROUP BY system').all() as Array<{ system: string; n: number }>;
    return Object.fromEntries(rows.map(r => [r.system, r.n]));
  }
};

function LOWER(s: unknown): string { return String(s || '').toLowerCase(); }
