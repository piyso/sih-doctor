import React, { useEffect, useState } from 'react';
import { ShieldCheck, Cpu, Mic, KeyRound, CheckCircle2, X, Layers, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { LeverDiagnosticsData, SubsystemDiagnostics } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

interface LeverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CARD = {
  background: 'rgba(255, 255, 255, 0.025)',
  borderRadius: 14,
  padding: 16
} as const;

const SubsystemCard: React.FC<{ title: string; icon: React.ReactNode; color: string; data?: SubsystemDiagnostics; badge: string }> = ({ title, icon, color, data, badge }) => (
  <div style={{ ...CARD, border: `1px solid ${color}40` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: `${color}26`, padding: 6, borderRadius: 8, display: 'flex' }}>{icon}</div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', margin: 0, fontFamily: 'var(--font-sans)' }}>{title}</h3>
      </div>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: data?.connected ? color : '#f59e0b', background: `${data?.connected ? color : '#f59e0b'}1f`, padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {data?.connected ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {data ? (data.connected ? badge : 'OFFLINE / FALLBACK') : 'CHECKING'}
      </span>
    </div>
    <div style={{ fontSize: 10.5, color: '#8e8e93', fontFamily: 'var(--font-mono)', marginBottom: 10, background: 'rgba(0, 0, 0, 0.35)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
      {data?.path || '…'}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, fontSize: 11 }}>
      {(data?.subsystems || []).map((s, i) => (
        <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '10px 12px', borderRadius: 8, color: '#c7c7cc' }}>{s}</div>
      ))}
    </div>
  </div>
);

/**
 * Live diagnostics of the three backend subsystems. Everything shown comes from
 * GET /api/security/diagnostics (graph size, calibration state, chain verification, edge-AI models).
 */
export const LeverModal: React.FC<LeverModalProps> = ({ isOpen, onClose }) => {
  const [diagnostics, setDiagnostics] = useState<LeverDiagnosticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    sovereignSound.playMechanicalSnap();
    setDiagnostics(null);
    setError(null);
    api.getLeverDiagnostics().then(d => { if (d) setDiagnostics(d); else setError('Diagnostics are not available right now.'); });
  }, [isOpen]);

  if (!isOpen) return null;

  const ledger = diagnostics?.integrityLedger;
  const chainsOk = !!ledger?.auditChain?.valid && !!ledger?.provenanceChain?.isValid;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        className="sovereign-glass-card"
        style={{ width: '100%', maxWidth: 880, maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative', background: 'linear-gradient(165deg, rgba(22, 22, 28, 0.92) 0%, rgba(10, 10, 14, 0.96) 100%)', border: '1px solid rgba(255, 255, 255, 0.10)', boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.20), 0 32px 80px -16px rgba(0, 0, 0, 0.95)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.30)', padding: 10, borderRadius: 12, display: 'flex' }}>
              <Layers size={22} color="#06b6d4" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', color: '#ffffff', margin: 0, fontFamily: 'var(--font-sans)' }}>System diagnostics</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: chainsOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: chainsOk ? '#10b981' : '#f59e0b', border: `1px solid ${chainsOk ? 'rgba(16, 185, 129, 0.30)' : 'rgba(245, 158, 11, 0.30)'}` }}>
                  {diagnostics ? (chainsOk ? 'AUDIT + PROVENANCE CHAINS VERIFIED' : 'CHAIN CHECK FAILED') : 'LOADING'}
                </span>
                <span style={{ fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-sans)' }}>Live values from the hospital server; nothing here is a static claim.</span>
              </div>
            </div>
          </div>
          <button onClick={() => { sovereignSound.playMechanicalSnap(); onClose(); }} style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.10)', color: '#8e8e93', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.18)', padding: 8, borderRadius: 10 }}><ShieldCheck size={22} color="#10b981" /></div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>On-premise processing (DPDP Act 2023)</div>
              <div style={{ fontSize: 12, color: '#c7c7cc', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
                Speech, extraction, safety checks and signing run on this server. Records are Ed25519-signed and hash-chained; the audit log is tamper-evident.
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#8e8e93', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Signing key</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{ledger?.signingKeyId || '…'}</div>
          </div>
        </div>

        {error && <div style={{ color: '#f59e0b', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {error}</div>}
        {!diagnostics && !error && <div style={{ color: '#8e8e93', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={14} className="animate-spin" /> Querying the server…</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SubsystemCard title="Clinical knowledge and safety engine" icon={<Cpu size={18} color="#06b6d4" />} color="#06b6d4" data={diagnostics?.cognitiveEngine} badge="RUNNING" />
          <SubsystemCard title="On-premise speech pipeline" icon={<Mic size={18} color="#f59e0b" />} color="#f59e0b" data={diagnostics?.speechPipeline} badge="MODELS LOADED" />
          <SubsystemCard title="Record integrity ledger" icon={<KeyRound size={18} color="#10b981" />} color="#10b981" data={diagnostics?.integrityLedger ? { ...diagnostics.integrityLedger, subsystems: [
            `Protocol: ${diagnostics.integrityLedger.protocol}`,
            `Audit chain: ${diagnostics.integrityLedger.auditChain?.valid ? `valid (${diagnostics.integrityLedger.auditChain.checked} entries)` : 'BROKEN'}`,
            `Provenance chain: ${diagnostics.integrityLedger.provenanceChain?.isValid ? `valid (${diagnostics.integrityLedger.provenanceChain.totalNodes} nodes)` : 'BROKEN'}`
          ] } : undefined} badge="CHAINS VERIFIED" />
        </div>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-mono)' }}>
            Verification: <code style={{ color: '#10b981' }}>cd backend && npm test</code> (25 batteries)
          </div>
          <button onClick={() => { sovereignSound.playMechanicalSnap(); onClose(); }} className="sovereign-button-primary" style={{ padding: '8px 20px', fontSize: 13 }}>Close</button>
        </div>
      </div>
    </div>
  );
};
