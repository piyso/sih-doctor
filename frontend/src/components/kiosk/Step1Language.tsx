import React, { useState, useEffect, useRef } from 'react';
import { Volume2, CheckCircle2, Globe } from 'lucide-react';
import { sovereignSound } from '../../utils/audio';
import { sovereignVoice } from '../../utils/SovereignVoiceEngine';
import { BCP47, KIOSK_LANGUAGES, SupportedKioskLanguage, kioskText } from '../../utils/kioskLocalization';
import { RegisterNav, useStepNav } from './kioskNav';

interface Step1LanguageProps {
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  registerNav?: RegisterNav;
}

const LANGUAGE_CARDS: Record<SupportedKioskLanguage, { label: string; font: string }> = {
  hi: { label: 'हिन्दी', font: "'Noto Sans Devanagari', sans-serif" },
  en: { label: 'English', font: 'var(--font-sans)' },
  bn: { label: 'বাংলা', font: "'Noto Sans Bengali', sans-serif" },
  mr: { label: 'मराठी', font: "'Noto Sans Devanagari', sans-serif" },
  ta: { label: 'தமிழ்', font: "'Noto Sans Tamil', sans-serif" },
  te: { label: 'తెలుగు', font: "'Noto Sans Telugu', sans-serif" },
  gu: { label: 'ગુજરાતી', font: "'Noto Sans Gujarati', sans-serif" },
  kn: { label: 'ಕನ್ನಡ', font: "'Noto Sans Kannada', sans-serif" },
  ml: { label: 'മലയാളം', font: "'Noto Sans Malayalam', sans-serif" },
  pa: { label: 'ਪੰਜਾਬੀ', font: "'Noto Sans Gurmukhi', sans-serif" },
  or: { label: 'ଓଡ଼ିଆ', font: "'Noto Sans Oriya', sans-serif" }
};

export const Step1Language: React.FC<Step1LanguageProps> = ({ selectedLanguage, onSelectLanguage, registerNav }) => {
  const [playingLang, setPlayingLang] = useState<string | null>(null);
  const touchDetectedRef = useRef(false);
  const tx = kioskText(selectedLanguage);

  useStepNav(registerNav, { canNext: true });

  // Gentle spoken prompt if nobody touches the screen for a while.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!touchDetectedRef.current) {
        sovereignVoice.speak(kioskText(selectedLanguage)('s1Hesitate'), BCP47.hi, () => setPlayingLang(null), () => setPlayingLang(null));
      }
    }, 12000);
    const handleTouch = () => { touchDetectedRef.current = true; };
    window.addEventListener('pointerdown', handleTouch);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleTouch);
      sovereignVoice.stop();
    };
  }, []);

  const handlePlay = (e: React.MouseEvent, code: SupportedKioskLanguage) => {
    e.stopPropagation();
    sovereignSound.playDialNotch();
    setPlayingLang(code);
    sovereignVoice.speak(kioskText(code)('s1Greeting'), code, () => setPlayingLang(null), () => setPlayingLang(null));
  };

  return (
    <div className="text-center py-4 px-1 sm:px-4 max-w-5xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 mb-3">
          <Globe size={18} className="text-sky-600" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-foreground tracking-tight mb-2">{tx('s1Title')}</h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">{tx('s1Sub')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 mb-8" role="radiogroup">
        {KIOSK_LANGUAGES.map(code => {
          const card = LANGUAGE_CARDS[code];
          const isSelected = selectedLanguage === code;
          const isPlaying = playingLang === code;
          const own = kioskText(code);
          return (
            <div
              key={code}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => { sovereignSound.playMechanicalSnap(); onSelectLanguage(code); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLanguage(code); } }}
              className={`physical-card p-5 sm:p-6 rounded-2xl cursor-pointer text-left flex flex-col justify-between min-h-[136px] transition-all duration-200 ${
                isSelected ? 'border-sky-500 ring-2 ring-sky-500/30 shadow-md bg-sky-500/5 dark:bg-sky-500/10' : 'hover:border-foreground/30'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <span className={`text-3xl font-extrabold tracking-tight ${isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-foreground'}`} style={{ fontFamily: card.font }}>
                  {card.label}
                </span>
                {isSelected ? (
                  <div className="bg-sky-500 text-white rounded-full p-1 shadow-sm"><CheckCircle2 size={16} /></div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border/50 pt-2.5 gap-2">
                <span className={`text-xs truncate ${isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-muted-foreground'}`} style={{ fontFamily: card.font }}>
                  {own('s1Greeting')}
                </span>
                <button
                  type="button"
                  onClick={e => handlePlay(e, code)}
                  className={`tactile-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 gap-1.5 ${isPlaying ? 'bg-sky-500/20 text-sky-700 border-sky-500/50' : 'text-muted-foreground'}`}
                >
                  <Volume2 size={12} />
                  <span style={{ fontFamily: card.font }}>{isPlaying ? own('speakingBtn') : own('listenBtn')}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
