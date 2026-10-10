import React, { useCallback, useEffect, useState } from 'react';
import { HardDriveDownload, RefreshCw, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { Panel, Btn, ErrorNote, Loading, fmtTime } from './adminUi';
import { DemoModePanel } from '../../components/common/DemoModeControl';

const Row: React.FC<{ label: string; ok?: boolean; value: React.ReactNode; hint?: string }> = ({ label, ok, value, hint }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 text-xs">
    <div>
      <div className="font-semibold text-foreground">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5 max-w-md">{hint}</div>}
    </div>
    <div className="flex items-center gap-1.5 text-right font-medium">
      {ok !== undefined && (ok ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-amber-600" />)}
      <span>{value}</span>
    </div>
  </div>
);

const CAP_LABEL: Record<string, string> = {
  asr: 'Speech recognition (Indian languages)',
  tts: 'Read-aloud voice',
  translate: 'Translation of instructions',
  llm: 'Small language model (extraction, note drafts)',
  ocr: 'Document reading (vision OCR)'
};

export const SystemPanel: React.FC = () => {
  const [sys, setSys] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([api.getSystemStatus(), api.listBackups()]);
      setSys(s);
      setBackups(b);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const backupNow = async () => {
    setBusy('backup');
    try {
      const r = await api.runBackup();
      setNotice(`Backup written: ${r.data.file} (${Math.round(r.data.bytes / 1024)} KB). Copy the backups folder off this machine regularly.`);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const retention = async () => {
    setBusy('retention');
    try {
      const r = await api.runRetention();
      setNotice(`Clean-up done: ${r.data.draftsDeleted} unfinished check-ins deleted, ${r.data.abandonedVisitsClosed} old visits closed, ${r.data.expiredPatientsDeleted} records past retention deleted.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!sys) return error ? <ErrorNote message={error} /> : <Loading />;

  return (
    <div className="space-y-4">
      {notice && <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs font-semibold text-emerald-800 dark:text-emerald-200">{notice}</div>}
      <ErrorNote message={error} />

      <Panel title="Mock or Real" subtitle="Show the system with sample patients, or exactly as it runs with real ones. One click; every screen follows.">
        <DemoModePanel onSwitched={() => load()} />
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Security & configuration" actions={<Btn onClick={load}><RefreshCw size={13} /> Refresh</Btn>}>
          <Row label="Environment" value={sys.environment} ok={sys.environment === 'production'} hint="Set NODE_ENV=production on the hospital server." />
          <Row label="Sample (mock) data" value={sys.demoData ? 'ON' : 'off'} ok={!sys.demoData} hint="Must be off once real patients are seen (Real mode above, or ALLOW_DEMO_DATA=false on a hospital installation)." />
          <Row label="Kiosk enrolment" value={sys.kioskEnrollmentRequired ? 'required' : 'not required'} ok={sys.kioskEnrollmentRequired} />
          <Row label="Allowed browser origins" value={sys.corsOrigins.length ? sys.corsOrigins.join(', ') : 'same-origin only'} ok />
          <Row label="Audit chain" value={sys.auditChain.valid ? `intact · ${sys.auditChain.checked} entries` : `BROKEN at ${sys.auditChain.brokenAtId}`} ok={sys.auditChain.valid} />
          <Row label="Prescription signing key" value={<code className="font-mono">{sys.signingKeyId}</code>} ok hint="Ed25519. The key file lives in the server's data/keys folder — back it up with the database." />
          <Row label="SMS gateway" value={sys.smsProvider === 'log' ? 'not connected (messages only logged)' : sys.smsProvider} ok={sys.smsProvider !== 'log'} hint="Set SMS_PROVIDER=msg91 with DLT-approved templates, or webhook." />
        </Panel>

        <Panel title="On-premise AI service" subtitle={sys.edgeAi.online ? `Running at ${sys.edgeAi.url}${sys.edgeAi.device ? ` on ${sys.edgeAi.device}` : ''}` : `Not running (${sys.edgeAi.url}). Everything still works with the built-in rules; see edge-ai/README.md to install.`}>
          {Object.entries(sys.edgeAi.capabilities).map(([k, v]: [string, any]) => (
            <Row key={k} label={CAP_LABEL[k] || k} value={v.available ? v.model || 'available' : 'not installed'} ok={v.available} />
          ))}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Backups"
          subtitle="Encrypted (AES-256-GCM) copy of the database every night. Keep a copy on another machine or drive."
          actions={<Btn tone="primary" busy={busy === 'backup'} onClick={backupNow}><HardDriveDownload size={13} /> Back up now</Btn>}
        >
          {backups.length === 0 ? <p className="text-xs text-muted-foreground">No backups yet.</p> : (
            <ul className="text-xs divide-y divide-border/40">
              {backups.map(b => (
                <li key={b.file} className="py-1.5 flex justify-between gap-2"><span className="font-mono truncate">{b.file}</span><span className="text-muted-foreground whitespace-nowrap">{Math.round(b.bytes / 1024)} KB · {fmtTime(b.createdAt)}</span></li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Data retention"
          subtitle={`Unfinished check-ins are deleted after ${sys.retention.draftHours} h; visits never seen are closed after ${sys.retention.abandonedVisitDays} days; records with no visit for ${sys.retention.clinicalYears} years are deleted. Runs automatically every 6 hours.`}
          actions={<Btn busy={busy === 'retention'} onClick={retention}><Trash2 size={13} /> Run clean-up now</Btn>}
        >
          <p className="text-[11px] text-muted-foreground">Retention periods are set by the server administrator (DRAFT_RETENTION_HOURS, ABANDONED_SESSION_DAYS, CLINICAL_RETENTION_YEARS). Confirm the clinical period with the hospital's medical-records policy and state rules.</p>
        </Panel>
      </div>
    </div>
  );
};
