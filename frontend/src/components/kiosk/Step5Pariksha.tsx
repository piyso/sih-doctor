import React from 'react';
import { ArrowLeft, ArrowRight, Flame, CheckCircle2, Check } from 'lucide-react';
import { DashavidhaPariksha, AgniType } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

interface Step5ParikshaProps {
  pariksha: DashavidhaPariksha;
  setPariksha: React.Dispatch<React.SetStateAction<DashavidhaPariksha>>;
  onNext: () => void;
  onBack: () => void;
}

export const Step5Pariksha: React.FC<Step5ParikshaProps> = ({
  pariksha,
  setPariksha,
  onNext,
  onBack
}) => {
  const agniOptions: { type: AgniType; label: string; desc: string; citation: string }[] = [
    {
      type: 'SAMAGNI',
      label: 'समाग्नि (Samagni - Balanced)',
      desc: 'Balanced digestion & assimilation; food digests smoothly without gas or hyperacidity.',
      citation: 'Doshic Equilibrium'
    },
    {
      type: 'VISHAMAGNI',
      label: 'विषमाग्नि (Vishamagni - Irregular)',
      desc: 'Erratic appetite & metabolic rate; alternates between fast transit and gas/bloating.',
      citation: 'Vata Dominant'
    },
    {
      type: 'TIKSHNAGNI',
      label: 'तीक्ष्णाग्नि (Tikshnagni - Hypermetabolic)',
      desc: 'Intense metabolic fire, acid reflux, ravenous hunger, sharp internal heat.',
      citation: 'Pitta Dominant'
    },
    {
      type: 'MANDAGNI',
      label: 'मन्दाग्नि (Mandagni - Hypometabolic)',
      desc: 'Sluggish metabolic fire, post-prandial heaviness, slow transit, lethargy.',
      citation: 'Kapha Dominant'
    }
  ];

  const prakritiOptions = [
    'Vataja',
    'Pittaja',
    'Kaphaja',
    'Vata-Pitta',
    'Pitta-Kapha',
    'Vata-Kapha',
    'Sannipataja'
  ];

  const saraOptions = ['Pravara (Superior / Robust)', 'Madhyama (Medium)', 'Avara (Deficient / Low Reserve)'];
  const satvaOptions = ['Pravara (High Mental Fortitude)', 'Madhyama (Moderate Resilience)', 'Avara (Anxious / Low Tolerance)'];

  const handleSelectAgni = (type: AgniType) => {
    sovereignSound.playDialNotch();
    setPariksha({ ...pariksha, agni: type });
  };

  const handleSelectPrakriti = (p: string) => {
    sovereignSound.playDialNotch();
    setPariksha({ ...pariksha, prakriti: p });
  };

  return (
    <div className="max-w-4xl mx-auto py-2 px-1 sm:px-4">
      {/* Sleek Minimalist Header */}
      <div className="text-center mb-5 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight mb-1">
          आयुष दशविध परीक्षा · Dashavidha Pariksha
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Standardized constitutional assessment mapped to NAMASTE &amp; Charaka Samhita
        </p>
      </div>

      {/* Agni Selector Card */}
      <div className="physical-card p-4 sm:p-5 rounded-2xl mb-4">
        <div className="flex justify-between items-center mb-3 border-b border-border/70 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-amber-500" />
            <h4 className="text-xs sm:text-sm font-bold text-foreground">
              जठराग्नि परीक्षा (Digestive &amp; Metabolic Fire Assessment)
            </h4>
          </div>
          <span className="text-[10.5px] font-mono text-muted-foreground">
            Charaka Chikitsa 15/3
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {agniOptions.map((opt) => {
            const isSelected = pariksha.agni === opt.type;
            return (
              <div
                key={opt.type}
                onClick={() => handleSelectAgni(opt.type)}
                className={`p-3 rounded-xl cursor-pointer transition-all flex flex-col justify-between border ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-xs ring-1 ring-amber-500/30'
                    : 'bg-muted/30 border-border/70 hover:bg-muted/60'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                      {opt.label.split(' ')[0]}
                    </span>
                    {isSelected ? (
                      <CheckCircle2 size={14} className="text-amber-500" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-border" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mb-2">
                    {opt.desc}
                  </p>
                </div>
                <span className="text-[9.5px] font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded self-start">
                  {opt.citation}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prakriti & Secondary Factors Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* Prakriti Selection */}
        <div className="physical-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground mb-2.5">
              प्रकृति निर्धारण (Doshic Prakriti Classification)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {prakritiOptions.map((p) => {
                const isSelected = pariksha.prakriti === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPrakriti(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-600 shadow-xs font-bold'
                        : 'bg-muted/40 text-foreground border-border/70 hover:bg-muted'
                    }`}
                  >
                    {isSelected && <Check size={11} />}
                    <span>{p}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dhatu Sara & Manasika Satva */}
        <div className="physical-card p-4 sm:p-5 rounded-2xl flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              धातु सार (Dhatu Sara - Tissue Reserve)
            </label>
            <select
              value={pariksha.sara}
              onChange={(e) => {
                sovereignSound.playDialNotch();
                setPariksha({ ...pariksha, sara: e.target.value as any });
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 cursor-pointer"
            >
              {saraOptions.map((s, idx) => (
                <option key={idx} value={s.split(' ')[0]}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              मानसिक सत्त्व (Manasika Satva - Mental Resilience)
            </label>
            <select
              value={pariksha.satva}
              onChange={(e) => {
                sovereignSound.playDialNotch();
                setPariksha({ ...pariksha, satva: e.target.value as any });
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 cursor-pointer"
            >
              {satvaOptions.map((s, idx) => (
                <option key={idx} value={s.split(' ')[0]}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
