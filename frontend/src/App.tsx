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
import { DemoModeBadge, ModeBanner } from './components/common/DemoModeControl';
import { useAppMode, refreshRuntimeMode } from './services/runtimeMode';
import { sovereignSound } from './utils/audio';
import { api } from './services/api';
import { ArrowLeft, WifiOff, Smartphone, MonitorSmartphone, Stethoscope, HeartPulse, Pill, Tv, Footprints, LayoutDashboard, Network } from 'lucide-react';

/** Screens that work only on the hospital server's data: the offline sandbox has no stand-in for them. */
const SERVER_ONLY_VIEWS: ActiveViewMode[] = ['kiosk', 'nurse', 'pharmacy', 'display', 'asha', 'admin'];

/** Each terminal's name in the top bar, so staff always know which screen they are on. */
const TERMINAL_META: Partial<Record<ActiveViewMode, { name: string; icon: React.ComponentType<{ size?: number; className?: string }> }>> = {
  kiosk: { name: 'Patient check-in kiosk', icon: MonitorSmartphone },
  doctor: { name: 'Doctor / Vaidya desk', icon: Stethoscope },
  nurse: { name: 'Nurse station', icon: HeartPulse },
  pharmacy: { name: 'Pharmacy counter', icon: Pill },
  display: { name: 'Waiting-room display', icon: Tv },
  asha: { name: 'ASHA field app', icon: Footprints },
  admin: { name: 'Hospital administration', icon: LayoutDashboard },
  matrix: { name: 'Architecture notes', icon: Network },
  byod: { name: 'Mobile waiting companion', icon: Smartphone }
};

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
  const appMode = useAppMode();
  const inSandbox = appMode.source === 'sandbox';

  // Silent background wake-up ping for Render free tier backend container
  useEffect(() => {
    api.checkHealth().catch(() => {});
  }, []);

  // Shortcuts: 1–8 on the gateway (Alt+1–8 anywhere) open a screen. Escape goes back to the gateway
  // only from the screens nobody works in (the waiting-room display, the notes, the mobile page).
  // On the kiosk and every staff screen Escape does nothing here: a doctor who presses it to close
  // a dropdown must never be thrown out of a half-written prescription.
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
        if (activeView === 'display' || activeView === 'matrix' || activeView === 'byod') launch('portal');
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
      {/* Terminal top bar: back to the gateway, which screen this is, demo/live mode, who is signed in.
          Not on the waiting-room TV (a public screen) or a locked kiosk. */}
      {activeView !== 'portal' && activeView !== 'display' && !lockedKiosk && (() => {
        const meta = TERMINAL_META[activeView];
        const Icon = meta?.icon;
        return (
          <header className="app-bar no-print sticky top-0 z-50 glass border-b border-border/70 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  try { sovereignSound.playMechanicalSnap(); } catch {}
                  setActiveView('portal');
                }}
                className="h-8 pl-2 pr-2.5 rounded-lg border border-border/70 bg-background hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                title="Back to all screens"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">All screens</span>
              </button>
              <div className="h-5 w-px bg-border hidden sm:block" />
              <img src="/ashoka-stambh-hd.png" alt="" className="h-5 w-5 object-contain shrink-0 pointer-events-none select-none hidden sm:block" />
              <div className="min-w-0 leading-tight">
                <div className="text-[10.5px] font-semibold text-muted-foreground truncate hidden sm:block">Sovereign Hospital OS</div>
                <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                  {Icon && <Icon size={14} className="text-primary shrink-0" />}
                  {meta?.name || 'Hospital OS'}
                </div>
              </div>
            </div>

            {/* A terminal may portal a compact context (e.g. the doctor desk's room and queue pager) here. */}
            <div id="app-bar-context" className="flex-1 min-w-0 flex items-center justify-end gap-2" />

            <div className="flex items-center gap-2 shrink-0">
              <DemoModeBadge />
              <StaffChip />
            </div>
          </header>
        );
      })()}

      {/* Main Terminal View Container */}
      <main className={`flex-1 ${activeView === 'portal' || activeView === 'display' || activeView === 'doctor' ? '' : 'pb-10'}`}>
        <Suspense fallback={<ViewLoading />}>
        {/* Keyed by data source: entering or leaving the offline sandbox reloads the open screen. */}
        <React.Fragment key={inSandbox ? 'sandbox' : 'server'}>
        {inSandbox && SERVER_ONLY_VIEWS.includes(activeView) && (
          <div className="max-w-xl mx-auto mt-16 px-4">
            <div className="rounded-3xl border border-border bg-card p-7 text-center shadow-sm">
              <WifiOff className="mx-auto mb-3 text-amber-600" size={28} />
              <h2 className="text-lg font-bold text-foreground">{TERMINAL_META[activeView]?.name || 'This screen'} needs the hospital server</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                The server is not answering, so Mock mode is running from the offline sandbox. The sandbox covers the Doctor / Vaidya desk with sample patients; this screen works on the server's data and has no stand-in.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setActiveView('doctor')} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Open the doctor desk</button>
                <button type="button" onClick={() => refreshRuntimeMode()} className="h-10 px-4 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold">Retry the server</button>
              </div>
            </div>
          </div>
        )}
        {!(inSandbox && SERVER_ONLY_VIEWS.includes(activeView)) && <>
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

        {activeView === 'display' && <QueueDisplayView onExit={() => setActiveView('portal')} />}

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
        </>}
        </React.Fragment>
        </Suspense>
      </main>

      {/* Offline sandbox on, Real mode waiting for the server, or still connecting: say so on every screen. */}
      {!lockedKiosk && <ModeBanner />}

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
