import React, { useCallback, useEffect, useState } from 'react';
import { MonitorSmartphone, Copy, Ban, Check, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { session } from '../../services/session';
import { setKioskLocked } from '../../components/kiosk/KioskShell';
import { Panel, Btn, Field, inputCls, ErrorNote, Loading, fmtTime } from './adminUi';

/**
 * Kiosk / display-board enrolment. A device token is shown once; it is stored on the device itself
 * (or pasted into it) and can be revoked here if the device is lost or replaced.
 */
export const DevicesPanel: React.FC = () => {
  const [devices, setDevices] = useState<any[] | null>(null);
  const [form, setForm] = useState({ name: '', location: '', printerHost: '' });
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const thisDeviceEnrolled = !!session.deviceToken;

  const load = useCallback(() => api.listDevices().then(setDevices).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const enroll = async (useHere: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.enrollDevice(form);
      if (useHere) session.setDeviceToken(r.token);
      setIssued({ name: r.device.name, token: r.token });
      setForm({ name: '', location: '', printerHost: '' });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this device? It will stop working until enrolled again.')) return;
    try {
      await api.revokeDevice(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const setPrinter = async (d: any) => {
    const host = window.prompt('Thermal printer address (IP:port, e.g. 192.168.1.50:9100). Leave empty to remove.', d.printerHost || '');
    if (host === null) return;
    try {
      await api.updateDevice(d.id, { printerHost: host });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <ErrorNote message={error} />
      <Panel
        title="Enrol a kiosk or display screen"
        subtitle="In production, patient kiosks and waiting-room screens only work after enrolment. Do this on the device itself and press 'Enrol this device', or copy the code to it."
      >
        <div className="grid sm:grid-cols-3 gap-x-3">
          <Field label="Device name"><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="OPD Kiosk 2" /></Field>
          <Field label="Location"><input className={inputCls} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ground floor, near registration" /></Field>
          <Field label="Thermal printer (optional)" hint="IP:port of an ESC/POS printer"><input className={inputCls} value={form.printerHost} onChange={e => setForm(f => ({ ...f, printerHost: e.target.value }))} placeholder="192.168.1.50:9100" /></Field>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn tone="primary" onClick={() => enroll(true)} busy={busy} disabled={!form.name.trim()}><MonitorSmartphone size={13} /> Enrol this device</Btn>
          <Btn onClick={() => enroll(false)} busy={busy} disabled={!form.name.trim()}>Create code for another device</Btn>
          {thisDeviceEnrolled && (
            <>
              <Btn onClick={() => { session.clearDeviceToken(); load(); }}>Remove enrolment from this browser</Btn>
              <Btn onClick={() => {
                if (!window.confirm('Lock this browser into the patient kiosk? Staff can leave by pressing and holding the top-left corner for 3 seconds and signing in.')) return;
                setKioskLocked(true);
                window.location.href = `${window.location.pathname}?mode=kiosk`;
              }}>Start locked kiosk mode here</Btn>
              <Btn onClick={() => { window.location.href = `${window.location.pathname}?mode=display`; }}>Open queue display here</Btn>
            </>
          )}
        </div>
        {issued && (
          <div className="mt-3 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Device "{issued.name}" enrolled. This code is shown only once:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-mono break-all">{issued.token}</code>
              <Btn onClick={() => { navigator.clipboard?.writeText(issued.token); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={12} /> : <Copy size={12} />} Copy</Btn>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">On the other device, open the kiosk and paste it into the "Enrol this kiosk" screen.</p>
          </div>
        )}
      </Panel>

      <Panel title="Enrolled devices">
        {!devices ? <Loading /> : devices.length === 0 ? <p className="text-xs text-muted-foreground">No devices enrolled yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr className="text-left border-b border-border/70">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Location</th>
                <th className="py-2 pr-3 font-semibold">Printer</th>
                <th className="py-2 pr-3 font-semibold">Enrolled</th>
                <th className="py-2 pr-3 font-semibold">Last seen</th>
                <th className="py-2 font-semibold">Actions</th>
              </tr></thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d.id} className={`border-b border-border/40 ${d.revokedAt ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-3 font-semibold">{d.name}<div className="font-mono text-[11px] text-muted-foreground">{d.id}</div></td>
                    <td className="py-2 pr-3">{d.location || '—'}</td>
                    <td className="py-2 pr-3 font-mono">{d.printerHost || '—'}</td>
                    <td className="py-2 pr-3">{fmtTime(d.createdAt)}</td>
                    <td className="py-2 pr-3">{d.revokedAt ? `Revoked ${fmtTime(d.revokedAt)}` : fmtTime(d.lastSeenAt)}</td>
                    <td className="py-2">
                      {!d.revokedAt && (
                        <div className="flex gap-1.5">
                          <Btn onClick={() => setPrinter(d)}><Printer size={12} /> Printer</Btn>
                          <Btn tone="quietDanger" onClick={() => revoke(d.id)}><Ban size={12} /> Revoke</Btn>
                        </div>
                      )}
                    </td>
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
