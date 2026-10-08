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

export type TerminalId = 'kiosk' | 'doctor' | 'nurse' | 'pharmacy' | 'display' | 'asha' | 'admin' | 'matrix';

interface TerminalOption {
  id: TerminalId;
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

export const TERMINAL_OPTIONS: TerminalOption[] = [
  {
    id: 'kiosk', code: '01', shortcutKey: '1',
    title: 'Patient Check-in Kiosk', shortTitle: 'Kiosk', hindiTitle: 'मरीज़ कियोस्क',
    role: 'Patients & caregivers', device: 'Touchscreen kiosk',
    summary: 'Self check-in in 11 Indian languages: body map, voice, vitals, history and documents. Prints a token with room and wait time.',
    liveMetric: 'No sign-in needed',
    icon: <User size={20} strokeWidth={2} />, DeviceIcon: <Monitor size={12} />
  },
  {
    id: 'doctor', code: '02', shortcutKey: '2',
    title: 'Doctor / Vaidya Desk', shortTitle: 'Doctor Desk', hindiTitle: 'चिकित्सक परामर्श',
    role: 'Doctors and vaidyas', device: 'Consultation-room PC',
    summary: 'Queue with priorities, pre-visit summary, call patient to the room, interaction checks, signed prescription and ABDM record.',
    liveMetric: 'Staff sign-in',
    icon: <Activity size={20} strokeWidth={2} />, DeviceIcon: <Laptop size={12} />
  },
  {
    id: 'nurse', code: '03', shortcutKey: '3',
    title: 'Nurse Station', shortTitle: 'Nurse Station', hindiTitle: 'नर्स स्टेशन',
    role: 'Nurses & triage staff', device: 'Nurse-station PC',
    summary: 'Live SOS alarms from kiosks with acknowledge and resolve, and measured vitals entry for waiting patients.',
    liveMetric: 'Live alerts',
    icon: <ShieldAlert size={20} strokeWidth={2} />, DeviceIcon: <Laptop size={12} />
  },
  {
    id: 'pharmacy', code: '04', shortcutKey: '4',
    title: 'Pharmacy Counter', shortTitle: 'Pharmacy', hindiTitle: 'औषधालय काउंटर',
    role: 'Pharmacists', device: 'Counter PC + label printer',
    summary: 'Signed prescriptions arrive automatically. Check the signature, review interaction warnings, and record what was dispensed.',
    liveMetric: 'Staff sign-in',
    icon: <BoxSelect size={20} strokeWidth={2} />, DeviceIcon: <BoxSelect size={12} />
  },
  {
    id: 'display', code: '05', shortcutKey: '5',
    title: 'Waiting-room Display', shortTitle: 'Queue Display', hindiTitle: 'कतार डिस्प्ले',
    role: 'Waiting hall TV', device: 'TV / large screen',
    summary: 'Now serving and next tokens per room, with spoken announcements in local languages. Shows token numbers only, never names.',
    liveMetric: 'No names shown',
    icon: <Monitor size={20} strokeWidth={2} />, DeviceIcon: <Monitor size={12} />
  },
  {
    id: 'asha', code: '06', shortcutKey: '6',
    title: 'ASHA Field App', shortTitle: 'ASHA Field', hindiTitle: 'आशा ग्रामीण सेवा',
    role: 'ASHA / ANM workers', device: 'Phone or tablet',
    summary: 'Record village visits and pregnancy risk screening without network; records sync to the hospital when back in range.',
    liveMetric: 'Works offline',
    icon: <HeartPulse size={20} strokeWidth={2} />, DeviceIcon: <Tablet size={12} />
  },
  {
    id: 'admin', code: '07', shortcutKey: '7',
    title: 'Hospital Administration', shortTitle: 'Admin', hindiTitle: 'प्रशासन',
    role: 'Medical superintendent / admin', device: 'Office PC',
    summary: 'Today\'s numbers from real records, staff accounts, kiosk enrolment, audit trail, patient data requests and backups.',
    liveMetric: 'Staff sign-in',
    icon: <ActivitySquare size={20} strokeWidth={2} />, DeviceIcon: <Monitor size={12} />
  },
  {
    id: 'matrix', code: '08', shortcutKey: '8',
    title: 'Architecture Notes', shortTitle: 'Architecture', hindiTitle: 'तकनीकी विवरण',
    role: 'Technical reviewers', device: 'Any',
    summary: 'How the system is built: data flow, security controls and the research components behind it.',
    liveMetric: 'Reference',
    icon: <Fingerprint size={20} strokeWidth={2} />, DeviceIcon: <ShieldAlert size={12} />
  }
];

interface HospitalOsGatewayProps {
  onLaunchTerminal: (terminalId: TerminalId | 'byod') => void;
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
            {/* Authentic Ashok Stambh Seal */}
            <div
              style={{
                width: isMobile ? 40 : 44,
                height: isMobile ? 40 : 44,
                borderRadius: 12,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                padding: 4
              }}
            >
              <img
                src="/ashoka-stambh-hd.png"
                alt="State Emblem of India"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, letterSpacing: '-0.03em', color: '#090d16' }}>
                  Sovereign Hospital OS
                </span>
                {!isMobile && (
                  <>
                    <span className="gateway-badge-pill">
                      SOVEREIGN
                    </span>
                    <span className="gateway-badge-pill">
                      ABDM-R4
                    </span>
                  </>
                )}
              </div>
              <p style={{ fontSize: isMobile ? 11 : 12, color: '#64748b', margin: '1px 0 0 0', fontWeight: 500, letterSpacing: '-0.01em' }}>
                Madhya Pradesh Public Health &amp; AIIA · Ministry of Ayush &amp; MoHFW
              </p>
            </div>
          </div>

          {/* Right Header Status & BYOD Capsule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8 }}>
            {!isMobile && (
              <div className="gateway-status-pill">
                <span className="gateway-status-dot" />
                <span>On-premise server</span>
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
            Choose this computer's role
          </h1>
          <p style={{ fontSize: isMobile ? 12.5 : 13.5, color: '#64748b', margin: '4px auto 0 auto', maxWidth: 480, lineHeight: 1.5, fontWeight: 500 }}>
            Open the screen for this computer's job. Press <kbd className="gateway-kbd">1</kbd> to <kbd className="gateway-kbd">8</kbd> for quick launch.
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
          <span>Sovereign Hospital OS · runs on the hospital's own server</span>
        </div>
        {!isMobile && (
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Keys <kbd className="gateway-kbd">1</kbd>–<kbd className="gateway-kbd">8</kbd> to launch · <kbd className="gateway-kbd">Esc</kbd> for Gateway
          </div>
        )}
      </footer>
    </div>
  );
};



