import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { Panel, Btn, inputCls, ErrorNote, Loading, fmtTime } from './adminUi';

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.change_pin': 'Changed own PIN',
  'auth.setup': 'First administrator created',
  'access.denied': 'Access refused',
  'record.view': 'Opened a patient record',
  'record.view_timeline': 'Opened a patient’s past visits',
  'record.vitals_updated': 'Updated vitals',
  'record.seal_verified': 'Checked a prescription seal',
  'prescription.finalized': 'Signed a prescription',
  'prescription.amended': 'Amended a prescription',
  'pharmacy.dispense': 'Recorded a pharmacy hand-over',
  'pharmacy.h1_register_viewed': 'Opened the Schedule H1 register',
  'pharmacovigilance.adr_created': 'Started a side-effect report',
  'pharmacovigilance.adr_submitted': 'Submitted a side-effect report',
  'public_health.notified': 'Notified a reportable disease',
  'kiosk.check_in': 'Kiosk check-in',
  'kiosk.family_check_in': 'Family check-in',
  'kiosk.draft_resumed': 'Resumed an unfinished check-in',
  'kiosk.interview_finished': 'Finished the kiosk interview',
  'print.token_slip': 'Printed a token slip',
  'sos.raised': 'SOS raised',
  'sos.acknowledged': 'SOS acknowledged',
  'sos.resolved': 'SOS resolved',
  'queue.patient_called': 'Called a patient to the room',
  'queue.status_changed': 'Changed a visit’s status',
  'queue.no_show': 'Marked a patient not present',
  'queue.claimed': 'Took a patient from the queue',
  'consent.recording': 'Recorded consent for room recording',
  'scribe.room_clip': 'Transcribed a room recording',
  'ai.soap_drafted': 'Drafted a visit note',
  'ai.translate': 'Translated instructions',
  'retrieval.similar': 'Searched similar past cases',
  'asha.sync': 'ASHA records synced',
  'abdm.abha_lookup': 'Looked up an ABHA number',
  'abdm.link_requested': 'Requested an ABDM record link',
  'abdm.care_context_registered': 'Registered a visit with ABDM',
  'abdm.consent_received': 'ABDM consent received',
  'abdm.consent_updated': 'ABDM consent updated',
  'abdm.health_information_pushed': 'Sent records under ABDM consent',
  'abdm.hiu_simulation': 'ABDM test request',
  'privacy.patient_search': 'Searched for a patient',
  'privacy.identifiers_erased': 'Erased a patient’s identifiers',
  'privacy.data_exported': 'Exported a patient’s data',
  'privacy.consent_withdrawn': 'Consent withdrawn',
  'privacy.retention_run': 'Retention clean-up',
  'admin.user_created': 'Created a staff account',
  'admin.user_updated': 'Changed a staff account',
  'admin.pin_reset': 'Reset a staff PIN',
  'admin.device_enrolled': 'Enrolled a kiosk or screen',
  'admin.device_updated': 'Changed a kiosk or screen',
  'admin.device_revoked': 'Revoked a kiosk or screen',
  'admin.backup_now': 'Started a backup',
  'admin.retention_run': 'Ran the retention clean-up',
  'system.backup': 'Backup written',
  'system.demo_mode': 'Switched Mock / Real mode',
  'demo.seed_database': 'Reloaded the sample data',
  'demo.restore_queue': 'Restored the sample queue'
};

const OUTCOME_LABEL: Record<string, string> = { success: 'Done', denied: 'Refused', failure: 'Failed' };

/** "stopGroupsAcknowledged" → "stop groups acknowledged"; "pin_reset" → "pin reset". */
const words = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.]+/g, ' ').toLowerCase();
/** An action the table above does not know yet still reads as words, never as a code. */
const actionLabel = (action: string, outcome?: string) =>
  action === 'auth.login' && outcome && outcome !== 'success' ? 'Sign-in attempt'
    : ACTION_LABEL[action] || (w => w.charAt(0).toUpperCase() + w.slice(1))(words(action));

const VALUE_LABEL: Record<string, string> = {
  bad_pin: 'wrong PIN', unknown_user: 'unknown username', locked: 'account locked', inactive: 'account switched off',
  FORBIDDEN: 'not allowed for this role', AUTH_REQUIRED: 'not signed in', DEMO_DISABLED: 'sample accounts are off (Real mode)'
};
/** Stored codes ("bad_pin", "AUTH_REQUIRED") read as words; ids, paths and numbers are left as they are. */
const valueText = (v: string) => VALUE_LABEL[v] || (/^[A-Za-z]+(_[A-Za-z]+)+$/.test(v) ? v.replace(/_/g, ' ').toLowerCase() : v);

/** The stored details as flat "key: value" pairs (nested objects become "guards › flagged"). */
function detailPairs(meta: unknown, prefix = ''): Array<[string, string]> {
  if (!meta || typeof meta !== 'object') return [];
  return Object.entries(meta as Record<string, unknown>).flatMap(([k, v]): Array<[string, string]> => {
    const key = `${prefix}${words(k)}`;
    if (v === null || v === undefined || v === '') return [];
    if (Array.isArray(v)) return [[key, v.length ? v.map(x => (typeof x === 'object' ? JSON.stringify(x) : valueText(String(x)))).join(', ') : 'none']];
    if (typeof v === 'object') return detailPairs(v, `${key} › `);
    return [[key, typeof v === 'boolean' ? (v ? 'yes' : 'no') : valueText(String(v))]];
  });
}

const Details: React.FC<{ meta: unknown }> = ({ meta }) => {
  const pairs = detailPairs(meta);
  if (!pairs.length) return <span className="text-muted-foreground">—</span>;
  const pair = ([k, v]: [string, string]) => <span key={k} className="mr-3 inline-block"><span className="text-muted-foreground">{k}:</span> {v}</span>;
  if (pairs.length <= 2) return <>{pairs.map(pair)}</>;
  return (
    <details>
      <summary className="cursor-pointer list-none">
        {pairs.slice(0, 2).map(pair)}
        <span className="font-semibold text-primary whitespace-nowrap">+{pairs.length - 2} more</span>
      </summary>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {pairs.slice(2).map(([k, v]) => <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words min-w-0">{v}</dd></React.Fragment>)}
      </dl>
    </details>
  );
};

/** Who did what, when. Tamper-evident (each entry is hash-chained to the previous one). */
export const AuditPanel: React.FC = () => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [chain, setChain] = useState<{ valid: boolean; checked: number; brokenAtId?: number } | null>(null);
  const [filters, setFilters] = useState({ action: '', entity: '', outcome: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '200' };
      Object.entries(filters).forEach(([k, v]) => { if (v.trim()) params[k] = v.trim(); });
      setRows(await api.getAuditLog(params));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.verifyAuditChain().then(setChain).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <Panel
        title="Audit trail"
        subtitle="Every sign-in, record view, prescription and privacy action is recorded. Entries are chained by SHA-256, so editing or deleting a past entry is detectable."
        actions={chain && (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${chain.valid ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
            {chain.valid ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
            {chain.valid ? `Chain intact (${chain.checked} entries)` : `Chain broken at entry ${chain.brokenAtId}`}
          </span>
        )}
      >
        <div className="grid sm:grid-cols-4 gap-2 mb-3">
          <select className={inputCls} aria-label="Kind of action" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
            <option value="">All actions</option>
            <option value="auth.">Sign-ins</option>
            <option value="access.">Access refused</option>
            <option value="record.">Record access</option>
            <option value="prescription.">Prescriptions</option>
            <option value="pharmacy.">Pharmacy</option>
            <option value="sos.">SOS</option>
            <option value="kiosk.">Kiosk</option>
            <option value="abdm.">ABDM</option>
            <option value="privacy.">Privacy</option>
            <option value="admin.">Administration</option>
            <option value="system.">System</option>
          </select>
          <input className={inputCls} placeholder="Record / visit id" aria-label="Record or visit id" value={filters.entity} onChange={e => setFilters(f => ({ ...f, entity: e.target.value }))} />
          <select className={inputCls} aria-label="Result" value={filters.outcome} onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))}>
            <option value="">Any result</option>
            <option value="success">Done</option>
            <option value="denied">Refused</option>
            <option value="failure">Failed</option>
          </select>
          <Btn onClick={load}><RefreshCw size={13} /> Refresh</Btn>
        </div>
        <ErrorNote message={error} />
        {!rows ? <Loading /> : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground sticky top-0 bg-card"><tr className="text-left border-b border-border/70">
                <th className="py-2 pr-3 font-semibold">When</th>
                <th className="py-2 pr-3 font-semibold">Who</th>
                <th className="py-2 pr-3 font-semibold">What</th>
                <th className="py-2 pr-3 font-semibold">Record</th>
                <th className="py-2 pr-3 font-semibold">Result</th>
                <th className="py-2 font-semibold">Details</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No entries match these filters.</td></tr>}
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border/40 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtTime(r.createdAt)}</td>
                    <td className="py-1.5 pr-3">{r.actorName || r.actor}{r.actorRole && <span className="text-muted-foreground"> · {r.actorRole}</span>}</td>
                    <td className="py-1.5 pr-3 font-medium" title={r.action}>{actionLabel(r.action, r.outcome)}</td>
                    <td className="py-1.5 pr-3 font-mono max-w-[150px] truncate" title={r.entityId || ''}>{r.entityId || '—'}</td>
                    <td className={`py-1.5 pr-3 font-semibold whitespace-nowrap ${r.outcome === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{OUTCOME_LABEL[r.outcome] || r.outcome}</td>
                    <td className="py-1.5 min-w-[220px] max-w-[420px]"><Details meta={r.metadata} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};
