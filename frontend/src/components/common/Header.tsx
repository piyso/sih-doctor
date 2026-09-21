import React from 'react';
import { 
  Monitor, 
  Stethoscope, 
  BarChart3, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Pill, 
  Users,
  Sun,
  Moon,
  Smartphone,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { sovereignSound } from '../../utils/audio';
import { useTheme } from '../providers/ThemeProvider';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

export type ActiveViewMode = 'portal' | 'kiosk' | 'doctor' | 'pharmacy' | 'asha' | 'admin' | 'matrix' | 'byod';

interface HeaderProps {
  activeView: ActiveViewMode;
  setActiveView: (view: ActiveViewMode) => void;
  emergencyCount: number;
  onOpenLeverModal?: () => void;
  onOpenByodModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  emergencyCount,
  onOpenLeverModal,
  onOpenByodModal
}) => {
  const [isMuted, setIsMuted] = React.useState(sovereignSound.getMuted());
  const { resolvedTheme, toggleTheme } = useTheme();

  const handleTabChange = (view: ActiveViewMode) => {
    sovereignSound.playMechanicalSnap();
    setActiveView(view);
  };

  const handleMuteToggle = () => {
    const muted = sovereignSound.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      sovereignSound.playMechanicalSnap();
    }
  };

  return (
    <header className="no-print sticky top-3 z-50 mx-auto w-[calc(100%-24px)] max-w-7xl mb-5">
      <div className="glass rounded-2xl border border-border/70 px-4 py-2.5 flex items-center justify-between flex-wrap gap-3 shadow-sm transition-all duration-200">
        {/* Left: Emblem & Institutional Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleTabChange('portal')}
            title="Return to Hospital OS Gateway (Esc)"
            className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center font-bold shadow-xs hover:scale-105 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-current">
              <circle cx="12" cy="12" r="9.5" strokeWidth="1.25" strokeDasharray="2 2" opacity="0.6" />
              <path d="M12 4.5V19.5M4.5 12H19.5" strokeWidth="1.75" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTabChange('portal')}
                className="font-heading font-bold text-sm tracking-tight text-foreground hover:text-brand transition-colors text-left"
              >
                AIIA MediKiosk
              </button>
              <Badge variant="secondary" className="font-mono text-[9px] px-1.5 py-0">
                PS-26047
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-sans truncate max-w-[200px] sm:max-w-none">
              Ministry of Ayush · Govt. of India · Air-Gapped OPD
            </p>
          </div>
        </div>

        {/* Center: Segmented Terminal Navigation */}
        <nav
          aria-label="Primary Navigation"
          className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60 overflow-x-auto no-scrollbar gap-0.5"
        >
          <button
            onClick={() => handleTabChange('kiosk')}
            title="Patient MediKiosk 2.0 (Press 1)"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all font-sans shrink-0",
              activeView === 'kiosk'
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Monitor size={13} />
            <span>MediKiosk</span>
          </button>

          <button
            onClick={() => handleTabChange('doctor')}
            title="Doctor Clinical Cockpit (Press 2)"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all font-sans shrink-0",
              activeView === 'doctor'
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Stethoscope size={13} />
            <span>Doctor Desk</span>
            {emergencyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white font-mono text-[9px] font-bold">
                {emergencyCount} RED
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('pharmacy')}
            title="Dispensary POS (Press 3)"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all font-sans shrink-0",
              activeView === 'pharmacy'
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Pill size={13} />
            <span>Dispensary</span>
          </button>

          <button
            onClick={() => handleTabChange('asha')}
            title="ASHA Rural Outreach (Press 4)"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all font-sans shrink-0",
              activeView === 'asha'
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Users size={13} />
            <span>ASHA</span>
          </button>

          <button
            onClick={() => handleTabChange('admin')}
            title="Command NOC (Press 5)"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all font-sans shrink-0",
              activeView === 'admin'
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <BarChart3 size={13} />
            <span>Gov NOC</span>
          </button>

          <button
            onClick={() => handleTabChange('matrix')}
            title="Defense Matrix (Press 6)"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all font-sans shrink-0",
              activeView === 'matrix'
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <ShieldAlert size={13} />
            <span>Matrix</span>
          </button>
        </nav>

        {/* Right: Sound, BYOD, Air-Gap Diagnostics, Theme Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMuteToggle}
            title={isMuted ? "Audio Muted" : "Acoustic DSP Synthesizer Active"}
            className="h-8 w-8 p-0 rounded-lg"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className="h-8 w-8 p-0 rounded-lg border-border/70"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-slate-700" />
            )}
          </Button>

          <button
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              onOpenByodModal?.();
            }}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted border border-border/60 text-xs font-mono font-medium text-foreground transition-colors"
          >
            <Smartphone size={12} />
            <span>BYOD Gate</span>
          </button>

          <button
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              onOpenLeverModal?.();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/70 text-xs font-mono font-medium text-foreground transition-colors"
          >
            <ShieldCheck size={12} className="text-foreground/70" />
            <span>Air-Gapped</span>
          </button>
        </div>
      </div>
    </header>
  );
};
