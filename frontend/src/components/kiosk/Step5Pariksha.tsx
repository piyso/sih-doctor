import React, { useEffect } from 'react';
import {
  Flame,
  CheckCircle2,
  Shield,
  Wind,
  Droplets,
  Volume2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Scale
} from 'lucide-react';
import { DashavidhaPariksha, AgniType, SocratesSymptom } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

interface Step5ParikshaProps {
  pariksha: DashavidhaPariksha;
  setPariksha: React.Dispatch<React.SetStateAction<DashavidhaPariksha>>;
  symptoms?: SocratesSymptom[];
  selectedBodyRegion?: string;
  transcript?: string;
  language?: string;
  onNext: () => void;
  onBack: () => void;
}

export const Step5Pariksha: React.FC<Step5ParikshaProps> = ({
  pariksha,
  setPariksha,
  symptoms = [],
  selectedBodyRegion = '',
  transcript = '',
  language = 'hi',
  onNext,
  onBack
}) => {
  const hasUserModified = React.useRef(false);

  // Deep Ayurvedic Clinical Diagnostic Evaluator
  // Knee (जानु) / Joint (संधि) -> Sandhigata Vata (वात व्याधि) -> Pakwashaya Mula -> Vishamagni (विषमाग्नि)
  const fullText = (transcript + ' ' + selectedBodyRegion + ' ' + symptoms.map(s => `${s.site} ${s.character} ${s.associations?.join(' ')}`).join(' ')).toLowerCase();

  const isJointOrVata = (
    /knee|घुटना|जानु|leg|foot|hip|joint|जोड़|संधि|पिंडली|sprain|ligament|arthritis|गठिया|वात|spine|back|कमर|kati|sciatica|सायटिका|shoulder|कंधा/i.test(selectedBodyRegion || '') ||
    /knee|घुटना|जानु|कट-कट|जोड़|joint|arthritis|गठिया|चलने में|वात|कब्ज|गैस|sprain|ligament|चोट|जानु संधि/i.test(fullText)
  );
  const isPitta = (
    /acidity|acid|burn|जलन|खट्टी|दाह|pitta|पित्त|epigastrium|heartburn|छाती में जलन|सीने में जलन/i.test(selectedBodyRegion || '') ||
    /जलन|acid|burn|heartburn|pitta|पित्त|खट्टी डकार|दाह/i.test(fullText)
  );
  const isKapha = (
    /lung|फेफड़े|cough|खांसी|बलगम|phlegm|asthma|दमा|कफ|भारीपन|swelling/i.test(selectedBodyRegion || '') ||
    /कफ|cough|बलगम|phlegm|भारीपन|sluggish/i.test(fullText)
  );

  // Auto-calibrate on mount or when symptom/region context changes unless patient manually customized
  useEffect(() => {
    if (hasUserModified.current) return;

    let inferredAgni: AgniType = 'SAMAGNI';
    let inferredPrakriti = 'Vata-Pitta';
    let inferredVikriti = 'Sama';

    if (isJointOrVata) {
      // Sandhigata Vata has its origin in Pakwashaya (colon) -> causes Vishamagni (erratic appetite, gas, bloating)
      inferredAgni = 'VISHAMAGNI';
      inferredPrakriti = 'Vataja';
      inferredVikriti = 'Vata Aggravation';
    } else if (isPitta) {
      inferredAgni = 'TIKSHNAGNI';
      inferredPrakriti = 'Pittaja';
      inferredVikriti = 'Pitta Aggravation';
    } else if (isKapha) {
      inferredAgni = 'MANDAGNI';
      inferredPrakriti = 'Kaphaja';
      inferredVikriti = 'Kapha Aggravation';
    }

    setPariksha(prev => ({
      ...prev,
      agni: inferredAgni,
      prakriti: inferredPrakriti,
      vikriti: inferredVikriti,
      sara: prev.sara || 'Madhyama',
      satva: prev.satva || 'Pravara'
    }));
  }, [selectedBodyRegion, transcript, symptoms]);

  const handleSelectAgni = (type: AgniType) => {
    hasUserModified.current = true;
    try { sovereignSound.playDialNotch(); } catch {}
    setPariksha(prev => ({ ...prev, agni: type }));
  };

  const handleSelectPrakriti = (p: string) => {
    hasUserModified.current = true;
    try { sovereignSound.playDialNotch(); } catch {}
    setPariksha(prev => ({ ...prev, prakriti: p }));
  };

  const handleSelectVitality = (v: 'Pravara' | 'Madhyama' | 'Avara') => {
    hasUserModified.current = true;
    try { sovereignSound.playDialNotch(); } catch {}
    setPariksha(prev => ({ ...prev, sara: v, satva: v }));
  };

  const handleAudioGuidance = () => {
    try {
      sovereignSound.playMechanicalSnap();
      const guidanceTexts: Record<string, string> = {
        'hi': 'कृपया अपनी पाचन शक्ति, शारीरिक प्रकृति और ऊर्जा स्तर चुनें, फिर आगे बढ़ें।',
        'en': 'Please check your digestion, body constitution and energy level, then tap next.'
      };
      sovereignSound.speakGuidance(guidanceTexts[language] || guidanceTexts['hi']);
    } catch {}
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-2 px-2 sm:px-4 flex flex-col gap-5 animate-in fade-in duration-300">
      
      {/* 1. Clean Hospital Header */}
      <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <Flame size={20} />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="font-heading font-extrabold text-base sm:text-lg text-foreground">
              पाचन व स्वास्थ्य (Digestion & Health)
            </span>
            <span className="text-xs text-muted-foreground font-sans mt-0.5">
              अपनी भूख, पाचन व सामान्य ऊर्जा का चयन करें
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAudioGuidance}
          className="tactile-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/10 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
          title="Audio Guidance"
        >
          <Volume2 size={15} />
          <span>सुनें (Audio)</span>
        </button>
      </div>

      {/* 3. Question 1: भूख व पाचन कैसा रहता है? (Digestion & Appetite) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <span className="font-heading font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
            <Flame size={18} className="text-amber-500" />
            <span>1. आपकी भूख व पाचन कैसा रहता है? (Digestion & Appetite)</span>
          </span>
          <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            अग्नि परीक्षा
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {[
            {
              type: 'SAMAGNI' as AgniType,
              title: 'संतुलित पाचन (Normal / Healthy)',
              sub: 'समय पर भूख लगती है, भोजन आसानी से पचता है, गैस या जलन नहीं होती।',
              icon: Shield,
              badgeColor: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
            },
            {
              type: 'VISHAMAGNI' as AgniType,
              title: 'गैस व अनियमित (Gas & Irregular)',
              sub: 'कभी तेज भूख तो कभी बिल्कुल नहीं, पेट में गैस, भारीपन व फूलापन।',
              icon: Wind,
              badgeColor: 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10'
            },
            {
              type: 'TIKSHNAGNI' as AgniType,
              title: 'जलन व एसिडिटी (Burning & Acidity)',
              sub: 'तेज भूख, सीने व पेट में जलन, खट्टी डकार या भोजन के बाद दाह।',
              icon: Flame,
              badgeColor: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
            },
            {
              type: 'MANDAGNI' as AgniType,
              title: 'भारीपन व सुस्ती (Heavy & Sluggish)',
              sub: 'धीमा पाचन, भोजन के बाद अत्यधिक भारीपन, आलस्य व अपच।',
              icon: Droplets,
              badgeColor: 'border-teal-500/40 text-teal-600 dark:text-teal-400 bg-teal-500/10'
            }
          ].map((opt) => {
            const isSelected = pariksha.agni === opt.type;
            const Icon = opt.icon;
            const isAutoCalibrated = isSelected && !hasUserModified.current && (
              (opt.type === 'VISHAMAGNI' && isJointOrVata) ||
              (opt.type === 'TIKSHNAGNI' && isPitta) ||
              (opt.type === 'MANDAGNI' && isKapha)
            );

            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelectAgni(opt.type)}
                className={`p-3.5 rounded-2xl text-left border cursor-pointer transition-all flex items-start justify-between gap-3 shadow-2xs hover:shadow-xs active:scale-98 ${
                  isSelected
                    ? `${opt.badgeColor} ring-2 ring-primary/40 font-bold bg-primary/5 shadow-sm`
                    : 'bg-muted/30 border-border/70 hover:bg-muted/60 text-foreground'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${opt.badgeColor}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-heading font-bold text-xs sm:text-sm text-foreground">
                        {opt.title}
                      </span>
                      {isAutoCalibrated && (
                        <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {isJointOrVata && opt.type === 'VISHAMAGNI' ? 'घुटने/जोड़ अनुसार चयनित' : 'स्वतः चयनित'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-sans mt-0.5 leading-relaxed">
                      {opt.sub}
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-border/80 shrink-0 mt-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Question 2: शारीरिक प्रकृति */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <span className="font-heading font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            <span>2. आपकी शारीरिक प्रकृति (Body Type)</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {[
            { id: 'Vataja', title: 'हल्का शरीर (Vata)', sub: 'ठंड लगना, सक्रिय, दुबला शरीर' },
            { id: 'Pittaja', title: 'गर्म शरीर (Pitta)', sub: 'गर्मी लगना, तेज भूख, मध्यम देह' },
            { id: 'Kaphaja', title: 'मजबूत शरीर (Kapha)', sub: 'भारी शरीर, शांत, स्थिर' },
            { id: 'Vata-Pitta', title: 'संतुलित (Balanced)', sub: 'दोषों का मिला-जुला प्रभाव' }
          ].map((p) => {
            const isSelected = (pariksha.prakriti || 'Vata-Pitta') === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPrakriti(p.id)}
                className={`p-3 rounded-2xl text-center border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 shadow-2xs active:scale-95 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold ring-2 ring-primary/40'
                    : 'bg-muted/40 hover:bg-muted text-foreground border-border/70'
                }`}
              >
                <span className="font-heading font-bold text-xs sm:text-sm">{p.title}</span>
                <span className="text-[10.5px] font-sans opacity-80">{p.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Question 3: ऊर्जा व सहनशक्ति */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <span className="font-heading font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
            <Scale size={18} className="text-primary" />
            <span>3. ऊर्जा स्तर व सहनशक्ति (Energy Level)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {[
            {
              key: 'Pravara' as const,
              title: 'उत्तम ऊर्जा (High)',
              sub: 'दिनभर अच्छी स्फूर्ति व ताज़गी।',
              dot: 'bg-emerald-500'
            },
            {
              key: 'Madhyama' as const,
              title: 'सामान्य ऊर्जा (Normal)',
              sub: 'सामान्य ऊर्जा व दैनिक काम।',
              dot: 'bg-amber-500'
            },
            {
              key: 'Avara' as const,
              title: 'कमजोरी (Low)',
              sub: 'जल्दी थकान व कमजोरी महसूस होना।',
              dot: 'bg-rose-500'
            }
          ].map((lvl) => {
            const isSelected = (pariksha.sara || 'Madhyama') === lvl.key;
            return (
              <button
                key={lvl.key}
                type="button"
                onClick={() => handleSelectVitality(lvl.key)}
                className={`p-3.5 rounded-2xl text-left border cursor-pointer transition-all flex flex-col justify-between gap-1.5 shadow-2xs active:scale-98 ${
                  isSelected
                    ? 'bg-card border-primary text-foreground ring-2 ring-primary/40 font-bold shadow-xs'
                    : 'bg-muted/40 hover:bg-muted text-foreground border-border/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${lvl.dot}`} />
                    <span className="font-heading font-bold text-xs sm:text-sm text-foreground">
                      {lvl.title}
                    </span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-primary" />}
                </div>
                <span className="text-xs text-muted-foreground font-sans leading-relaxed">
                  {lvl.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Bottom Navigation Action Bar */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/70">
        <button
          type="button"
          onClick={() => {
            try { sovereignSound.playMechanicalSnap(); } catch {}
            onBack();
          }}
          className="tactile-btn px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground border border-border/80 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <ArrowLeft size={16} />
          <span>पिछला: लक्षण (Back to Symptoms)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            try { sovereignSound.playCrystalChime(); } catch {}
            onNext();
          }}
          className="btn btn-primary px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-heading font-extrabold flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          <span>आगे बढ़ें: दस्तावेज़ स्कैन</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
