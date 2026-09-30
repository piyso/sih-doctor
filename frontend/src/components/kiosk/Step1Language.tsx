import React, { useState, useEffect, useRef } from 'react';
import { Volume2, ArrowRight, CheckCircle2, Globe } from 'lucide-react';
import { sovereignSound } from '../../utils/audio';
import { sovereignVoice } from '../../utils/SovereignVoiceEngine';

interface Step1LanguageProps {
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  onNext: () => void;
}

export const Step1Language: React.FC<Step1LanguageProps> = ({
  selectedLanguage,
  onSelectLanguage,
  onNext
}) => {
  const [playingLang, setPlayingLang] = useState<string | null>(null);
  const [hasHesitated, setHasHesitated] = useState(false);
  const touchDetectedRef = useRef(false);

  const languages = [
    { code: 'hi', label: 'हिन्दी', sub: 'Hindi', nativePrompt: 'नमस्ते! कृपया अपनी भाषा चुनें', scriptRegion: 'उत्तरी एवं मध्य भारत' },
    { code: 'en', label: 'English', sub: 'Indian English', nativePrompt: 'Welcome! Please select your preferred language', scriptRegion: 'Pan-India & Global' },
    { code: 'mr', label: 'मराठी', sub: 'Marathi', nativePrompt: 'नमस्कार! कृपया आपली भाषा निवडा', scriptRegion: 'महाराष्ट्र' },
    { code: 'bn', label: 'বাংলা', sub: 'Bengali', nativePrompt: 'নমস্কার! অনুগ্রহ করে আপনার ভাষা বেছে নিন', scriptRegion: 'পশ্চিমবঙ্গ ও ত্রিপুরা' },
    { code: 'ta', label: 'தமிழ்', sub: 'Tamil', nativePrompt: 'வணக்கம்! உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்', scriptRegion: 'தமிழ்நாடு' },
    { code: 'te', label: 'తెలుగు', sub: 'Telugu', nativePrompt: 'నమస్కారం! దయచేసి మీ భాషను ఎంచుకోండి', scriptRegion: 'ఆంధ్రప్రదేశ్ & తెలంగాణ' }
  ];

  // 8-Second Hesitation Circuit (Empathy-Driven Micro-Interaction)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!touchDetectedRef.current) {
        setHasHesitated(true);
        // Play gentle Hindi fallback voice prompt if user freezes
        sovereignVoice.speak('कृपया अपनी परेशानी बताएं या स्क्रीन पर स्पर्श करें', 'hi-IN', () => setPlayingLang(null), () => setPlayingLang(null));
      }
    }, 8000);

    const handleTouch = () => {
      touchDetectedRef.current = true;
    };

    window.addEventListener('pointerdown', handleTouch);
    window.addEventListener('touchstart', handleTouch);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleTouch);
      window.removeEventListener('touchstart', handleTouch);
      sovereignVoice.stop();
    };
  }, []);

  const handleSelect = (code: string) => {
    touchDetectedRef.current = true;
    sovereignSound.playMechanicalSnap();
    onSelectLanguage(code);
  };

  const handlePlayAudioPrompt = (e: React.MouseEvent, code: string, promptText: string) => {
    e.stopPropagation();
    touchDetectedRef.current = true;
    sovereignSound.playDialNotch();
    setPlayingLang(code);
    
    sovereignVoice.speak(
      promptText,
      code,
      () => setPlayingLang(null),
      () => setPlayingLang(null)
    );
  };

  const handleProceed = () => {
    touchDetectedRef.current = true;
    sovereignVoice.stop();
    sovereignSound.playMechanicalSnap();
    onNext();
  };

  return (
    <div className="text-center py-4 px-1 sm:px-4 max-w-5xl mx-auto">
      {/* Header Pill & Title */}
      <div className="mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 rounded-full px-3.5 py-1 mb-3">
          <Globe size={13} className="text-sky-500" />
          <span className="text-[10.5px] font-mono font-bold text-sky-600 dark:text-sky-400 tracking-wider uppercase">
            Sovereign Accessibility · 6 Official Languages
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-foreground tracking-tight mb-2">
          अपनी भाषा चुनें / Select Your Language
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Touch your preferred language to begin automated OPD pre-intake and clinical triage
        </p>
      </div>

      {/* Language Monolith Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 mb-8">
        {languages.map((lang) => {
          const isSelected = selectedLanguage === lang.code;
          const isAudioPlaying = playingLang === lang.code;

          return (
            <div
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`physical-card p-5 sm:p-6 rounded-2xl cursor-pointer text-left flex flex-col justify-between min-h-[150px] transition-all duration-200 relative group ${
                isSelected
                  ? 'border-sky-500 ring-2 ring-sky-500/30 shadow-md bg-sky-500/5 dark:bg-sky-500/10'
                  : 'hover:border-foreground/30'
              }`}
            >
              {/* Top Row: Native Script & Selection Beacon */}
              <div className="flex items-center justify-between w-full mb-2">
                <span
                  className={`text-3xl font-extrabold tracking-tight transition-colors ${
                    isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-foreground'
                  }`}
                  style={{
                    fontFamily: lang.code === 'hi' || lang.code === 'mr' ? "'Noto Sans Devanagari', sans-serif" :
                               lang.code === 'bn' ? "'Noto Sans Bengali', sans-serif" :
                               lang.code === 'ta' ? "'Noto Sans Tamil', sans-serif" :
                               lang.code === 'te' ? "'Noto Sans Telugu', sans-serif" : 'var(--font-sans)'
                  }}
                >
                  {lang.label}
                </span>
                <div>
                  {isSelected ? (
                    <div className="bg-sky-500 text-white rounded-full p-1 shadow-sm">
                      <CheckCircle2 size={16} />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 group-hover:border-foreground/50 transition-colors" />
                  )}
                </div>
              </div>

              {/* Middle Row: Subtitle & Region */}
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs sm:text-[13px] font-semibold ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'}`}>
                  {lang.sub}
                </span>
                <span className="text-[10.5px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                  {lang.scriptRegion}
                </span>
              </div>

              {/* Bottom Row: Native Speech Prompt & Listen Pill */}
              <div className="flex items-center justify-between border-t border-border/50 pt-2.5 mt-1">
                <span className={`text-xs italic truncate pr-2 ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground/80'}`}>
                  "{lang.nativePrompt}"
                </span>
                <button
                  type="button"
                  onClick={(e) => handlePlayAudioPrompt(e, lang.code, lang.nativePrompt)}
                  title="बोलकर सुनें (Tap to Listen)"
                  className={`tactile-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 gap-1.5 cursor-pointer ${
                    isAudioPlaying ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/50' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Volume2 size={12} className={isAudioPlaying ? 'text-sky-500' : 'text-muted-foreground'} />
                  <span>{isAudioPlaying ? 'बोल रहे हैं...' : 'सुनें'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
