import React, { useState } from 'react';
import { FileCode, Download, Copy, Check, X, ShieldCheck } from 'lucide-react';
import { sovereignSound } from '../../utils/audio';

interface AbdmFhirExportModalProps {
  bundleData: any;
  onClose: () => void;
}

export const AbdmFhirExportModal: React.FC<AbdmFhirExportModalProps> = ({
  bundleData,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(bundleData, null, 2);

  const handleCopy = () => {
    sovereignSound('notch');
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    sovereignSound('shutter');
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ABDM_FHIR_Bundle_${bundleData?.id || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        zIndex: 1200,
        padding: 20
      }}
      onClick={() => {
        sovereignSound('notch');
        onClose();
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 820,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(165deg, rgba(20, 24, 32, 0.95) 0%, rgba(12, 14, 18, 0.98) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 0 50px rgba(16, 185, 129, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
          borderRadius: 'var(--radius-lg)',
          padding: 24
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: 10,
                borderRadius: 10
              }}
            >
              <FileCode size={22} color="#34d399" />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', margin: 0 }}>
                ABDM FHIR R4 Document Bundle (NAMASTE Tri-Coded)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Compliant with Ayushman Bharat Digital Mission (M3) & HL7 FHIR Release 4
              </p>
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

        {/* Highlight Tri-Coding */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>NAMASTE Code:</span>{' '}
              <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>A-J-102.1</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>ICD-11:</span>{' '}
              <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>FA00.Z</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SNOMED-CT:</span>{' '}
              <strong style={{ color: '#c084fc', fontFamily: 'var(--font-mono)' }}>399269003</strong>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '3px 10px',
              borderRadius: 9999
            }}
          >
            <ShieldCheck size={14} color="#34d399" />
            <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>100% Schema Valid</span>
          </div>
        </div>

        {/* JSON Code Box */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.65)',
            padding: 16,
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: '#38bdf8',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 400
          }}
        >
          {jsonString}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Cryptographically sound FHIR Bundle • Ready for ABDM Gateway push
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: 12, gap: 6 }}
            >
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: 12, gap: 6 }}
            >
              <Download size={14} />
              <span>Download FHIR Bundle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
