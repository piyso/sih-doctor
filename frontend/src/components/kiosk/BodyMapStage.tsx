import React, { useEffect, useMemo, useState } from 'react';
import { Check, Shield, Volume2, Mic, Heart, X, User, Activity, Layers, Bone, Hand, Footprints } from 'lucide-react';
import { sovereignSound } from '../../utils/audio';
import { AnatomicalMannequin3D, LOCUS_TO_MACRO_ZONE, MICRO_LOCI_CATALOG, MacroZone } from './AnatomicalMannequin3D';
import { REGION_CHROMATIC_PALETTE, DEFAULT_REGION_COLOR } from '../../utils/anatomicalModelMapping';
import { BCP47, KioskTextKey, kioskText, normalizeLang, regionName } from '../../utils/kioskLocalization';

interface BodyMapStageProps {
  selectedRegion: string;
  onSelectRegion: (regionId: string) => void;
  isPrivateMode: boolean;
  onTogglePrivateMode: () => void;
  language: string;
  onDescribeInstead: () => void;
}

const ZONES: Array<{ id: MacroZone; key: KioskTextKey; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'full', key: 'zoneFull', icon: User },
  { id: 'head', key: 'zoneHead', icon: Activity },
  { id: 'chest', key: 'zoneChest', icon: Heart },
  { id: 'abdomen', key: 'zoneAbdomen', icon: Layers },
  { id: 'spine', key: 'zoneSpine', icon: Bone },
  { id: 'arms', key: 'zoneArms', icon: Hand },
  { id: 'legs', key: 'zoneLegs', icon: Footprints }
];

/**
 * Step 3, part 1: choose where it hurts on the 3D body.
 * Rendered inline (not as a full-screen overlay) so the kiosk header, SOS button and the bottom
 * navigation dock stay visible and are the only Back / Next controls.
 */
export const BodyMapStage: React.FC<BodyMapStageProps> = ({
  selectedRegion,
  onSelectRegion,
  isPrivateMode,
  onTogglePrivateMode,
  language,
  onDescribeInstead
}) => {
  const tx = kioskText(language);
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  const [macroZone, setMacroZone] = useState<MacroZone>(() => (selectedRegion && LOCUS_TO_MACRO_ZONE[selectedRegion]) || 'full');
  const [cameraTarget, setCameraTarget] = useState<{ yaw: number; pitch?: number } | null>(null);

  // Keep the zone in sync when the region is changed from elsewhere (e.g. the symptoms screen).
  useEffect(() => {
    if (selectedRegion && LOCUS_TO_MACRO_ZONE[selectedRegion]) setMacroZone(LOCUS_TO_MACRO_ZONE[selectedRegion]);
  }, [selectedRegion]);

  // One chip per region in the active zone (the catalog has two ear markers sharing one region).
  const zoneRegions = useMemo(() => {
    if (macroZone === 'full') return [];
    const seen = new Set<string>();
    return MICRO_LOCI_CATALOG.filter(l => l.macroZone === macroZone && !seen.has(l.id) && seen.add(l.id));
  }, [macroZone]);

  const handleZone = (zone: MacroZone) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    setMacroZone(zone);
    // Changing zone only zooms — it never picks a body part on the patient's behalf.
    const back = zone === 'spine';
    setViewMode(back ? 'back' : 'front');
    setCameraTarget({ yaw: back ? Math.PI : 0, pitch: 0 });
  };

  const handlePickRegion = (regionId: string) => {
    try { sovereignSound.playHotspotPulse(); } catch {}
    if (regionId === selectedRegion) {
      onSelectRegion('');
      return;
    }
    onSelectRegion(regionId);
    const locus = MICRO_LOCI_CATALOG.find(l => l.id === regionId);
    if (locus) {
      setViewMode(locus.isPosterior ? 'back' : 'front');
      setCameraTarget({ yaw: locus.optimalView.yaw, pitch: locus.optimalView.pitch || 0 });
    }
  };

  const playGuidance = () => {
    try {
      sovereignSound.playMechanicalSnap();
      sovereignSound.speakGuidance(tx('bodyAudio'), BCP47[normalizeLang(language)]);
    } catch {}
  };

  const colors = REGION_CHROMATIC_PALETTE[selectedRegion] || DEFAULT_REGION_COLOR;

  return (
    <section className="flex flex-col gap-3 animate-in fade-in duration-200" aria-label={tx('bodyTitle')}>
      {/* Title + tools */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight">{tx('bodyTitle')}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{tx('bodySub')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={playGuidance} className="tactile-btn h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl text-primary border-primary/30">
            <Volume2 size={15} />
            <span>{tx('listenBtn')}</span>
          </button>
          <button
            type="button"
            onClick={() => { try { sovereignSound.playMechanicalSnap(); } catch {} onTogglePrivateMode(); }}
            aria-pressed={isPrivateMode}
            className={`tactile-btn h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl ${isPrivateMode ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50' : 'text-muted-foreground'}`}
          >
            <Shield size={15} />
            <span>{tx('bodyPrivate')}</span>
          </button>
          <button type="button" onClick={onDescribeInstead} className="tactile-btn h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl text-muted-foreground">
            <Mic size={15} />
            <span>{tx('bodyDescribeInstead')}</span>
          </button>
        </div>
      </div>

      {/* Zone tabs (zoom only) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5" role="tablist">
        {ZONES.map(zone => {
          const Icon = zone.icon;
          const active = macroZone === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleZone(zone.id)}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-[13px] font-heading font-bold shrink-0 flex items-center gap-1.5 border transition-colors ${
                active ? 'bg-foreground text-background border-foreground' : 'bg-card hover:bg-muted text-foreground border-border/80'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span>{tx(zone.key)}</span>
            </button>
          );
        })}
      </div>

      {/* Exact-spot chips for the active zone. Fixed height so the 3D view does not jump. */}
      <div className="min-h-[36px] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {zoneRegions.length > 0 && (
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0 mr-1">{tx('bodyArea')}:</span>
        )}
        {zoneRegions.map(locus => {
          const isSelected = selectedRegion === locus.id;
          return (
            <button
              key={locus.id}
              type="button"
              onClick={() => handlePickRegion(locus.id)}
              aria-pressed={isSelected}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 border transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : locus.isEmergency
                  ? 'bg-rose-500/10 text-foreground border-rose-500/30 hover:bg-rose-500/20'
                  : 'bg-background hover:bg-muted text-foreground border-border/80'
              }`}
            >
              <span>{regionName(locus.id, language)}</span>
              {isSelected && <Check size={12} className="shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* 3D stage */}
      <div className="body-map-stage relative rounded-3xl border border-border/80 overflow-hidden bg-card">
        <AnatomicalMannequin3D
          selectedRegion={selectedRegion}
          onSelectRegion={(reg: string) => {
            if (!reg || reg === selectedRegion) onSelectRegion('');
            else onSelectRegion(reg);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          activeMacroZone={macroZone}
          onMacroZoneChange={setMacroZone}
          externalCameraTarget={cameraTarget}
          isPrivateMode={isPrivateMode}
          className="w-full h-full rounded-none border-0"
          hideHeaderControls
          showAngleControls
          language={language}
        />

        {/* Current selection — always in the same place */}
        <div className="absolute top-3 left-3 z-20 max-w-[70%] pointer-events-auto">
          {selectedRegion ? (
            <div className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border shadow-sm backdrop-blur-md ${colors.cssBg} ${colors.cssBorder}`}>
              <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{tx('bodySelected')}:</span>
              <span className={`text-sm font-heading font-extrabold truncate ${colors.cssText}`}>{regionName(selectedRegion, language)}</span>
              <button
                type="button"
                onClick={() => handlePickRegion(selectedRegion)}
                className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-background/70 text-muted-foreground shrink-0"
                aria-label={tx('remove')}
                title={tx('bodyTapAgain')}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-sm text-xs font-semibold text-muted-foreground">
              {tx('bodyNothing')}
            </div>
          )}
        </div>

        {/* The heart is on the left — gentle correction when the right chest is chosen */}
        {selectedRegion === 'Right Chest' && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 w-[min(92%,460px)] p-2.5 rounded-2xl bg-card/95 border border-rose-500/40 backdrop-blur-md shadow-md flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-2 min-w-0">
              <Heart size={15} className="text-rose-500 shrink-0" />
              <span>{tx('bodyHeartHint')}</span>
            </span>
            <button
              type="button"
              onClick={() => handlePickRegion('Left Chest / Precordium')}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0"
            >
              {tx('bodyHeartBtn')}
            </button>
          </div>
        )}
      </div>

      {isPrivateMode && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <Shield size={14} className="shrink-0" />
          <span>{tx('bodyPrivateOn')}</span>
        </div>
      )}
    </section>
  );
};
