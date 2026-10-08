import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudUpload, Plus, WifiOff, Wifi, AlertTriangle, CheckCircle2, Sun, Loader2, X, Baby, Search } from 'lucide-react';
import { api } from '../../services/api';
import { AshaFieldRecord, AshaRiskFlag } from '../../types/api';
import { useStaffUser } from '../../components/auth/StaffGate';
import { sovereignSound } from '../../utils/audio';

/**
 * ASHA / ANM field app — works without network.
 *
 * Visits are saved on the device first (outbox) and uploaded when the network is back. Only records
 * the server confirms are marked "synced". Nothing is pre-filled: a blank Hb or BP stays blank and
 * is flagged as "not measured", never assumed normal.
 */

type Lang = 'hi' | 'en';
const T: Record<string, [string, string]> = {
  title: ['आशा फ़ील्ड ऐप', 'ASHA field app'],
  online: ['ऑनलाइन', 'Online'],
  offline: ['ऑफ़लाइन — विज़िट फ़ोन में सुरक्षित हैं', 'Offline — visits are kept on this phone'],
  pending: ['{n} विज़िट भेजनी बाकी', '{n} visits waiting to upload'],
  allSynced: ['सभी विज़िट अस्पताल को भेज दी गईं', 'All visits uploaded'],
  syncNow: ['अभी भेजें', 'Upload now'],
  newVisit: ['नई विज़िट', 'New visit'],
  sunlight: ['धूप मोड', 'Sunlight mode'],
  search: ['नाम या गाँव खोजें', 'Search name or village'],
  urgent: ['तुरंत रेफ़र करें', 'Refer now'],
  refer: ['रेफ़र करें', 'Refer'],
  watch: ['ध्यान दें', 'Watch'],
  noVisits: ['अभी कोई विज़िट नहीं', 'No visits yet'],
  name: ['नाम', 'Name'],
  age: ['उम्र (साल)', 'Age (years)'],
  village: ['गाँव / मोहल्ला', 'Village / area'],
  household: ['घर / परिवार नंबर', 'Household no.'],
  pregnant: ['गर्भवती है?', 'Pregnant?'],
  weeks: ['गर्भ के सप्ताह', 'Weeks of pregnancy'],
  hb: ['हीमोग्लोबिन (g/dL)', 'Haemoglobin (g/dL)'],
  bp: ['बीपी (जैसे 120/80)', 'BP (e.g. 120/80)'],
  weight: ['वज़न (kg)', 'Weight (kg)'],
  danger: ['ख़तरे के लक्षण (जो हैं उन पर टिक करें)', 'Danger signs (tick any present)'],
  remedy: ['घरेलू उपाय जो ले रही हैं', 'Home remedies being taken'],
  notes: ['टिप्पणी', 'Notes'],
  referral: ['रेफ़रल', 'Referral'],
  save: ['विज़िट सहेजें', 'Save visit'],
  cancel: ['रद्द करें', 'Cancel'],
  notMeasured: ['खाली छोड़ें अगर मापा नहीं', 'Leave blank if not measured'],
  synced: ['भेजा गया', 'Uploaded'],
  notSynced: ['फ़ोन में', 'On phone'],
  yes: ['हाँ', 'Yes'],
  no: ['नहीं', 'No'],
  needName: ['नाम ज़रूरी है', 'Name is required'],
  badBp: ['बीपी ऐसे लिखें: 120/80', 'Write BP like 120/80'],
  badHb: ['Hb 2 से 20 के बीच होना चाहिए', 'Hb must be between 2 and 20'],
  syncFailed: ['भेजना नहीं हो पाया — नेटवर्क मिलने पर फिर कोशिश होगी', 'Upload failed — will retry when network is available'],
  call108: ['ख़तरे के लक्षण: 108 / 102 पर कॉल करें और नज़दीकी अस्पताल ले जाएँ', 'Danger sign: call 108 / 102 and take her to the nearest facility']
};
const tr = (lang: Lang, k: string, vars: Record<string, string | number> = {}) =>
  (T[k]?.[lang === 'hi' ? 0 : 1] || k).replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ''));

const DANGER: Array<{ id: string; hi: string; en: string }> = [
  { id: 'bleeding', hi: 'खून आना', en: 'Bleeding' },
  { id: 'severe_headache_blurred_vision', hi: 'तेज़ सिरदर्द / धुंधला दिखना', en: 'Severe headache / blurred vision' },
  { id: 'convulsions', hi: 'दौरे / झटके', en: 'Fits / convulsions' },
  { id: 'high_fever', hi: 'तेज़ बुखार', en: 'High fever' },
  { id: 'reduced_fetal_movement', hi: 'बच्चे का कम हिलना', en: 'Baby moving less' },
  { id: 'swelling_face_hands', hi: 'चेहरे / हाथ पर सूजन', en: 'Swelling of face or hands' },
  { id: 'breathlessness', hi: 'साँस फूलना', en: 'Breathlessness' },
  { id: 'severe_abdominal_pain', hi: 'पेट में तेज़ दर्द', en: 'Severe abdominal pain' },
  { id: 'leaking_fluid', hi: 'पानी जाना', en: 'Leaking water' }
];

/** Same thresholds as the server (backend/src/routes/asha.routes.ts) so flags show offline too. */
function assessRisk(r: Pick<AshaFieldRecord, 'isPregnant' | 'age' | 'hemoglobinGdl' | 'bloodPressure' | 'dangerSigns'>): AshaRiskFlag[] {
  const flags: AshaRiskFlag[] = [];
  for (const d of r.dangerSigns) {
    const label = DANGER.find(x => x.id === d)?.en;
    if (label) flags.push({ level: 'URGENT', code: `danger_${d}`, text: `Danger sign: ${label} — take to the nearest FRU/PHC now (call 108/102)` });
  }
  const m = (r.bloodPressure || '').match(/^(\d{2,3})\/(\d{2,3})$/);
  if (m) {
    const sys = +m[1], dia = +m[2];
    if (sys >= 160 || dia >= 110) flags.push({ level: 'URGENT', code: 'bp_severe', text: `Very high BP ${sys}/${dia} — urgent referral` });
    else if (sys >= 140 || dia >= 90) flags.push({ level: 'REFER', code: 'bp_high', text: r.isPregnant ? `High BP in pregnancy ${sys}/${dia} — refer to PHC/FRU` : `High BP ${sys}/${dia} — refer to PHC for NCD check` });
  }
  const hb = r.hemoglobinGdl;
  if (hb !== null && hb !== undefined) {
    if (hb < 7) flags.push({ level: 'URGENT', code: 'hb_severe', text: `Severe anaemia (Hb ${hb}) — refer to FRU today` });
    else if (r.isPregnant && hb < 11) flags.push({ level: 'REFER', code: 'hb_low_preg', text: `Anaemia in pregnancy (Hb ${hb}, below 11) — IFA and MO review` });
    else if (!r.isPregnant && hb < 10) flags.push({ level: 'WATCH', code: 'hb_low', text: `Low Hb (${hb}) — IFA and recheck` });
  }
  if (r.isPregnant && r.age !== null && (r.age < 18 || r.age > 35)) flags.push({ level: 'WATCH', code: 'age_risk', text: `Age ${r.age}: higher-risk pregnancy — ensure 4+ ANC visits and institutional delivery` });
  if (r.isPregnant && (hb === null || hb === undefined)) flags.push({ level: 'WATCH', code: 'hb_missing', text: 'Hb not measured — check at next visit' });
  if (r.isPregnant && !m) flags.push({ level: 'WATCH', code: 'bp_missing', text: 'BP not measured — check at next visit' });
  return flags;
}

/** Works on plain-http LAN pages too (crypto.randomUUID needs a secure context). */
const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return `v-${Array.from(b, x => x.toString(16).padStart(2, '0')).join('')}`;
};

const storeKey = (userId: string) => `asha_visits_${userId}`;
const loadLocal = (userId: string): AshaFieldRecord[] => {
  try { return JSON.parse(localStorage.getItem(storeKey(userId)) || '[]'); } catch { return []; }
};
const saveLocal = (userId: string, rows: AshaFieldRecord[]) => {
  try { localStorage.setItem(storeKey(userId), JSON.stringify(rows)); } catch {}
};

const levelCls: Record<AshaRiskFlag['level'], string> = {
  URGENT: 'bg-rose-600 text-white',
  REFER: 'bg-amber-500 text-white',
  WATCH: 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
};

export const AshaFieldView: React.FC = () => {
  const user = useStaffUser();
  const uid = user?.id || 'anonymous';
  const [lang, setLang] = useState<Lang>('hi');
  const [records, setRecords] = useState<AshaFieldRecord[]>(() => loadLocal(uid));
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [sunlight, setSunlight] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => { saveLocal(uid, records); }, [uid, records]);

  const sync = useCallback(async () => {
    const pending = loadLocal(uid).filter(r => !r.synced);
    setSyncing(true);
    setSyncMsg(null);
    try {
      if (pending.length) {
        const results = await api.syncAshaRecords(pending);
        setRecords(prev => prev.map(r => {
          const res = results.find(x => x.id === r.id);
          if (!res) return r;
          if (res.status === 'accepted') return { ...r, synced: true, syncError: undefined, riskFlags: res.riskFlags || r.riskFlags };
          if (res.status === 'conflict' && res.server) return { ...res.server, synced: true };
          return { ...r, syncError: res.reason || 'Rejected by server' };
        }));
      }
      // Merge newer copies from the server (e.g. visits entered on another device).
      const server = await api.getAshaRecords();
      setRecords(prev => {
        const byId = new Map(prev.map(r => [r.id, r]));
        for (const s of server) {
          const local = byId.get(s.id);
          if (!local || (local.synced && (s.version > local.version || s.clientUpdatedAt > local.clientUpdatedAt))) byId.set(s.id, { ...s, synced: true });
        }
        return [...byId.values()].sort((a, b) => b.visitAt.localeCompare(a.visitAt));
      });
      setOnline(true);
      if (pending.length) sovereignSound('chime');
    } catch {
      setSyncMsg(tr(lang, 'syncFailed'));
      setOnline(false);
    } finally {
      setSyncing(false);
    }
  }, [uid, lang]);

  // Sync on open, when the network returns, and every 2 minutes.
  useEffect(() => {
    sync();
    const up = () => { setOnline(true); sync(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const t = setInterval(() => { if (navigator.onLine) sync(); }, 120000);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); clearInterval(t); };
  }, [sync]);

  const pendingCount = records.filter(r => !r.synced).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (r: AshaFieldRecord) => (r.riskFlags.some(f => f.level === 'URGENT') ? 0 : r.riskFlags.some(f => f.level === 'REFER') ? 1 : 2);
    return records
      .filter(r => !q || r.patientName.toLowerCase().includes(q) || r.village.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || b.visitAt.localeCompare(a.visitAt));
  }, [records, query]);

  const addVisit = (r: AshaFieldRecord) => {
    setRecords(prev => [r, ...prev]);
    setShowForm(false);
    sovereignSound('shutter');
    if (navigator.onLine) setTimeout(sync, 300);
  };

  return (
    <div className="max-w-3xl mx-auto px-3 py-4 space-y-3" style={{ filter: sunlight ? 'contrast(1.25) saturate(1.1)' : undefined }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-extrabold text-foreground">{tr(lang, 'title')}</h1>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setLang(l => (l === 'hi' ? 'en' : 'hi'))} className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-bold">{lang === 'hi' ? 'English' : 'हिन्दी'}</button>
          <button type="button" onClick={() => setSunlight(s => !s)} aria-pressed={sunlight} className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-bold inline-flex items-center gap-1"><Sun size={14} /> {tr(lang, 'sunlight')}</button>
        </div>
      </div>

      <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 flex-wrap ${online ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/50 bg-amber-500/10'}`}>
        <div className="text-sm font-semibold flex items-center gap-2">
          {online ? <Wifi size={16} className="text-emerald-600" /> : <WifiOff size={16} className="text-amber-600" />}
          <span>{online ? tr(lang, 'online') : tr(lang, 'offline')}</span>
          <span className="text-muted-foreground">· {pendingCount ? tr(lang, 'pending', { n: pendingCount }) : tr(lang, 'allSynced')}</span>
        </div>
        <button type="button" onClick={sync} disabled={syncing} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-60">
          {syncing ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />} {tr(lang, 'syncNow')}
        </button>
        {syncMsg && <div className="w-full text-xs font-semibold text-amber-800 dark:text-amber-200">{syncMsg}</div>}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr(lang, 'search')} className="w-full h-12 pl-9 pr-3 rounded-xl border border-border bg-card text-base" />
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="h-12 px-4 rounded-xl bg-emerald-600 text-white text-base font-bold inline-flex items-center gap-1.5"><Plus size={18} /> {tr(lang, 'newVisit')}</button>
      </div>

      {shown.length === 0 ? <div className="py-12 text-center text-muted-foreground">{tr(lang, 'noVisits')}</div> : shown.map(r => {
        const urgent = r.riskFlags.some(f => f.level === 'URGENT');
        return (
          <div key={r.id} className={`p-3.5 rounded-2xl border bg-card ${urgent ? 'border-rose-500 border-2' : 'border-border/80'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                  {r.isPregnant && <Baby size={16} className="text-pink-600 shrink-0" />}
                  <span className="truncate">{r.patientName}</span>
                  <span className="text-sm font-medium text-muted-foreground">{r.age !== null ? `· ${r.age}` : ''}</span>
                </div>
                <div className="text-xs text-muted-foreground">{r.village}{r.household ? ` · ${r.household}` : ''} · {new Date(r.visitAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 ${r.synced ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : r.syncError ? 'bg-rose-500/15 text-rose-700' : 'bg-muted text-muted-foreground'}`} title={r.syncError}>
                {r.synced ? <CheckCircle2 size={11} /> : <CloudUpload size={11} />} {r.synced ? tr(lang, 'synced') : tr(lang, 'notSynced')}
              </span>
            </div>
            <div className="text-sm mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
              {r.isPregnant && r.gestationalWeeks ? <span>{tr(lang, 'weeks')}: <strong>{r.gestationalWeeks}</strong></span> : null}
              <span>Hb: <strong>{r.hemoglobinGdl ?? '—'}</strong></span>
              <span>BP: <strong>{r.bloodPressure || '—'}</strong></span>
            </div>
            {r.riskFlags.length > 0 && (
              <div className="mt-2 space-y-1">
                {r.riskFlags.map(f => (
                  <div key={f.code} className={`text-xs font-bold rounded-lg px-2 py-1 flex items-start gap-1.5 ${levelCls[f.level]}`}>
                    <AlertTriangle size={13} className="shrink-0 mt-px" />
                    <span>{f.level === 'URGENT' ? tr(lang, 'urgent') : f.level === 'REFER' ? tr(lang, 'refer') : tr(lang, 'watch')}: {f.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showForm && <VisitForm lang={lang} onCancel={() => setShowForm(false)} onSave={addVisit} lastVillage={records[0]?.village || ''} />}
    </div>
  );
};

const VisitForm: React.FC<{ lang: Lang; lastVillage: string; onCancel: () => void; onSave: (r: AshaFieldRecord) => void }> = ({ lang, lastVillage, onCancel, onSave }) => {
  const [f, setF] = useState({ name: '', age: '', village: lastVillage, household: '', pregnant: true, weeks: '', hb: '', bp: '', weight: '', remedy: '', notes: '', referral: 'NONE' as AshaFieldRecord['referral'] });
  const [danger, setDanger] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const hb = f.hb.trim() ? Number(f.hb) : null;
  const bpOk = !f.bp.trim() || /^\d{2,3}\/\d{2,3}$/.test(f.bp.trim());
  const draft: Pick<AshaFieldRecord, 'isPregnant' | 'age' | 'hemoglobinGdl' | 'bloodPressure' | 'dangerSigns'> = {
    isPregnant: f.pregnant, age: f.age ? Number(f.age) : null, hemoglobinGdl: hb, bloodPressure: bpOk && f.bp.trim() ? f.bp.trim() : null, dangerSigns: danger
  };
  const flags = assessRisk(draft);

  const save = () => {
    if (!f.name.trim()) return setError(tr(lang, 'needName'));
    if (!bpOk) return setError(tr(lang, 'badBp'));
    if (hb !== null && (!(hb >= 2) || hb > 20)) return setError(tr(lang, 'badHb'));
    const now = new Date().toISOString();
    onSave({
      id: newId(), version: 1, village: f.village.trim() || 'Not recorded', household: f.household.trim() || null,
      patientName: f.name.trim(), age: f.age ? Number(f.age) : null, gender: 'FEMALE', isPregnant: f.pregnant,
      gestationalWeeks: f.pregnant && f.weeks ? Number(f.weeks) : null, hemoglobinGdl: hb, bloodPressure: draft.bloodPressure,
      weightKg: f.weight ? Number(f.weight) : null, dangerSigns: danger, homeRemedies: f.remedy.trim() ? [f.remedy.trim()] : [],
      notes: f.notes.trim() || null, riskFlags: flags, referral: flags.some(x => x.level === 'URGENT') && f.referral === 'NONE' ? 'ADVISED' : f.referral,
      visitAt: now, clientUpdatedAt: now, synced: false
    });
  };

  const input = 'w-full h-12 rounded-xl border border-border bg-background px-3 text-base';
  const label = 'text-xs font-bold text-muted-foreground';
  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto bg-card rounded-t-3xl sm:rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{tr(lang, 'newVisit')}</h2>
          <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-muted" aria-label={tr(lang, 'cancel')}><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2"><span className={label}>{tr(lang, 'name')} *</span><input className={input} value={f.name} onChange={set('name')} /></label>
          <label><span className={label}>{tr(lang, 'age')}</span><input className={input} inputMode="numeric" value={f.age} onChange={e => setF(p => ({ ...p, age: e.target.value.replace(/\D/g, '').slice(0, 3) }))} /></label>
          <label><span className={label}>{tr(lang, 'household')}</span><input className={input} value={f.household} onChange={set('household')} /></label>
          <label className="col-span-2"><span className={label}>{tr(lang, 'village')}</span><input className={input} value={f.village} onChange={set('village')} /></label>
        </div>
        <div>
          <span className={label}>{tr(lang, 'pregnant')}</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[true, false].map(v => (
              <button key={String(v)} type="button" onClick={() => setF(p => ({ ...p, pregnant: v }))} aria-pressed={f.pregnant === v} className={`h-12 rounded-xl border text-base font-bold ${f.pregnant === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'}`}>{tr(lang, v ? 'yes' : 'no')}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {f.pregnant && <label><span className={label}>{tr(lang, 'weeks')}</span><input className={input} inputMode="numeric" value={f.weeks} onChange={e => setF(p => ({ ...p, weeks: e.target.value.replace(/\D/g, '').slice(0, 2) }))} /></label>}
          <label><span className={label}>{tr(lang, 'hb')}</span><input className={input} inputMode="decimal" value={f.hb} onChange={set('hb')} placeholder={tr(lang, 'notMeasured')} /></label>
          <label><span className={label}>{tr(lang, 'bp')}</span><input className={input} inputMode="numeric" value={f.bp} onChange={set('bp')} placeholder={tr(lang, 'notMeasured')} /></label>
          <label><span className={label}>{tr(lang, 'weight')}</span><input className={input} inputMode="decimal" value={f.weight} onChange={set('weight')} /></label>
        </div>
        {f.pregnant && (
          <div>
            <span className={label}>{tr(lang, 'danger')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
              {DANGER.map(d => {
                const on = danger.includes(d.id);
                return (
                  <button key={d.id} type="button" onClick={() => setDanger(p => (on ? p.filter(x => x !== d.id) : [...p, d.id]))} aria-pressed={on} className={`min-h-[44px] px-3 rounded-xl border text-sm font-semibold text-left ${on ? 'bg-rose-600 text-white border-rose-600' : 'bg-background border-border'}`}>
                    {lang === 'hi' ? d.hi : d.en}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <label className="block"><span className={label}>{tr(lang, 'remedy')}</span><input className={input} value={f.remedy} onChange={set('remedy')} /></label>
        <label className="block"><span className={label}>{tr(lang, 'notes')}</span><textarea className="w-full rounded-xl border border-border bg-background p-3 text-base" rows={2} value={f.notes} onChange={set('notes')} /></label>
        <label className="block"><span className={label}>{tr(lang, 'referral')}</span>
          <select className={input} value={f.referral} onChange={set('referral')}>
            <option value="NONE">{lang === 'hi' ? 'नहीं' : 'None'}</option>
            <option value="ADVISED">{lang === 'hi' ? 'अस्पताल जाने की सलाह दी' : 'Advised to visit facility'}</option>
            <option value="REFERRED">{lang === 'hi' ? 'रेफ़रल पर्ची दी' : 'Referral slip given'}</option>
            <option value="ACCOMPANIED">{lang === 'hi' ? 'साथ लेकर गई' : 'Accompanied to facility'}</option>
          </select>
        </label>

        {flags.length > 0 && (
          <div className="space-y-1">
            {flags.some(x => x.level === 'URGENT') && <div className="p-2.5 rounded-xl bg-rose-600 text-white text-sm font-extrabold">{tr(lang, 'call108')}</div>}
            {flags.map(x => <div key={x.code} className={`text-xs font-bold rounded-lg px-2 py-1 ${levelCls[x.level]}`}>{x.text}</div>)}
          </div>
        )}
        <div className="min-h-[20px] text-sm font-semibold text-rose-600" role="alert">{error}</div>
        <div className="grid grid-cols-2 gap-2 pb-2">
          <button type="button" onClick={onCancel} className="h-12 rounded-xl border border-border text-base font-bold">{tr(lang, 'cancel')}</button>
          <button type="button" onClick={save} className="h-12 rounded-xl bg-emerald-600 text-white text-base font-extrabold">{tr(lang, 'save')}</button>
        </div>
      </div>
    </div>
  );
};
