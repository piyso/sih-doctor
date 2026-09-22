import React, { useState, useEffect } from 'react';
import { ActiveViewMode } from './components/common/Header';
import { HospitalOsGateway } from './modules/portal/HospitalOsGateway';
import { LeverModal } from './components/common/LeverModal';
import { ByodProximityModal } from './components/kiosk/ByodProximityModal';
import { KioskContainer } from './components/kiosk/KioskContainer';
import { DoctorDeskContainer } from './components/doctor/DoctorDeskContainer';
import { ArchitectureDefenseMatrix } from './components/admin/ArchitectureDefenseMatrix';
import { PharmacyDeskView } from './modules/pharmacy/PharmacyDeskView';
import { AshaFieldView } from './modules/asha/AshaFieldView';
import { CommandCenterView } from './modules/admin/CommandCenterView';
import { Button } from './components/ui/button';
import { sovereignSound } from './utils/audio';
import { ArrowLeft, Smartphone } from 'lucide-react';

export function App() {
  const getInitialView = (): ActiveViewMode => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode')?.toLowerCase();
      const step = params.get('step');
      if (step) return 'kiosk';
      if (mode === 'doctor' || mode === 'opd') return 'doctor';
      if (mode === 'pharmacy' || mode === 'dispensary' || mode === 'rx') return 'pharmacy';
      if (mode === 'asha' || mode === 'anm' || mode === 'field') return 'asha';
      if (mode === 'admin' || mode === 'heatmap' || mode === 'triage' || mode === 'noc') return 'admin';
      if (mode === 'matrix' || mode === 'patent' || mode === 'defense') return 'matrix';
      if (mode === 'kiosk') return 'kiosk';
      if (mode === 'byod') return 'byod';
      if (mode === 'portal' || mode === 'gateway') return 'portal';
    } catch (e) {}
    return 'portal';
  };

  const [activeView, setActiveView] = useState<ActiveViewMode>(getInitialView);
  const [isLeverModalOpen, setIsLeverModalOpen] = useState(false);
  const [isByodModalOpen, setIsByodModalOpen] = useState(false);


  // Dynamic pointer coordinates for Fresnel spotlight across cards
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // Global Pro Shortcuts: Esc to Portal, 1-6 for Direct Terminal Launching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      const launch = (mode: ActiveViewMode) => {
        try { sovereignSound.playMechanicalSnap(); } catch {}
        setActiveView(mode);
      };

      if (e.key === 'Escape') {
        launch('portal');
      } else if (e.key === '1') {
        launch('kiosk');
      } else if (e.key === '2') {
        launch('doctor');
      } else if (e.key === '3') {
        launch('pharmacy');
      } else if (e.key === '4') {
        launch('asha');
      } else if (e.key === '5') {
        launch('admin');
      } else if (e.key === '6') {
        launch('matrix');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Top Utility Bar for Standalone Terminals */}
      {activeView !== 'portal' && (
        <div className="no-print sticky top-0 z-50 glass border-b border-border/70 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-2xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try { sovereignSound.playMechanicalSnap(); } catch {}
              setActiveView('portal');
            }}
            className="h-8 gap-1.5 rounded-xl font-medium text-xs border-border/70 cursor-pointer"
            title="Return to Hospital OS Gateway (Shortcut: Esc)"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Gateway</span>
            <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-muted text-[10px] font-mono">Esc</kbd>
          </Button>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <img
                src="/ashoka-stambh-hd.png"
                alt="Ashoka Stambh"
                className="h-5 w-5 object-contain shrink-0 pointer-events-none select-none"
                style={{ height: '20px', width: '20px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.06))' }}
              />
              <span className="font-semibold text-foreground/90">Agastya Sutra</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-mono font-medium shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE SQLite WAL</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Terminal View Container */}
      <main className={`flex-1 ${activeView === 'portal' ? '' : 'pb-10'}`}>
        {activeView === 'portal' && (
          <HospitalOsGateway
            onLaunchTerminal={(terminal) => {
              setActiveView(terminal);
            }}
            onOpenByodModal={() => setIsByodModalOpen(true)}
          />
        )}

        {activeView === 'kiosk' && (
          <KioskContainer onGoToDoctorDesk={() => setActiveView('doctor')} />
        )}

        {activeView === 'doctor' && (
          <DoctorDeskContainer />
        )}

        {activeView === 'pharmacy' && (
          <PharmacyDeskView />
        )}

        {activeView === 'asha' && (
          <AshaFieldView />
        )}

        {activeView === 'admin' && (
          <CommandCenterView />
        )}

        {activeView === 'matrix' && (
          <ArchitectureDefenseMatrix />
        )}

        {activeView === 'byod' && (
          <div className="max-w-3xl mx-auto mt-16 px-4">
            <div className="border border-border/70 bg-card p-8 rounded-3xl text-center shadow-lg card-hover-lift">
              <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border/60 mx-auto mb-4 flex items-center justify-center text-foreground">
                <Smartphone className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-2">
                Sovereign BYOD Mobile Waiting Companion
              </h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6 leading-relaxed font-sans">
                Geofenced hospital garden &amp; canteen pacing system. Verify your on-campus presence to track live queue numbers without downloading any app.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="default"
                  onClick={() => setIsByodModalOpen(true)}
                  className="rounded-xl px-6"
                >
                  Launch Geofence &amp; Optical Gate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveView('portal')}
                  className="rounded-xl px-5"
                >
                  Return to Gateway
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <LeverModal
        isOpen={isLeverModalOpen}
        onClose={() => setIsLeverModalOpen(false)}
      />

      <ByodProximityModal
        isOpen={isByodModalOpen}
        onClose={() => setIsByodModalOpen(false)}
      />
    </div>
  );
}

export default App;
