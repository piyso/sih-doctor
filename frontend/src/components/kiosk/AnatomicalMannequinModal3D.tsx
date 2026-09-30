import React, { useState, useEffect } from 'react';
import {
  Check,
  Shield,
  RotateCw,
  HeartPulse,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  User,
  Heart,
  Bone,
  Layers,
  Activity,
  Mic
} from 'lucide-react';
import { sovereignSound } from '../../utils/audio';
import {
  AnatomicalMannequin3D,
  ANATOMICAL_LOCI_3D,
  LOCUS_TO_MACRO_ZONE,
  MICRO_LOCI_CATALOG,
  MicroLocusItem,
  MacroZone
} from './AnatomicalMannequin3D';
import { REGION_CHROMATIC_PALETTE, DEFAULT_REGION_COLOR } from '../../utils/anatomicalModelMapping';

interface AnatomicalMannequinModal3DProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion: string;
  onSelectRegion: (regionId: string) => void;
  isPrivateMode: boolean;
  onTogglePrivateMode: () => void;
  micLanguage?: string;
  onSkipToVoice?: () => void;
}

export const AnatomicalMannequinModal3D: React.FC<AnatomicalMannequinModal3DProps> = ({
  isOpen,
  onClose,
  selectedRegion,
  onSelectRegion,
  isPrivateMode,
  onTogglePrivateMode,
  micLanguage = 'hi-IN',
  onSkipToVoice
}) => {
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  const [macroZone, setMacroZone] = useState<MacroZone>('full');
  const [selectedSubKey, setSelectedSubKey] = useState<string>('');
  const [externalCamTarget, setExternalCamTarget] = useState<{ yaw: number; pitch?: number } | null>(null);

  // Sync sub-key on selected region change
  useEffect(() => {
    if (selectedRegion) {
      const matched = MICRO_LOCI_CATALOG.find(m => m.id === selectedRegion);
      if (matched) {
        setSelectedSubKey(matched.subKey);
      }
    }
  }, [selectedRegion]);

  const MACRO_TABS: Array<{ id: MacroZone; label: string; en: string }> = [
    { id: 'full', label: 'संपूर्ण शरीर', en: 'Full Body' },
    { id: 'head', label: 'सिर व चेहरा', en: 'Head & Face' },
    { id: 'chest', label: 'सीना व हृदय', en: 'Chest & Heart' },
    { id: 'abdomen', label: 'पेट व पेडू', en: 'Abdomen & Pelvis' },
    { id: 'spine', label: 'रीढ़ व पीठ', en: 'Spine & Back' },
    { id: 'arms', label: 'हाथ व बांह', en: 'Arms & Hands' },
    { id: 'legs', label: 'पैर व जोड़', en: 'Legs & Joints' }
  ];

  const getModalZoneIcon = (zone: MacroZone) => {
    switch (zone) {
      case 'full': return <User size={15} className="shrink-0 text-cyan-500" />;
      case 'head': return <Activity size={15} className="shrink-0 text-indigo-400" />;
      case 'chest': return <Heart size={15} className="shrink-0 text-rose-400" />;
      case 'abdomen':
      case 'torso': return <Layers size={15} className="shrink-0 text-emerald-400" />;
      case 'spine': return <Bone size={15} className="shrink-0 text-amber-400" />;
      case 'arms': return <Activity size={15} className="shrink-0 text-blue-400" />;
      case 'legs':
      case 'lower': return <Activity size={15} className="shrink-0 text-teal-400" />;
      default: return <User size={15} className="shrink-0 text-muted-foreground" />;
    }
  };

  const playVoiceGuidance = () => {
    try {
      sovereignSound.playMechanicalSnap();
      const guidanceTexts: Record<string, string> = {
        'hi-IN': 'कृपया 3D शरीर मॉडल पर छूकर बताएं कि आपको कहाँ दर्द या तकलीफ़ है, फिर आगे बढ़ें बटन दबाएं।',
        'en-IN': 'Please touch the affected area on the 3D body model, then tap the Next button to continue.',
        'mr-IN': 'कृपया 3D शरीरावर तुमचा दुखणारा भाग निवडा आणि नंतर पुढे जा बटण दाबा.',
        'bn-IN': 'অনুগ্রহ করে 3D মডেলে ব্যথার স্থানটি স্পর্শ করুন এবং পরবর্তী বোতামটি টিপুন।',
        'ta-IN': 'தயவுசெய்து 3D மாதிரியில் வலி உள்ள பகுதியைத் தொட்டு தேர்ந்தெடுக்கவும், பின்னர் அடுத்து பொத்தானை அழுத்தவும்.',
        'te-IN': 'దయచేసి 3D శరీర నమూనాలో మీ నొప్పి ఉన్న భాగాన్ని తాకి ఎంచుకోండి, తర్వాత ముందుకు వెళ్లండి.',
        'gu-IN': 'કૃપા કરીને 3D મોડેલ પર દર્દવાળા ભાગને સ્પર્શ કરીને પસંદ કરો, પછી આગળ વધો બટન દબાવો.',
        'kn-IN': 'ದಯವಿಟ್ಟು 3D ದೇಹದ ಮಾದರಿಯಲ್ಲಿ ನೋವಿರುವ ಭಾಗವನ್ನು ಸ್ಪರ್ಶಿಸಿ, ನಂತರ ಮುಂದಕ್ಕೆ ಬಟನ್ ಒತ್ತಿರಿ.',
        'pa-IN': 'ਕਿਰਪਾ ਕਰਕੇ 3D ਸਰੀਰ ਮਾਡਲ ਤੇ ਦਰਦ ਵਾਲੇ ਹਿੱਸੇ ਨੂੰ ਛੂਹ ਕੇ ਚੁਣੋ ਅਤੇ ਅੱਗੇ ਵਧੋ ਦਬਾਓ।',
        'ml-IN': 'ദയവായി 3D മോഡലിൽ വേദനയുള്ള ഭാഗം തൊട്ടു തിരഞ്ഞെടുക്കുക, തുടർന്ന് അടുത്തത് അമർത്തുക.'
      };
      sovereignSound.speakGuidance(guidanceTexts[micLanguage] || guidanceTexts['hi-IN']);
    } catch {}
  };

  if (!isOpen) return null;

  const activeSubLocus = MICRO_LOCI_CATALOG.find(m => m.subKey === selectedSubKey) ||
    MICRO_LOCI_CATALOG.find(m => m.id === selectedRegion) ||
    MICRO_LOCI_CATALOG.find(m => m.id === 'Right Chest') ||
    MICRO_LOCI_CATALOG[0];

  const visibleMicroLoci = MICRO_LOCI_CATALOG.filter(
    m => macroZone === 'full' ? false : m.macroZone === macroZone
  );

  const handleMacroTabChange = (newZone: MacroZone) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    setMacroZone(newZone);

    if (newZone !== 'full') {
      const firstInZone = MICRO_LOCI_CATALOG.find(m => m.macroZone === newZone);
      if (firstInZone) {
        onSelectRegion(firstInZone.id);
        setSelectedSubKey(firstInZone.subKey);
        setExternalCamTarget({ yaw: firstInZone.optimalView.yaw, pitch: firstInZone.optimalView.pitch || 0 });
        if (firstInZone.isPosterior) {
          setViewMode('back');
        } else {
          setViewMode('front');
        }
      }
    } else {
      setExternalCamTarget({ yaw: 0, pitch: 0 });
      setViewMode('front');
    }
  };

  const handleSelectMicroLocus = (locus: MicroLocusItem) => {
    try { sovereignSound.playHotspotPulse(); } catch {}
    if (selectedRegion === locus.id) {
      onSelectRegion('');
      setSelectedSubKey('');
      setMacroZone('full');
      setExternalCamTarget({ yaw: 0, pitch: 0 });
      setViewMode('front');
    } else {
      onSelectRegion(locus.id);
      setSelectedSubKey(locus.subKey);
      setExternalCamTarget({
        yaw: locus.optimalView.yaw,
        pitch: locus.optimalView.pitch || 0
      });
      if (locus.isPosterior) {
        setViewMode('back');
      } else {
        setViewMode('front');
      }
    }
  };

  const handleConfirmAndProceed = () => {
    try { 
      sovereignSound.playCrystalChime(); 
    } catch {}
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground font-sans select-none overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="3D Anatomical Body Locus Inspector"
    >
      {/* Background Architectural Drafting Grid */}
      <div 
        className="absolute inset-0 hairline-grid opacity-20 pointer-events-none -z-10" 
        aria-hidden="true" 
      />

      {/* Sovereign National Tricolor Horizon Bar */}
      <div className="w-full h-[4px] bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] dark:via-slate-200 to-[#138808] shadow-sm shrink-0" />

      {/* 1. Header Bar */}
      <header className="px-4 sm:px-8 py-2.5 sm:py-3 border-b border-border/80 flex items-center justify-between gap-3 shrink-0 bg-background/95 backdrop-blur-md z-30 shadow-xs">
        {/* State Emblem & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-muted/70 border border-border p-1.5 flex items-center justify-center shrink-0 shadow-inner">
            <img
              src="/ashoka-stambh-hd.png"
              alt="State Emblem of India"
              className="h-full w-full object-contain dark:invert pointer-events-none"
            />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <div className="flex items-center gap-2 truncate">
              <span className="font-heading font-extrabold text-base sm:text-lg md:text-xl tracking-tight text-foreground truncate">
                3D शारीरिक अंग चयन · Touch Body Model
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-bold shrink-0 hidden xs:inline">
                STEP 3 · 3D STAGE
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-devanagari truncate">
              कहाँ तकलीफ़ या दर्द है? 3D शरीर पर छूकर बताएं (Touch 3D loci where you feel pain)
            </span>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Listen Guidance Button */}
          <button
            type="button"
            onClick={playVoiceGuidance}
            className="tactile-btn h-9 sm:h-10 px-3 text-xs sm:text-sm font-semibold gap-2 rounded-xl cursor-pointer text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 transition-all shadow-xs"
            title="Audio Guidance / आवाज़ में निर्देश"
          >
            <Volume2 size={16} />
            <span className="hidden sm:inline">निर्देश सुनें</span>
            <span className="text-[10px] opacity-75 font-mono">(Listen)</span>
          </button>

          {/* Private Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              try { sovereignSound.playMechanicalSnap(); } catch {}
              onTogglePrivateMode();
            }}
            className={`tactile-btn h-9 sm:h-10 px-3 text-xs sm:text-sm font-semibold gap-2 rounded-xl cursor-pointer transition-all ${
              isPrivateMode
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Private Mode (DPDP Act 2023)"
          >
            <Shield size={16} />
            <span className="hidden xs:inline">निजी मोड</span>
          </button>

          {/* Skip directly to voice studio */}
          {onSkipToVoice && (
            <button
              type="button"
              onClick={() => {
                try { sovereignSound.playMechanicalSnap(); } catch {}
                onSkipToVoice();
              }}
              className="tactile-btn h-9 sm:h-10 px-3 text-xs sm:text-sm font-semibold rounded-xl text-muted-foreground hover:text-foreground hidden md:flex items-center gap-1.5 cursor-pointer"
              title="Skip body selection and speak symptoms"
            >
              <Mic size={15} className="text-muted-foreground" />
              <span>सीधे बोलें (Skip)</span>
            </button>
          )}

          {/* Primary Quick Next Button in Header */}
          <button
            type="button"
            onClick={handleConfirmAndProceed}
            className="tactile-btn-primary h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-heading font-extrabold rounded-xl flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <span>आगे बढ़ें (Next)</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* 2. Structured Sub-Header (Macro Tabs & Micro Organ Strip) */}
      <div className="px-4 sm:px-8 py-2 border-b border-border/80 bg-muted/40 backdrop-blur-md flex flex-col gap-2 shrink-0 z-20">
        
        {/* Tier 1: Macro Zone Tabs */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {MACRO_TABS.map((tab) => {
              const isActive = macroZone === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleMacroTabChange(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-[13px] font-heading font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-cyan-500 ring-2 ring-cyan-500/40 shadow-sm scale-[1.02]'
                      : 'bg-card hover:bg-muted text-foreground border-border/80'
                  }`}
                >
                  {getModalZoneIcon(tab.id)}
                  <span>{tab.label}</span>
                  <span className="text-[10px] font-mono opacity-80 hidden md:inline">({tab.en})</span>
                </button>
              );
            })}
          </div>

          {/* Current Selection Status */}
          {(() => {
            const activeDef = REGION_CHROMATIC_PALETTE[selectedRegion] || DEFAULT_REGION_COLOR;
            return (
              <div className={`flex items-center gap-2 px-3.5 py-1 rounded-xl ${activeDef.cssBg} border ${activeDef.cssBorder} text-xs shrink-0 shadow-2xs`}>
                <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">चयनित अंग:</span>
                <span className={`font-heading font-extrabold ${activeDef.cssText} text-xs sm:text-sm`}>
                  {activeSubLocus ? activeSubLocus.hindiLabel : selectedRegion}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Tier 2: Micro-organ Quick Loci Buttons (shown only when a specific zone is active) */}
        {visibleMicroLoci.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground shrink-0 mr-1 hidden sm:inline">
              विशिष्ट अंग:
            </span>
            {visibleMicroLoci.map((locus) => {
              const isSelected = selectedSubKey === locus.subKey || (selectedRegion === locus.id && selectedSubKey === locus.subKey);
              return (
                <button
                  key={locus.subKey}
                  type="button"
                  onClick={() => handleSelectMicroLocus(locus)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs ring-1 ring-cyan-400/50 font-bold'
                      : locus.isEmergency
                      ? 'bg-rose-500/10 text-foreground border-rose-500/30 hover:bg-rose-500/20'
                      : 'bg-background/90 hover:bg-muted text-foreground border-border/80'
                  }`}
                >
                  <span>{locus.hindiLabel}</span>
                  {isSelected && <Check size={12} className="text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Pure Fullscreen 3D Viewport Stage */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex flex-col justify-between bg-gradient-to-b from-slate-100/40 via-background to-slate-100/30 dark:from-slate-950/70 dark:via-background dark:to-slate-950/60">
        
        {/* Full-bleed 3D Canvas (Cleaned: No duplicate HUDs, purely the 3D model) */}
        <div className="absolute inset-0 w-full h-full">
          <AnatomicalMannequin3D
            selectedRegion={selectedRegion}
            onSelectRegion={(reg: string) => {
              onSelectRegion(reg);
              if (!reg) {
                setSelectedSubKey('');
                setMacroZone('full');
              } else {
                const matched = MICRO_LOCI_CATALOG.find(m => m.id === reg);
                if (matched) setSelectedSubKey(matched.subKey);
              }
            }}
            viewMode={viewMode}
            onViewModeChange={(mode) => setViewMode(mode)}
            activeMacroZone={macroZone}
            onMacroZoneChange={(zone) => setMacroZone(zone)}
            externalCameraTarget={externalCamTarget}
            isPrivateMode={isPrivateMode}
            className="w-full h-full rounded-none border-0"
            hideHeaderControls={true}
            showAngleControls={true}
          />
        </div>

        {/* Right Chest Misdirection Alert (Cleanly floated if Right Chest is clicked) */}
        {selectedRegion === 'Right Chest' && (
          <div className="relative z-20 mx-auto mt-3 max-w-md p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 backdrop-blur-md flex items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0 text-left">
              <Heart size={16} className="text-rose-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  क्या आप दिल (Heart) की जांच कर रहे हैं?
                </span>
                <span className="text-[10.5px] text-muted-foreground truncate">
                  मानव शरीर में हृदय बायीं ओर (Left Precordium) स्थित होता है
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                try { sovereignSound.playMechanicalSnap(); } catch {}
                onSelectRegion('Left Chest / Precordium');
                setSelectedSubKey('heart');
                setExternalCamTarget({ yaw: 0, pitch: 0 });
              }}
              className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs flex items-center gap-1"
            >
              <Heart size={12} />
              <span>बायां सीना चुनें</span>
            </button>
          </div>
        )}

        {/* Private Mode Active Banner */}
        {isPrivateMode && (
          <div className="relative z-20 m-3 p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 backdrop-blur-md flex items-center justify-between gap-2 max-w-lg mx-auto pointer-events-auto shadow-sm">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
              <Shield size={15} className="shrink-0 text-amber-500" />
              <span>गोपनीय मोड सक्रिय · डेटा केवल डॉक्टर के कक्ष में प्रदर्शित होगा (DPDP Act)</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 shrink-0">
              <VolumeX size={12} />
              <span>Muted</span>
            </div>
          </div>
        )}

        {/* 4. Grand Bottom Progression Bar (The Gateway to the Complete Intake Page) */}
        <div className="relative z-20 mt-auto px-4 sm:px-8 py-3 sm:py-4 bg-background/95 backdrop-blur-xl border-t border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
          
          {/* Left: Active Locus Pill & Confirmation */}
          {(() => {
            const activeDef = REGION_CHROMATIC_PALETTE[selectedRegion] || DEFAULT_REGION_COLOR;
            return (
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-2xl ${activeDef.cssBg} border ${activeDef.cssBorder} flex items-center justify-center shrink-0 ${activeDef.cssText}`}>
                  <HeartPulse size={20} />
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-heading font-extrabold text-foreground truncate">
                      {activeSubLocus?.hindiLabel || selectedRegion}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground truncate hidden xs:inline">
                      ({activeSubLocus?.label || selectedRegion})
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${activeDef.cssBg} ${activeDef.cssText} border ${activeDef.cssBorder} shrink-0`}>
                      चयनित (SELECTED)
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-devanagari truncate">
                    {activeSubLocus?.ayushMarma ? `आयुर्वेदिक मर्म: ${activeSubLocus.ayushMarma} · ` : ''}
                    आगे बढ़ने पर विस्तृत लक्षण, दर्द की प्रकृति व आवाज़ रिकॉर्डिंग खुलेगी
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Right: Giant, High-Contrast Next Button */}
          <div className="flex items-center gap-3 shrink-0 justify-end">
            <button
              type="button"
              onClick={handleConfirmAndProceed}
              className="w-full sm:w-auto tactile-btn-primary py-3 px-6 sm:px-8 text-sm sm:text-base font-heading font-extrabold rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer shadow-xl hover:shadow-2xl ring-2 ring-cyan-400/40 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span>आगे बढ़ें (Next: Add Symptoms & Voice)</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
