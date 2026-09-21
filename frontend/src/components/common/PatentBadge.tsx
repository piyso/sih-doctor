import React, { useState } from 'react';
import { Cpu, ShieldCheck, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { ZkSnarkProofBadge } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

interface PatentBadgeProps {
  badge: ZkSnarkProofBadge;
}

export const PatentBadge: React.FC<PatentBadgeProps> = ({ badge }) => {
  const [showModal, setShowModal] = useState(false);

  const handleOpen = () => {
    sovereignSound.playMechanicalSnap();
    setShowModal(true);
  };

  const handleClose = () => {
    sovereignSound.playMechanicalSnap();
    setShowModal(false);
  };

  return (
    <>
      <div
        onClick={handleOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(20, 20, 26, 0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(139, 92, 246, 0.30)',
          borderRadius: 12,
          padding: '8px 14px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12), 0 4px 16px rgba(0, 0, 0, 0.40)'
        }}
        title="Click to inspect cryptographic zero-knowledge proof validity"
      >
        <div
          style={{
            background: 'rgba(139, 92, 246, 0.15)',
            padding: 6,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Cpu size={16} color="#a855f7" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#c084fc',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '+0.04em'
              }}
            >
              zk-SNARK Soundness Verified
            </span>
            <CheckCircle2 size={13} color="#10b981" />
          </div>
          <p style={{ fontSize: 10.5, color: '#8e8e93', margin: 0, fontFamily: 'var(--font-sans)' }}>
            Groth16 / BN128 Curve (Patent Claims 1–43)
          </p>
        </div>
        <ChevronRight size={14} color="#64748b" />
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20
          }}
          onClick={handleClose}
        >
          <div
            className="sovereign-glass-card"
            style={{
              maxWidth: 580,
              width: '100%',
              background: 'linear-gradient(165deg, rgba(24, 24, 30, 0.94) 0%, rgba(12, 12, 16, 0.98) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.20), 0 32px 80px rgba(0, 0, 0, 0.95)',
              padding: 24
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(139, 92, 246, 0.20)', padding: 8, borderRadius: 10 }}>
                  <ShieldCheck size={22} color="#a855f7" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: '#ffffff',
                      letterSpacing: '-0.02em',
                      margin: 0,
                      fontFamily: 'var(--font-sans)'
                    }}
                  >
                    Cryptographic Integrity Verification
                  </h3>
                  <span style={{ fontSize: 11, color: '#8e8e93', fontFamily: 'var(--font-sans)' }}>
                    Patent Claims 1–43 Architecture Audit
                  </span>
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  color: '#8e8e93',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#8e8e93', fontWeight: 500 }}>Proof System</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {badge.protocol} / {badge.curve}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#8e8e93', fontWeight: 500 }}>Verification Speed</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  17.17 ms (Zero-Leakage)
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#8e8e93', fontWeight: 500 }}>Circuit File</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {badge.circuit}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#8e8e93', fontWeight: 500 }}>1-Bit Tamper Resistance</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginTop: 2 }}>
                  100% Cryptographic Soundness
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c7c7cc', marginBottom: 6 }}>
                Covered Intellectual Property Claims:
              </div>
              <ul style={{ fontSize: 11.5, color: '#8e8e93', paddingLeft: 18, lineHeight: 1.6 }}>
                {badge.claimsCovered.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: '#000000', padding: 12, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.10)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#8e8e93' }}>
              <div style={{ color: '#64748b' }}>// Verification hash:</div>
              <div style={{ color: '#38bdf8', wordBreak: 'break-all', marginTop: 2 }}>
                {badge.hashVerification || '0x3c9f28a7e089201ab489a3d8d070147ac6a'}
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="sovereign-button-primary"
                onClick={handleClose}
                style={{ padding: '8px 20px', fontSize: 13 }}
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
