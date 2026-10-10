import React, { useState } from 'react';
import { Search, Download, Eraser, BellOff } from 'lucide-react';
import { api } from '../../services/api';
import { Panel, Btn, inputCls, ErrorNote, fmtTime } from './adminUi';

const PURPOSE_LABEL: Record<string, string> = {
  care: 'Treatment',
  abha_link: 'ABHA / ABDM linking',
  sms: 'SMS updates',
  research: 'Anonymised improvement'
};

/**
 * Patient rights under the DPDP Act 2023: access (export), correction (via the doctor desk),
 * erasure of identifiers, and withdrawal of optional consents. Verify identity in person first.
 */
export const PrivacyPanel: React.FC = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [eraseFor, setEraseFor] = useState<any | null>(null);
  const [eraseNote, setEraseNote] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const search = async () => {
    setError(null);
    try {
      setResults(await api.searchPatients(q));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const exportData = async (p: any) => {
    try {
      const data = await api.exportPatient(p.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `patient-record-${p.id}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNotice(`Exported the record of ${p.name}. Hand it to the patient securely (printed or on their own device).`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const withdraw = async (p: any, purpose: string) => {
    try {
      await api.withdrawConsent(p.id, [purpose]);
      setNotice(`${PURPOSE_LABEL[purpose]} consent withdrawn for ${p.name}.`);
      search();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const erase = async () => {
    try {
      await api.erasePatient(eraseFor.id, eraseNote);
      setNotice(`Identifiers of ${eraseFor.name} were erased. Clinical notes are kept, without identity, until the legal retention period ends.`);
      setEraseFor(null);
      setConfirmText('');
      setEraseNote('');
      search();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {notice && <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs font-semibold text-emerald-800 dark:text-emerald-200">{notice}</div>}
      <ErrorNote message={error} />
      <Panel
        title="Patient data requests (DPDP Act 2023)"
        subtitle="Use when a patient asks to see their data, stop SMS, or remove their identity. Always check identity (ID card / ABHA) in person before acting. Every action here is audited."
      >
        <div className="flex gap-2 mb-3">
          <input className={inputCls} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="Name, ABHA number, or last 4 digits of mobile" />
          <Btn tone="primary" onClick={search} disabled={q.trim().length < 2}><Search size={13} /> Search</Btn>
        </div>
        {results && results.length === 0 && <p className="text-xs text-muted-foreground">No matching patients.</p>}
        {results && results.length > 0 && (
          <div className="space-y-2">
            {results.map(p => (
              <div key={p.id} className="p-3 rounded-xl border border-border/80 bg-background">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-bold">{p.name} <span className="text-xs font-medium text-muted-foreground">· {p.age || '?'} y · {p.gender}</span></div>
                    <div className="text-[11px] text-muted-foreground">Mobile {p.phoneMasked || '—'} · ABHA {p.abhaId || '—'} · {p.visits} visit(s) · first seen {fmtTime(p.createdAt)}</div>
                    {p.erasedAt && <div className="text-[11px] font-semibold text-rose-600">Identifiers erased {fmtTime(p.erasedAt)}</div>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(p.consent || {}).map(([k, v]) => (
                        <span key={k} className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${v ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                          {PURPOSE_LABEL[k] || k}: {v ? 'yes' : 'no'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Btn onClick={() => exportData(p)}><Download size={12} /> Export data</Btn>
                    {p.consent?.sms && <Btn onClick={() => withdraw(p, 'sms')}><BellOff size={12} /> Stop SMS</Btn>}
                    {p.consent?.research && <Btn onClick={() => withdraw(p, 'research')}>Withdraw research use</Btn>}
                    {!p.erasedAt && <Btn tone="quietDanger" onClick={() => setEraseFor(p)}><Eraser size={12} /> Erase identity</Btn>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {eraseFor && (
        <div className="fixed inset-0 z-[1400] bg-slate-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-sm font-bold">Erase identity of {eraseFor.name}?</h3>
            <p className="text-xs text-muted-foreground mt-1.5">
              Name, mobile, ABHA, Aadhaar (masked), voice transcripts and scanned-document text are removed now and cannot be recovered.
              Medical notes stay under a pseudonym because hospitals must keep treatment records for the legal retention period; they are deleted automatically after that.
            </p>
            <label className="block mt-3 text-[11px] font-semibold text-muted-foreground">Reason / request reference</label>
            <input className={inputCls} value={eraseNote} onChange={e => setEraseNote(e.target.value)} placeholder="Written request dated …" />
            <label className="block mt-3 text-[11px] font-semibold text-muted-foreground">Type ERASE to confirm</label>
            <input className={inputCls} value={confirmText} onChange={e => setConfirmText(e.target.value)} />
            <div className="flex gap-2 justify-end mt-4">
              <Btn onClick={() => { setEraseFor(null); setConfirmText(''); }}>Cancel</Btn>
              <Btn tone="danger" onClick={erase} disabled={confirmText !== 'ERASE'}>Erase identity</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
