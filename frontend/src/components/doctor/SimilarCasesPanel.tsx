import React, { useCallback, useEffect, useState } from 'react';
import { Database, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { BASE_URL, apiFetch } from '../../services/api';

/** Seed NAMASTE codes (AYU-…) are placeholders until the official export is imported: not shown as codes. */
const PLACEHOLDER_CODE = /^AYU-[A-Z]+-\d+\s*/i;

/**
 * De-identified similar cases for the selected session, retrieved through the encrypted
 * retrieval layer (/api/retrieval). The footer shows exactly how the query was executed:
 * the mode the arbiter chose, which guards fired, and how the query was protected.
 * Self-contained: no api.ts methods, no shared types.
 */

interface SimilarCase {
  caseId: string; source: 'encounter' | 'session' | 'reference'; department: string; careStream: string;
  ageBand: string; sex: string; symptoms: string[]; diagnoses: string[]; medicines: string[]; investigations: string[]; month: string; similarity: number;
}
interface Decision {
  mode: 'HE' | 'ISOLATED'; candidateMode: 'HE' | 'ISOLATED'; predictedHeMs: number | null; thresholdMs: number; predictorReleased: boolean; tier: 1 | 2;
  guards: { tierOverride: boolean; enclaveRatio: boolean; secureMemory: boolean; availabilityFallback: boolean }; windowEnclaveShare: number;
}
interface Payload {
  results: SimilarCase[]; decision: Decision;
  stages: { corpusSize: number; coarseCandidates: number; coarseMs: number; rerankMs: number; ciphertexts: number; refreshes: number; smudgingSigma: number | null; totalMs: number };
  privacy: { queryProtection: string; isolation: string; resultsDeidentified: true };
}

const sourceLabel: Record<SimilarCase['source'], string> = { encounter: 'this facility', session: 'this facility (intake only)', reference: 'reference case (synthetic)' };

export const SimilarCasesPanel: React.FC<{ sessionId: string | null }> = ({ sessionId }) => {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true); setError(null);
    try {
      const res = await apiFetch(`${BASE_URL}/api/retrieval/similar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, topN: 6 }) });
      const json = await res.json();
      // Nothing indexed yet (a new hospital in Real mode has no signed cases): an empty list, not an error.
      if (res.status === 503) { setData({ results: [] } as unknown as Payload); return; }
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json.data as Payload);
    } catch (e: any) {
      setError(e?.message || 'Could not retrieve similar cases');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { setShowAll(false); }, [sessionId]);

  useEffect(() => {
    // Defer so the fetch (and its state updates) starts after the render that changed the session.
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!sessionId) return null;
  const d = data?.decision;
  const firedGuards = d ? Object.entries(d.guards).filter(([, v]) => v).map(([k]) => ({ tierOverride: 'tier override', enclaveRatio: 'enclave-ratio guard', secureMemory: 'secure-memory guard', availabilityFallback: 'availability fallback' }[k as keyof Decision['guards']])) : [];

  return (
    <section className="no-print rounded-2xl border border-border bg-card p-4" aria-label="Similar past cases">
      <header className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-foreground/70" />
          <h3 className="text-sm font-bold">Similar past cases <span className="text-xs font-normal text-muted-foreground">(de-identified)</span></h3>
        </div>
        <button type="button" onClick={load} disabled={loading} title="Search again" aria-label={loading ? 'Searching' : 'Refresh similar cases'} className="h-7 w-7 rounded-lg border border-border bg-background hover:bg-muted inline-flex items-center justify-center text-muted-foreground disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && data && data.results.length === 0 && <p className="text-xs text-muted-foreground">No comparable past case at this hospital yet. Cases appear here as doctors sign visits.</p>}
      {data && data.results.length > 0 && data.results.every(c => c.source === 'reference') && (
        <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-400">Sample data: these are synthetic reference cases, not patients of this hospital.</p>
      )}

      {data && data.results.length > 0 && (
        <ol className="space-y-2">
          {(showAll ? data.results : data.results.slice(0, 3)).map(c => (
            <li key={c.caseId} className="rounded-xl border border-border/70 bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{c.diagnoses.length ? c.diagnoses.map(d => d.replace(PLACEHOLDER_CODE, '')).join('; ') : 'No diagnosis recorded'}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.symptoms.join(', ') || 'No symptoms recorded'}</div>
                </div>
                <span className="shrink-0 text-[11px] font-mono font-bold tabular-nums" title="cosine similarity">{Math.round(Math.max(0, c.similarity) * 100)}%</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>{c.department || 'Department not recorded'}</span>
                <span>{c.ageBand} · {c.sex.toLowerCase()}</span>
                {c.medicines.length > 0 && <span>Rx: {c.medicines.slice(0, 3).join(', ')}</span>}
                {c.investigations.length > 0 && <span>Inv: {c.investigations.slice(0, 2).join(', ')}</span>}
                <span className={c.source === 'reference' ? 'text-amber-700 dark:text-amber-400' : ''}>{sourceLabel[c.source]} · {c.month}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      {data && data.results.length > 3 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="mt-1 min-h-8 px-1 text-[11px] font-semibold text-primary hover:underline">
          {showAll ? 'Show fewer' : `Show ${data.results.length - 3} more`}
        </button>
      )}

      {data && d && (
        <footer className="mt-3 pt-2 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5">
          <div className="flex items-center gap-1.5">
            {d.mode === 'HE' ? <Lock size={11} /> : <ShieldCheck size={11} />}
            <span>
              Executed in <strong>{d.mode === 'HE' ? 'homomorphic mode' : 'isolated mode'}</strong>
              {d.mode === 'HE' ? ` (${data.stages.ciphertexts} CKKS ciphertext${data.stages.ciphertexts === 1 ? '' : 's'}${data.stages.refreshes ? `, ${data.stages.refreshes} refresh` : ''})` : ' (software-isolated worker, smudged scores)'}
              {' · '}{data.stages.coarseCandidates} candidates from {data.stages.corpusSize} cases · {data.stages.totalMs} ms
              {firedGuards.length ? ` · guards: ${firedGuards.join(', ')}` : ' · no guard intervened'}
            </span>
          </div>
          <details>
            <summary className="cursor-pointer select-none w-fit">How this search was run</summary>
            <div className="mt-0.5 space-y-0.5">
              <div>
                {d.predictorReleased && d.predictedHeMs != null ? `Predicted homomorphic latency ${Math.round(d.predictedHeMs)} ms against a ${d.thresholdMs} ms threshold` : 'Latency model not yet released; default mode used'}
                {` · isolated share of last window ${Math.round(d.windowEnclaveShare * 100)}%`}
              </div>
              <div>{data.privacy.queryProtection}.</div>
            </div>
          </details>
        </footer>
      )}
    </section>
  );
};
