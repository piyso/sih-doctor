import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ActiveViewMode } from './components/common/Header';
import { HospitalOsGateway } from './modules/portal/HospitalOsGateway';
import { LeverModal } from './components/common/LeverModal';
import { ByodProximityModal } from './components/kiosk/ByodProximityModal';
// Each terminal is loaded on demand so a kiosk tablet never downloads the doctor desk, admin
// dashboards or 3D engine it does not use.
const KioskContainer = lazy(() => import('./components/kiosk/KioskContainer').then(m => ({ default: m.KioskContainer })));
const DoctorDeskContainer = lazy(() => import('./components/doctor/DoctorDeskContainer').then(m => ({ default: m.DoctorDeskContainer })));
const ArchitectureDefenseMatrix = lazy(() => import('./components/admin/ArchitectureDefenseMatrix').then(m => ({ default: m.ArchitectureDefenseMatrix })));
const PharmacyDeskView = lazy(() => import('./modules/pharmacy/PharmacyDeskView').then(m => ({ default: m.PharmacyDeskView })));
const AshaFieldView = lazy(() => import('./modules/asha/AshaFieldView').then(m => ({ default: m.AshaFieldView })));
const AdminConsoleView = lazy(() => import('./modules/admin/AdminConsoleView').then(m => ({ default: m.AdminConsoleView })));
const NurseStationView = lazy(() => import('./modules/nurse/NurseStationView').then(m => ({ default: m.NurseStationView })));
const QueueDisplayView = lazy(() => import('./modules/display/QueueDisplayView').then(m => ({ default: m.QueueDisplayView })));

const ViewLoading: React.FC = () => (
  <div className="flex items-center justify-center py-24 text-sm font-semibold text-muted-foreground" role="status">
    Loading…
  </div>
);
import { Button } from './components/ui/button';
import { StaffGate, StaffChip } from './components/auth/StaffGate';
import { KioskShell, isKioskLocked } from './components/kiosk/KioskShell';
import { sovereignSound } from './utils/audio';
import { api } from './services/api';
import { ArrowLeft, Smartphone } from 'lucide-react';

export function App() {
  const getInitialView = (): ActiveViewMode => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode')?.toLowerCase();
      const step = params.get('step');
      if (step) return 'kiosk';
      if (mode === 'doctor' || mode === 'opd' || mode === 'vaidya') return 'doctor';
      if (mode === 'nurse' || mode === 'station' || mode === 'triage-desk') return 'nurse';
      if (mode === 'display' || mode === 'board' || mode === 'tv') return 'display';
      if (mode === 'pharmacy' || mode === 'dispensary' || mode === 'rx') return 'pharmacy';
      if (mode === 'asha' || mode === 'anm' || mode === 'field') return 'asha';
      if (mode === 'admin' || mode === 'heatmap' || mode === 'triage' || mode === 'noc') return 'admin';
      if (mode === 'matrix' || mode === 'patent' || mode === 'defense') return 'matrix';
      if (mode === 'kiosk') return 'kiosk';
      if (isKioskLocked()) return 'kiosk';
      if (mode === 'byod') return 'byod';
      if (mode === 'portal' || mode === 'gateway') return 'portal';
    } catch (e) {}
    return 'portal';
  };

  const [activeView, setActiveView] = useState<ActiveViewMode>(getInitialView);
  const [kioskLocked, setKioskLockedState] = useState(isKioskLocked);
  const lockedKiosk = activeView === 'kiosk' && kioskLocked;
  const [isLeverModalOpen, setIsLeverModalOpen] = useState(false);
  const [isByodModalOpen, setIsByodModalOpen] = useState(false);

  // Silent background wake-up ping for Render free tier backend container
  useEffect(() => {
    api.checkHealth().catch(() => {});
  }, []);

  // Dynamic pointer coordinates for Fresnel spotlight across cards
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // Global Pro Shortcuts: Esc to Portal, 1-6 on Portal (or Alt+1-6 globally)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput || lockedKiosk) return;

      const launch = (mode: ActiveViewMode) => {
        try { sovereignSound.playMechanicalSnap(); } catch {}
        setActiveView(mode);
      };

      if (e.key === 'Escape') {
        launch('portal');
      } else if (activeView === 'portal' || e.altKey) {
        const order: ActiveViewMode[] = ['kiosk', 'doctor', 'nurse', 'pharmacy', 'display', 'asha', 'admin', 'matrix'];
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < order.length) launch(order[idx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, lockedKiosk]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Top Utility Bar for Standalone Terminals */}
      {activeView !== 'portal' && !lockedKiosk && (
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
              <span className="font-semibold text-foreground/90">Sovereign Hospital OS</span>
            </div>

            <StaffChip />
          </div>
        </div>
      )}

      {/* Main Terminal View Container */}
      <main className={`flex-1 ${activeView === 'portal' || activeView === 'display' ? '' : 'pb-10'}`}>
        <Suspense fallback={<ViewLoading />}>
        {activeView === 'portal' && (
          <HospitalOsGateway
            onLaunchTerminal={(terminal) => {
              setActiveView(terminal);
            }}
            onOpenByodModal={() => setIsByodModalOpen(true)}
          />
        )}

        {activeView === 'kiosk' && (
          <KioskShell locked={kioskLocked} onExit={() => { setKioskLockedState(false); setActiveView('portal'); }}>
            <KioskContainer />
          </KioskShell>
        )}

        {activeView === 'doctor' && (
          <StaffGate roles={['doctor', 'vaidya', 'nurse', 'admin']} terminalName="Doctor / Vaidya desk">
            <DoctorDeskContainer />
          </StaffGate>
        )}

        {activeView === 'nurse' && (
          <StaffGate roles={['nurse', 'doctor', 'vaidya', 'admin', 'reception']} terminalName="Nurse station">
            <NurseStationView />
          </StaffGate>
        )}

        {activeView === 'display' && <QueueDisplayView />}

        {activeView === 'pharmacy' && (
          <StaffGate roles={['pharmacist', 'admin']} terminalName="Pharmacy counter">
            <PharmacyDeskView />
          </StaffGate>
        )}

        {activeView === 'asha' && (
          <StaffGate roles={['asha', 'nurse', 'doctor', 'vaidya', 'admin']} terminalName="ASHA field app">
            <AshaFieldView />
          </StaffGate>
        )}

        {activeView === 'admin' && (
          <StaffGate roles={['admin', 'doctor', 'vaidya', 'nurse']} terminalName="Hospital administration">
            <AdminConsoleView />
          </StaffGate>
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
        </Suspense>
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
