import React, { useState } from 'react';
import { AlertOctagon, ShieldAlert, X, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { ConflictAlert } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

interface ConflictAlertModalProps {
  alert: ConflictAlert;
  onClose: () => void;
  onOverride: (reason: string) => void;
  onRemoveHerb: (herbName: string) => void;
}

export const ConflictAlertModal: React.FC<ConflictAlertModalProps> = ({
  alert,
  onClose,
  onOverride,
  onRemoveHerb
}) => {
  const [overrideReason, setOverrideReason] = useState('');
  const isLethal = alert.severity === 'CRITICAL_LETHAL';

  const handleRemove = () => {
    sovereignSound('chime');
    onRemoveHerb(alert.ayushHerb);
  };

  const handleOverrideClick = () => {
    sovereignSound('shutter');
    onOverride(overrideReason);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 20
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 640,
          width: '100%',
          border: isLethal ? '1.5px solid #f43f5e' : '1.5px solid #f59e0b',
          boxShadow: isLethal
            ? '0 0 40px rgba(244, 63, 94, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)'
            : '0 0 40px rgba(245, 158, 11, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          background: 'linear-gradient(165deg, rgba(28, 18, 22, 0.94) 0%, rgba(14, 12, 16, 0.98) 100%)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: isLethal ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${isLethal ? 'rgba(244, 63, 94, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                padding: 10,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ShieldAlert size={24} color={isLethal ? '#fb7185' : '#fbbf24'} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: isLethal ? '#fb7185' : '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Bayesian Truth Engine Safety Shield
              </span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', margin: '2px 0 0 0' }}>
                {isLethal ? 'Critical Herb-Drug Contraindication' : 'Herb-Drug Interaction Alert'}
              </h3>
            </div>
          </div>
          <button
            onClick={() => {
              sovereignSound('notch');
              onClose();
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Pair Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Allopathic Drug</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>{alert.allopathicDrug}</div>
          </div>
          <div
            className={isLethal ? 'badge badge-emergency' : 'badge badge-high'}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 800, gap: 6, letterSpacing: '0.04em' }}
          >
            <AlertTriangle size={14} />
            <span>{isLethal ? 'FATAL CONTRAINDICATION' : 'CLINICAL CONFLICT'}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>AYUSH Herb / Formulation</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399', marginTop: 2 }}>{alert.ayushHerb}</div>
          </div>
        </div>

        {/* Mechanism & Consequence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 14, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>
              Pharmacological Mechanism:
            </div>
            <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
              {alert.mechanism}
            </p>
          </div>

          <div
            style={{
              background: isLethal ? 'rgba(244, 63, 94, 0.10)' : 'rgba(245, 158, 11, 0.10)',
              padding: 14,
              borderRadius: 10,
              border: `1px solid ${isLethal ? 'rgba(244, 63, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: isLethal ? '#fb7185' : '#fbbf24', textTransform: 'uppercase', marginBottom: 4 }}>
              Clinical Consequence:
            </div>
            <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 700, lineHeight: 1.5 }}>
              {alert.clinicalConsequence}
            </p>
          </div>

          <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: 14, borderRadius: 10, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 4 }}>
              Statutory Clinical Recommendation:
            </div>
            <p style={{ fontSize: 13, color: '#e0f2fe', lineHeight: 1.5 }}>
              {alert.recommendedAction}
            </p>
            <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 8, fontWeight: 600 }}>
              Bayesian Truth Confidence: <strong style={{ color: '#ffffff' }}>{(alert.bayesianConfidence * 100).toFixed(1)}%</strong> • Beta-Binomial Evidence Base
            </div>
          </div>
        </div>

        {/* Mandatory Clinical Override Input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#c7c7cc', marginBottom: 6 }}>
            Mandatory Clinical Override Justification (if proceeding):
          </label>
          <input
            type="text"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g. Daily INR monitoring instituted; dose reduced by 50%"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={handleRemove}
            className="btn btn-primary"
            style={{ padding: '10px 20px', fontSize: 13, gap: 6 }}
          >
            <Check size={16} />
            <span>Remove {alert.ayushHerb.split(' ')[0]} (Recommended Action)</span>
          </button>

          <button
            onClick={handleOverrideClick}
            className="btn btn-danger"
            style={{ padding: '10px 20px', fontSize: 13 }}
            disabled={!overrideReason.trim()}
          >
            <span>Log Override & Proceed</span>
          </button>
        </div>
      </div>
    </div>
  );
};
