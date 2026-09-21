import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  ShieldCheck,
  User,
  Activity,
  HeartPulse,
  ActivitySquare,
  ShieldAlert,
  Fingerprint,
  ArrowUpRight,
  Monitor,
  Tablet,
  BoxSelect,
  Laptop
} from 'lucide-react';
import { sovereignSound } from '../../utils/audio';

interface TerminalOption {
  id: 'kiosk' | 'doctor' | 'pharmacy' | 'asha' | 'admin' | 'matrix';
  code: string;
  shortcutKey: string;
  title: string;
  shortTitle: string;
  hindiTitle: string;
  role: string;
  device: string;
  summary: string;
  liveMetric: string;
  icon: React.ReactNode;
  DeviceIcon: React.ReactNode;
}

const TERMINAL_OPTIONS: TerminalOption[] = [
  {
    id: 'kiosk',
    code: '01',
    shortcutKey: '1',
    title: 'Patient MediKiosk',
    shortTitle: 'MediKiosk',
    hindiTitle: 'मरीज़ कियोस्क',
    role: 'Lobby Patient / Caregiver',
    device: '32" Touchscreen',
    summary: '35-second ATM touch intake in 22 languages with 3D body mannequin & instant thermal ticket.',
    liveMetric: '35s Intake · 22 Lang',
    icon: <User size={20} strokeWidth={2} />,
    DeviceIcon: <Monitor size={12} />
  },
  {
    id: 'doctor',
    code: '02',
    shortcutKey: '2',
    title: 'Doctor Clinical Cockpit',
    shortTitle: 'Doctor Desk',
    hindiTitle: 'चिकित्सक परामर्श',
    role: 'OPD Resident / Vaidya',
    device: 'Chamber All-in-One PC',
    summary: '90-second calm consultation studio with ambient bilingual scribe, lethal clash interlock, & Spacebar print.',
    liveMetric: 'Room 14 Active',
    icon: <Activity size={20} strokeWidth={2} />,
    DeviceIcon: <Laptop size={12} />
  },
  {
    id: 'pharmacy',
    code: '03',
    shortcutKey: '3',
    title: 'Dispensary Counter POS',
    shortTitle: 'Pharmacy POS',
    hindiTitle: 'औषधालय काउंटर',
    role: 'Dispensary Pharmacist',
    device: 'Barcode POS + Label Printer',
    summary: 'Optical barcode scan gate, sound-alike (LASA) siren interlock, & peel-and-stick labels with Anupana.',
    liveMetric: 'LASA Interlock Active',
    icon: <BoxSelect size={20} strokeWidth={2} />,
    DeviceIcon: <BoxSelect size={12} />
  },
  {
    id: 'asha',
    code: '04',
    shortcutKey: '4',
    title: 'Frontline ASHA Outreach',
    shortTitle: 'ASHA Field',
    hindiTitle: 'आशा ग्रामीण सेवा',
    role: 'Rural ASHA / ANM Worker',
    device: '8" Rugged Field Tablet',
    summary: 'Sunlight-readable outdoor mode, rapid 3-field maternal intake, & 1.8s offline Merkle DAG sync.',
    liveMetric: '1.8s Offline Sync',
    icon: <HeartPulse size={20} strokeWidth={2} />,
    DeviceIcon: <Tablet size={12} />
  },
  {
    id: 'admin',
    code: '05',
    shortcutKey: '5',
    title: 'Command & Outbreak NOC',
    shortTitle: 'Command NOC',
    hindiTitle: 'निगरानी केंद्र',
    role: 'Hospital Director / CMO',
    device: 'Executive Multi-Monitor Wall',
    summary: 'Live room flow, doctor burnout pacing (<45s), 1-click reserve dispatch, & IDSP disease radar.',
    liveMetric: 'IDSP Radar Active',
    icon: <ActivitySquare size={20} strokeWidth={2} />,
    DeviceIcon: <Monitor size={12} />
  },
  {
    id: 'matrix',
    code: '06',
    shortcutKey: '6',
    title: 'System Defense Matrix',
    shortTitle: 'Audit Matrix',
    hindiTitle: 'सुरक्षा प्रमाण',
    role: 'Technical Jury & Auditor',
    device: 'Air-Gapped Audit Terminal',
    summary: 'Zero cloud egress verification, Groth16 zk-SNARK cryptographic curve checks, & Verhoeff D5 audits.',
    liveMetric: 'Zero Cloud Egress',
    icon: <Fingerprint size={20} strokeWidth={2} />,
    DeviceIcon: <ShieldAlert size={12} />
  }
];

interface HospitalOsGatewayProps {
  onLaunchTerminal: (terminalId: 'kiosk' | 'doctor' | 'pharmacy' | 'asha' | 'admin' | 'matrix' | 'byod') => void;
  onOpenByodModal?: () => void;
}

export const HospitalOsGateway: React.FC<HospitalOsGatewayProps> = ({
  onLaunchTerminal,
  onOpenByodModal
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="gateway-container">
      <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%' }}>
        {/* Prestige Institutional Brand Header - Masterpiece Duotone */}
        <header className="gateway-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12 }}>
            {/* Duotone Sovereign Seal */}
            <div
              style={{
                width: isMobile ? 36 : 40,
                height: isMobile ? 36 : 40,
                borderRadius: 10,
                background: '#090d16',
                border: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9.5" stroke="#94a3b8" strokeWidth="1.25" strokeDasharray="2 2" />
                <path d="M12 5V19M5 12H19" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="12" r="2.5" fill="#ffffff" />
              </svg>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, letterSpacing: '-0.03em', color: '#090d16' }}>
                  AIIA Hospital OS
                </span>
                {!isMobile && (
                  <>
                    <span className="gateway-badge-pill">
                      PS-26047
                    </span>
                    <span className="gateway-badge-pill">
                      ABDM-R4
                    </span>
                  </>
                )}
              </div>
              <p style={{ fontSize: isMobile ? 11 : 12, color: '#64748b', margin: '1px 0 0 0', fontWeight: 500, letterSpacing: '-0.01em' }}>
                All India Institute of Ayurveda · Ministry of Ayush &amp; MoHFW
              </p>
            </div>
          </div>

          {/* Right Header Status & BYOD Capsule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8 }}>
            {!isMobile && (
              <div className="gateway-status-pill">
                <span className="gateway-status-dot" />
                <span>Air-Gapped Node</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                sovereignSound.playMechanicalSnap();
                onOpenByodModal?.();
              }}
              className="gateway-byod-btn"
            >
              <Smartphone size={isMobile ? 13 : 14} />
              <span>BYOD Mobile</span>
            </button>
          </div>
        </header>

        {/* Refined Duotone Headline Section */}
        <div className="gateway-headline-section">
          <div className="gateway-headline-tag">
            <span>CLINICAL TERMINAL GATEWAY</span>
          </div>
          <h1 style={{ fontSize: isMobile ? 20 : 25, fontWeight: 700, color: '#090d16', letterSpacing: '-0.035em', margin: '6px 0 0 0' }}>
            Hospital Workstation Matrix
          </h1>
          <p style={{ fontSize: isMobile ? 12.5 : 13.5, color: '#64748b', margin: '4px auto 0 auto', maxWidth: 480, lineHeight: 1.5, fontWeight: 500 }}>
            Dedicated air-gapped clinical consoles. Press <kbd className="gateway-kbd">1</kbd> to <kbd className="gateway-kbd">6</kbd> for quick launch.
          </p>
        </div>

        {/* Responsive Workstation Grid: List on Mobile, Grid on Desktop */}
        <div className="gateway-grid">
          {TERMINAL_OPTIONS.map((terminal) => {
            const isHovered = hoveredId === terminal.id;
            const IconEl = terminal.icon;

            return (
              <div
                key={terminal.id}
                onMouseEnter={() => setHoveredId(terminal.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => {
                  sovereignSound.playCrystalChime();
                  onLaunchTerminal(terminal.id);
                }}
                className={`gateway-card ${isHovered ? 'hovered' : ''}`}
              >
                {/* Duotone Card Top Bar */}
                <div className="gateway-card-topbar">
                  <div className="gateway-card-icon-wrapper">
                    {IconEl}
                  </div>
                  <div className="gateway-code-capsule">
                    <span>{terminal.code}</span>
                    <span className="gateway-kbd-mini">[{terminal.shortcutKey}]</span>
                  </div>
                </div>

                <div className="gateway-card-content">
                  <div className="gateway-card-device">
                    {terminal.DeviceIcon}
                    <span>{terminal.device}</span>
                  </div>

                  <h3 className="gateway-card-title">
                    {terminal.title}
                  </h3>

                  <div className="gateway-card-subtitle">
                    <span className="gateway-hindi-pill">
                      {terminal.hindiTitle}
                    </span>
                    <span className="gateway-role-text">· {terminal.role}</span>
                  </div>

                  <p className="gateway-card-summary">
                    {terminal.summary}
                  </p>

                  <div className="gateway-card-footer">
                    {/* Live Metric */}
                    <div className="gateway-live-metric">
                      <span className="gateway-live-dot" />
                      <span>{terminal.liveMetric}</span>
                    </div>

                    {/* Launch Action */}
                    <div className="gateway-launch-badge">
                      <span>Launch</span>
                      <ArrowUpRight size={13} strokeWidth={2.2} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clean Hospital Institutional Footer */}
      <footer className="gateway-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <ShieldCheck size={13} color="#475569" />
          <span>Sovereign Hospital OS · Air-Gapped Network</span>
        </div>
        {!isMobile && (
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Keys <kbd className="gateway-kbd">1</kbd>–<kbd className="gateway-kbd">6</kbd> to launch · <kbd className="gateway-kbd">Esc</kbd> for Gateway
          </div>
        )}
      </footer>
    </div>
  );
};



