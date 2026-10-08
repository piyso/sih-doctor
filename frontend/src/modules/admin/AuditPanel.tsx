import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { Panel, Btn, inputCls, ErrorNote, Loading, fmtTime } from './adminUi';

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Sign-in',
  'auth.logout': 'Sign-out',
  'auth.change_pin': 'PIN changed',
  'access.denied': 'Access refused',
  'record.view': 'Opened patient record',
  'record.vitals_updated': 'Vitals updated',
  'prescription.finalized': 'Prescription signed',
  'prescription.amended': 'Prescription amended',
  'pharmacy.dispense': 'Medicines dispensed',
  'kiosk.check_in': 'Kiosk check-in',
  'kiosk.family_check_in': 'Family check-in',
  'sos.raised': 'SOS raised',
  'sos.acknowledged': 'SOS acknowledged',
  'sos.resolved': 'SOS resolved',
  'queue.patient_called': 'Patient called',
  'queue.status_changed': 'Queue status changed',
  'privacy.identifiers_erased': 'Patient identifiers erased',
  'privacy.data_exported': 'Patient data exported',
  'privacy.consent_withdrawn': 'Consent withdrawn',
  'system.backup': 'Backup'
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
          <select className={inputCls} value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
            <option value="">All actions</option>
            <option value="auth.">Sign-ins</option>
            <option value="access.">Access refused</option>
            <option value="record.">Record access</option>
            <option value="prescription.">Prescriptions</option>
            <option value="sos.">SOS</option>
            <option value="privacy.">Privacy</option>
            <option value="admin.">Administration</option>
          </select>
          <input className={inputCls} placeholder="Record / visit id" value={filters.entity} onChange={e => setFilters(f => ({ ...f, entity: e.target.value }))} />
          <select className={inputCls} value={filters.outcome} onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))}>
            <option value="">Any outcome</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="failure">Failure</option>
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
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border/40 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtTime(r.createdAt)}</td>
                    <td className="py-1.5 pr-3">{r.actorName || r.actor}{r.actorRole && <span className="text-muted-foreground"> · {r.actorRole}</span>}</td>
                    <td className="py-1.5 pr-3 font-medium">{ACTION_LABEL[r.action] || r.action}</td>
                    <td className="py-1.5 pr-3 font-mono text-[10px] max-w-[160px] truncate" title={r.entityId || ''}>{r.entityId || '—'}</td>
                    <td className={`py-1.5 pr-3 font-semibold ${r.outcome === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{r.outcome}</td>
                    <td className="py-1.5 font-mono text-[10px] text-muted-foreground max-w-[280px] truncate" title={r.metadata ? JSON.stringify(r.metadata) : ''}>{r.metadata ? JSON.stringify(r.metadata) : ''}</td>
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
