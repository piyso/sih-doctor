import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Cpu, 
  Lock, 
  Volume2, 
  Building2, 
  Users, 
  CheckCircle2, 
  FileCheck2,
  HeartPulse
} from 'lucide-react';
import { sovereignSound } from '../../utils/audio';

interface KioskSideRailsProps {
  onDivertEmergency?: () => void;
}

export const KioskLeftRail: React.FC<KioskSideRailsProps> = ({ onDivertEmergency }) => {
  return (
    <aside className="kiosk-side-rail kiosk-side-rail-left no-print" aria-label="Hospital Station Telemetry">
      {/* 1. Terminal Identity Card */}
      <div className="physical-card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-xs font-heading font-bold text-foreground">
              AIIA Central OPD
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Terminal #04 · Ground Floor
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/60 border border-border/70">
          <span className="text-[10.5px] text-foreground font-medium">
            Air-Gapped Sovereign Engine
          </span>
          <span className="text-[10px] font-mono text-muted-foreground font-semibold">
            0.017ms
          </span>
        </div>
      </div>

      {/* 2. Live OPD Census Glance */}
      <div className="physical-card p-4 flex flex-col gap-3">
        <div className="text-[10.5px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
          Live Hospital Census
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/75">
            <div className="text-[10px] text-muted-foreground">Registered Today</div>
            <div className="font-mono text-base font-extrabold text-foreground mt-0.5">5,420</div>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/75">
            <div className="text-[10px] text-muted-foreground">Avg Wait Time</div>
            <div className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">14m</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Users size={13} className="text-muted-foreground shrink-0" />
          <span>Active Consulting Rooms: <strong className="text-foreground">18/18</strong></span>
        </div>
      </div>

      {/* 3. Emergency SOS Immediate Divert */}
      <div className="physical-card p-4 border-rose-400/40 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="text-xs font-heading font-bold text-rose-700 dark:text-rose-400">
            तीव्र आपातकाल (Acute SOS)
          </span>
        </div>
        <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
          यदि अत्यधिक सीने में दर्द, सांस फूलना या बेहोशी हो, तो तुरंत आपातकालीन कक्ष में जाएं।
        </p>
        <button
          type="button"
          onClick={() => {
            sovereignSound.playClinicalAlert();
            onDivertEmergency?.();
          }}
          className="btn-danger w-full py-2 px-3 text-xs font-bold rounded-xl mt-1 cursor-pointer"
        >
          <span>आपातकालीन कक्ष (Divert ER)</span>
        </button>
      </div>
    </aside>
  );
};

export const KioskRightRail: React.FC = () => {
  return (
    <aside className="kiosk-side-rail kiosk-side-rail-right no-print" aria-label="Statutory Security & Protocols">
      {/* 1. Statutory Security Credentials */}
      <div className="physical-card p-4 flex flex-col gap-3">
        <div className="text-[10.5px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
          Statutory Standards
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <Lock size={13} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[11.5px] font-semibold text-foreground">DPDP Act 2023 (§6, §8)</div>
              <div className="text-[10px] text-muted-foreground">Zero cloud egress. 100% on-device.</div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <ShieldCheck size={13} className="text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[11.5px] font-semibold text-foreground">ABDM 2.0 (M3) Verified</div>
              <div className="text-[10px] text-muted-foreground">Verhoeff D5 Dihedral ID Lock.</div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Sparkles size={13} className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[11.5px] font-semibold text-foreground">Groth16 zk-SNARK</div>
              <div className="text-[10px] text-muted-foreground">BN128 mathematical cryptographic proof.</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Audio & Speech Guide */}
      <div className="physical-card p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Volume2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-heading font-bold text-foreground">
            Acoustic Navigation
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          You can tap cards or speak naturally in 6 official languages. Audio DSP provides physical mechanical feedback.
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {['हिन्दी', 'English', 'मराठी', 'বাংলা', 'தமிழ்', 'తెలుగు'].map((l) => (
            <span
              key={l}
              className="text-[9.5px] bg-muted/60 border border-border/80 px-1.5 py-0.5 rounded-md text-foreground font-sans"
            >
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* 3. Operational Assistance */}
      <div className="physical-card p-4 bg-muted/20 flex flex-col gap-1">
        <div className="text-[11px] font-heading font-bold text-foreground">
          सहायता चाहिए? (Need Help?)
        </div>
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
          Visit Desk 01 in the central OPD lobby for hospital staff assistance.
        </p>
      </div>
    </aside>
  );
};
