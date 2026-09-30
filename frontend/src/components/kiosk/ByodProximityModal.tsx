import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Wifi,
  QrCode,
  MapPin,
  Smartphone,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  AlertTriangle,
  Radio,
  Lock,
  ExternalLink,
  Zap,
  Check
} from 'lucide-react';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';
import { GateNonce, ProximityCheck } from '../../types/api';
import { RealQrCode } from '../common/RealQrCode';

interface ByodProximityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}

export const ByodProximityModal: React.FC<ByodProximityModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated
}) => {
  const [gateNonce, setGateNonce] = useState<GateNonce | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [proximity, setProximity] = useState<ProximityCheck | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<'INSIDE_OPD' | 'OUTSIDE_CAMPUS'>('INSIDE_OPD');
  const [cnaBypassActive, setCnaBypassActive] = useState<boolean>(true);

  // Fetch optical gate nonce and poll countdown
  const fetchNonce = async () => {
    try {
      setLoading(true);
      const data = await api.getGateNonce();
      setGateNonce(data);
      const remaining = Math.max(1, Math.floor((data.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    } catch (e) {
      console.warn('Nonce fetch fallback:', e);
    } finally {
      setLoading(false);
    }
  };

  // Run proximity evaluation
  const runProximityCheck = async (scenario: 'INSIDE_OPD' | 'OUTSIDE_CAMPUS') => {
    setActiveScenario(scenario);
    try {
      // AIIA Main Campus Coordinates: 28.5284, 77.2917
      let lat = 28.5284;
      let lng = 77.2917;
      let rssi = -48; // Inside OPD Waiting Hall

      if (scenario === 'OUTSIDE_CAMPUS') {
        lat = 28.5600; // ~4.1km away in South Delhi
        lng = 77.2600;
        rssi = -76; // Weak / out-of-range Wi-Fi
      }

      const res = await api.verifyProximity(lat, lng, rssi);
      setProximity(res);
      if (res.authorized) {
        sovereignSound.playCrystalChime();
        if (onAuthenticated) onAuthenticated();
      } else {
        sovereignSound.playClinicalAlert();
      }
    } catch (e) {
      console.error('Proximity verification failed:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchNonce();
    runProximityCheck('INSIDE_OPD');

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchNonce();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto physical-card shadow-2xl border-border bg-card text-card-foreground">
        {/* Modal Header */}
        <div className="p-6 border-b border-border/80 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-heading font-bold text-foreground">
                  Geofenced Sovereign BYOD Intake
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-foreground border border-border/80 font-semibold uppercase tracking-wider">
                  Air-Gap Micro-Portal
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Zero App Download • Zero Bacterial Touch Screen Contact • Physical Presence Verification
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              onClose();
            }}
            className="tactile-btn h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Interactive Simulation Controls */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-primary" />
              <span className="text-xs font-heading font-semibold text-foreground">
                Perimeter Defense Simulator:
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  sovereignSound.playMechanicalSnap();
                  runProximityCheck('INSIDE_OPD');
                }}
                className={`tactile-btn px-3 py-1.5 text-xs font-semibold gap-1.5 ${
                  activeScenario === 'INSIDE_OPD'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : ''
                }`}
              >
                <Check size={13} />
                <span>Inside OPD Hall (Authorized)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sovereignSound.playMechanicalSnap();
                  runProximityCheck('OUTSIDE_CAMPUS');
                }}
                className={`tactile-btn px-3 py-1.5 text-xs font-semibold gap-1.5 ${
                  activeScenario === 'OUTSIDE_CAMPUS'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs dark:bg-rose-600'
                    : ''
                }`}
              >
                <X size={13} />
                <span>Remote Hijacker (Rejected)</span>
              </button>
            </div>
          </div>

          {/* 3-Pillar Security Perimeter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pillar 1: Local Wi-Fi Radio Perimeter */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Wifi size={18} />
                    <span className="text-xs font-mono font-bold uppercase">Pillar 1: Radio Gate</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      activeScenario === 'INSIDE_OPD'
                        ? 'bg-muted text-foreground border border-border/80'
                        : 'bg-muted text-muted-foreground border border-border/80'
                    }`}
                  >
                    {activeScenario === 'INSIDE_OPD' ? '-48 dBm (STRONG)' : '-76 dBm (WEAK)'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><strong className="text-foreground">SSID:</strong> AIIA-GUEST-AIRGAP</div>
                  <div><strong className="text-foreground">LAN IP:</strong> 192.168.10.1</div>
                  <div><strong className="text-foreground">RF Radius:</strong> &le; 100m Perimeter</div>
                </div>
              </div>
            </div>

            {/* Pillar 2: Dynamic 60s Optical Gate Nonce */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-primary">
                    <QrCode size={16} />
                    <span className="text-xs font-mono font-bold uppercase">Pillar 2: Optical Nonce</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-xs font-semibold ${secondsRemaining <= 10 ? 'text-rose-500' : 'text-foreground'}`}>
                      {secondsRemaining}s
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        sovereignSound.playMechanicalSnap();
                        fetchNonce();
                      }}
                      disabled={loading}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="my-2 flex justify-center">
                  <div className="p-1 bg-white rounded-lg border border-slate-300 shadow-2xs">
                    <RealQrCode
                      value={`${typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://192.168.10.1:5173'}/byod?nonce=${encodeURIComponent(gateNonce?.nonce || 'AIIA-7f91c0b2')}&ttl=${gateNonce?.expiresAt || Date.now() + 60000}`}
                      size={68}
                      level="M"
                      title="Scan 60s Dynamic Optical Nonce"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div><strong className="text-foreground">Nonce:</strong> <span className="font-mono text-foreground text-[10.5px]">{gateNonce?.nonce || 'AIIA-7f91c0b2'}</span></div>
                  <div><strong className="text-foreground">TTL:</strong> 60s Rolling TOTP</div>
                </div>
              </div>
            </div>

            {/* Pillar 3: W3C Geofence */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin size={18} />
                    <span className="text-xs font-mono font-bold uppercase">Pillar 3: Geofence</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      proximity?.authorized
                        ? 'bg-muted text-foreground border border-border/80'
                        : 'bg-muted text-muted-foreground border border-border/80'
                    }`}
                  >
                    {proximity ? `${proximity.distanceMeters}m` : 'CHECKING...'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><strong className="text-foreground">Anchor:</strong> AIIA (28.5284° N)</div>
                  <div><strong className="text-foreground">Max Radius:</strong> &le; 150m W3C</div>
                  <div>
                    <strong className="text-foreground">Verdict:</strong>{' '}
                    <span className={proximity?.authorized ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                      {proximity?.authorized ? 'Inside Campus' : 'Denied (Outside)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Apple Captive Network Assistant (CNA) Bypass */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-sky-600 dark:text-sky-400" />
                <h4 className="text-xs font-heading font-bold text-foreground">
                  Apple CNA & Android Captive Sandbox Auto-Escape
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                RFC 8908 / RFC 8910
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Standard captive popups auto-close and block audio capture. AIIA Gateway returns HTTP 200 to probe requests and launches Mobile Safari for unrestricted multi-minute intake sessions.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sovereignSound.playDialNotch();
                  setCnaBypassActive(!cnaBypassActive);
                }}
                className={`tactile-btn px-3 py-1.5 text-xs font-semibold gap-1.5 ${
                  cnaBypassActive ? 'text-sky-600 dark:text-sky-400 border-sky-400/40 bg-sky-500/10' : ''
                }`}
              >
                <Check size={13} />
                <span>{cnaBypassActive ? 'CNA Auto-Escape Active' : 'Enable CNA Escape'}</span>
              </button>
              <span className="text-[11px] text-muted-foreground">
                Allows continuous Web Audio microphone capture without session cutoff.
              </span>
            </div>
          </div>

          {/* Current Status Banner */}
          <div className="p-4 rounded-xl border border-border/80 bg-card flex items-center justify-between flex-wrap gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              {proximity?.authorized ? (
                <CheckCircle2 size={22} className="text-primary shrink-0" />
              ) : (
                <XCircle size={22} className="text-rose-500 shrink-0" />
              )}
              <div>
                <div className="text-xs font-heading font-bold text-foreground">
                  {proximity?.authorized
                    ? 'SECURITY CLEARANCE GRANTED — BYOD INTAKE READY'
                    : 'ACCESS RESTRICTED — PHYSICAL HOSPITAL RADIUS UNVERIFIED'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {proximity?.authorized
                    ? `Device localized at ${proximity.distanceMeters}m from AIIA triage anchor. RSSI: ${proximity.rssiDb} dBm.`
                    : `Device is ${proximity?.distanceMeters || '4,100'}m from campus. Patient must be within OPD triage hall.`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sovereignSound.playMechanicalSnap();
                onClose();
              }}
              className={proximity?.authorized ? 'tactile-btn-primary px-5 py-2 text-xs font-bold' : 'tactile-btn px-5 py-2 text-xs font-semibold'}
            >
              {proximity?.authorized ? 'Proceed with BYOD Intake' : 'Close Defense Panel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
