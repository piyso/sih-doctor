import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, KeyRound, Power } from 'lucide-react';
import { api } from '../../services/api';
import { ROLE_LABEL, StaffRole } from '../../services/session';
import { useStaffUser } from '../../components/auth/StaffGate';
import { Panel, Btn, Field, inputCls, ErrorNote, Loading, fmtTime } from './adminUi';

const ROLES: StaffRole[] = ['doctor', 'vaidya', 'nurse', 'pharmacist', 'asha', 'reception', 'admin'];
const DEPARTMENTS = ['GENMED', 'PAED', 'OBGY', 'ORTH', 'ENT', 'KAYA', 'PKRM', 'SHLK', 'PRAS', 'BALA', 'SHAL', 'ER', 'OPD', 'PHARMACY', 'COMMUNITY'];

const empty = { username: '', displayName: '', role: 'doctor' as StaffRole, pin: '', department: 'GENMED', qualification: '', registrationNo: '' };

export const StaffPanel: React.FC = () => {
  const me = useStaffUser();
  const [users, setUsers] = useState<any[] | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<any | null>(null);
  const [resetPin, setResetPin] = useState('');

  const load = useCallback(() => api.listStaff().then(setUsers).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createStaff(form);
      setNotice(`Account "${form.username}" created. Give them the temporary PIN in person; they must change it at first sign-in.`);
      setForm(empty);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.updateStaff(u.id, { active: !u.active });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const doReset = async () => {
    try {
      await api.resetStaffPin(resetFor.id, resetPin);
      setNotice(`Temporary PIN set for ${resetFor.displayName}. They must change it at next sign-in; their open sessions were signed out.`);
      setResetFor(null);
      setResetPin('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const prescriber = form.role === 'doctor' || form.role === 'vaidya';

  return (
    <div className="space-y-4">
      {notice && <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs font-semibold text-emerald-800 dark:text-emerald-200">{notice}</div>}
      <ErrorNote message={error} />

      <Panel title="Add a staff member" subtitle="Doctors and vaidyas need their council registration number — it is printed on every prescription they sign.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-3">
          <Field label="Full name (as printed)"><input className={inputCls} value={form.displayName} onChange={set('displayName')} placeholder="Dr. Meera Iyer" /></Field>
          <Field label="Username" hint="letters, digits, dot"><input className={inputCls} value={form.username} onChange={set('username')} placeholder="dr.iyer" autoCapitalize="none" /></Field>
          <Field label="Role">
            <select className={inputCls} value={form.role} onChange={set('role')}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <Field label="Temporary PIN" hint="6+ digits; must be changed at first sign-in"><input className={inputCls} type="password" value={form.pin} onChange={set('pin')} inputMode="numeric" /></Field>
          <Field label="Department">
            <select className={inputCls} value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Qualification"><input className={inputCls} value={form.qualification} onChange={set('qualification')} placeholder={form.role === 'vaidya' ? 'BAMS, MD (Ayu)' : 'MBBS, MD'} /></Field>
          <Field label={prescriber ? 'Registration no. (required)' : 'Registration no.'}><input className={inputCls} value={form.registrationNo} onChange={set('registrationNo')} placeholder={form.role === 'vaidya' ? 'NCISM / State Board Reg.' : 'NMC / State Council Reg.'} /></Field>
          <div className="flex items-start pt-5">
            <Btn tone="primary" onClick={create} busy={busy} disabled={!form.username || !form.displayName || !form.pin}><UserPlus size={13} /> Create account</Btn>
          </div>
        </div>
      </Panel>

      <Panel title="Staff accounts">
        {!users ? <Loading /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr className="text-left border-b border-border/70">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Username</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 pr-3 font-semibold">Department</th>
                <th className="py-2 pr-3 font-semibold">Registration</th>
                <th className="py-2 pr-3 font-semibold">Last sign-in</th>
                <th className="py-2 font-semibold">Actions</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`border-b border-border/40 ${u.active ? '' : 'opacity-50'}`}>
                    <td className="py-2 pr-3 font-semibold">{u.displayName}{u.isDemo && <span className="ml-1.5 px-1.5 rounded bg-amber-500/15 text-amber-700 text-[10px]">demo</span>}{u.mustChangePin && <span className="ml-1.5 px-1.5 rounded bg-sky-500/15 text-sky-700 text-[10px]">new PIN pending</span>}</td>
                    <td className="py-2 pr-3 font-mono">{u.username}</td>
                    <td className="py-2 pr-3">{ROLE_LABEL[u.role as StaffRole]}</td>
                    <td className="py-2 pr-3">{u.department || '—'}</td>
                    <td className="py-2 pr-3">{u.registrationNo || '—'}</td>
                    <td className="py-2 pr-3">{fmtTime(u.lastLoginAt)}</td>
                    <td className="py-2">
                      <div className="flex gap-1.5">
                        <Btn onClick={() => { setResetFor(u); setResetPin(''); }}><KeyRound size={12} /> Reset PIN</Btn>
                        {u.id !== me?.id && <Btn tone={u.active ? 'danger' : 'default'} onClick={() => toggleActive(u)}><Power size={12} /> {u.active ? 'Deactivate' : 'Reactivate'}</Btn>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {resetFor && (
        <div className="fixed inset-0 z-[1400] bg-slate-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-sm font-bold">Reset PIN for {resetFor.displayName}</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Check the person's identity first. They will be asked to choose their own PIN at next sign-in.</p>
            <Field label="Temporary PIN"><input className={inputCls} type="password" inputMode="numeric" value={resetPin} onChange={e => setResetPin(e.target.value)} autoFocus /></Field>
            <div className="flex gap-2 justify-end">
              <Btn onClick={() => setResetFor(null)}>Cancel</Btn>
              <Btn tone="primary" onClick={doReset} disabled={resetPin.length < 6}>Set PIN</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
