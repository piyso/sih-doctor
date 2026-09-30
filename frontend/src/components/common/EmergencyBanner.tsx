import React, { useEffect } from 'react';
import { AlertOctagon, ArrowRight, AlertTriangle } from 'lucide-react';
import { sovereignSound } from '../../utils/audio';

interface EmergencyBannerProps {
  redFlags: string[];
  patientName?: string;
  onDivertClick?: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  redFlags,
  patientName,
  onDivertClick
}) => {
  useEffect(() => {
    if (redFlags && redFlags.length > 0) {
      sovereignSound.playClinicalAlert();
    }
  }, [redFlags]);

  if (!redFlags || redFlags.length === 0) return null;

  return (
    <aside
      aria-label="Critical Emergency Alert"
      className="no-print"
      style={{
        margin: '0 auto 16px auto',
        maxWidth: 1440,
        width: '100%',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        borderRadius: 14,
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 300px' }}>
        <div
          style={{
            background: '#0f172a',
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <AlertOctagon size={18} color="#ffffff" strokeWidth={2} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#475569',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '+0.06em'
              }}
            >
              CRITICAL EMERGENCY TRIAGE · ESI TIER 1
            </span>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#0f172a'
              }}
            />
          </div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#0f172a',
              margin: '2px 0 0 0',
              letterSpacing: '-0.015em',
              fontFamily: 'var(--font-sans)'
            }}
          >
            {patientName ? `${patientName}: Immediate Red Bay Referral` : 'Immediate Red Bay Resuscitation Referral'}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
            {redFlags.map((flag, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#f8fafc',
                  padding: '2px 8px',
                  borderRadius: 6,
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-sans)'
                }}
              >
                <AlertTriangle size={11} color="#64748b" />
                <span>{flag}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => {
            sovereignSound.playMechanicalSnap();
            onDivertClick?.();
          }}
          style={{
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 8,
            background: '#0f172a',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.16s ease'
          }}
        >
          <span>Divert to Red Bay</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </aside>
  );
};

