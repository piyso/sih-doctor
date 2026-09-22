import React from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, Activity, AlertOctagon, HeartPulse, Volume2, ShieldAlert, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SocratesSymptom, VitalsData } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

interface Step4SocratesProps {
  symptoms: SocratesSymptom[];
  setSymptoms: React.Dispatch<React.SetStateAction<SocratesSymptom[]>>;
  vitals: VitalsData;
  setVitals: React.Dispatch<React.SetStateAction<VitalsData>>;
  redFlags: string[];
  selectedBodyRegion?: string;
  onNext: () => void;
  onBack: () => void;
}

export const Step4Socrates: React.FC<Step4SocratesProps> = ({
  symptoms,
  setSymptoms,
  vitals,
  setVitals,
  redFlags,
  selectedBodyRegion,
  onNext,
  onBack
}) => {
  const isKneeOrJoint = /knee|घुटना|जानु|joint|जोड़/i.test(selectedBodyRegion || '');
  const defaultCharacter = isKneeOrJoint ? 'Stiffness / Stambha' : 'Dull aching (Bheda)';

  const currentSymptom: SocratesSymptom = symptoms[0] || {
    site: selectedBodyRegion || '',
    onset: '',
    character: defaultCharacter,
    radiation: '',
    associations: [],
    timing: '',
    exacerbatingFactors: [],
    relievingFactors: [],
    severityScore: 0
  };

  // Seamless bi-directional synchronization from Step 3 3D Mannequin & Voice Intake
  React.useEffect(() => {
    if (symptoms.length === 0 && selectedBodyRegion) {
      setSymptoms([{
        site: selectedBodyRegion,
        onset: '',
        character: defaultCharacter,
        radiation: '',
        associations: [],
        timing: '',
        exacerbatingFactors: [],
        relievingFactors: [],
        severityScore: 0
      }]);
    }
  }, [selectedBodyRegion, symptoms.length, setSymptoms, defaultCharacter]);

  const updateCurrentSymptom = (field: keyof SocratesSymptom, value: any) => {
    const updated = { ...currentSymptom, [field]: value };
    setSymptoms([updated]);
  };

  const handleSliderChange = (newVal: number) => {
    sovereignSound.playDialNotch();
    updateCurrentSymptom('severityScore', newVal);
  };

  const severityColor =
    currentSymptom.severityScore >= 8 ? '#f43f5e' :
    currentSymptom.severityScore >= 5 ? '#f59e0b' :
    currentSymptom.severityScore > 0 ? '#10b981' : '#64748b';

  const WongBakerFace: React.FC<{ score: number; isSelected: boolean }> = ({ score, isSelected }) => {
    const strokeColor =
      score === 0 ? '#16a34a' :
      score === 2 ? '#059669' :
      score === 4 ? '#d97706' :
      score === 6 ? '#ea580c' :
      score === 8 ? '#dc2626' : '#991b1b';

    return (
      <svg
        width="26"
        height="26"
        viewBox="0 0 36 36"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: 'block',
          margin: '0 auto',
          transition: 'all 0.2s ease'
        }}
      >
        <circle cx="18" cy="18" r="15" fill={isSelected ? '#e0f2fe' : '#ffffff'} />
        {score < 8 ? (
          <>
            <circle cx="13" cy="14" r="1.5" fill={strokeColor} />
            <circle cx="23" cy="14" r="1.5" fill={strokeColor} />
          </>
        ) : score === 8 ? (
          <>
            <line x1="11" y1="13" x2="15" y2="15" />
            <line x1="11" y1="15" x2="15" y2="13" />
            <line x1="21" y1="13" x2="25" y2="15" />
            <line x1="21" y1="15" x2="25" y2="13" />
          </>
        ) : (
          <>
            <path d="M11 15 L14 13 L11 11" />
            <path d="M25 15 L22 13 L25 11" />
            <path d="M12 18 C12 20 10 21 10 23 C10 24.1 10.9 25 12 25 C13.1 25 14 24.1 14 23 C14 21 12 20 12 18 Z" fill="#0284c7" stroke="#0284c7" strokeWidth="0.5" />
          </>
        )}
        {score === 0 && <path d="M12 22 Q18 28 24 22" />}
        {score === 2 && <path d="M13 23 Q18 26 23 23" />}
        {score === 4 && <line x1="13" y1="23" x2="23" y2="23" />}
        {score === 6 && <path d="M13 24 Q18 21 23 24" />}
        {score === 8 && <path d="M12 25 Q18 19 24 25" />}
        {score === 10 && <path d="M12 26 Q18 18 24 26" />}
      </svg>
    );
  };

  const painFaces = [
    { score: 0, label: 'No Hurt' },
    { score: 2, label: 'Hurts Little' },
    { score: 4, label: 'Hurts More' },
    { score: 6, label: 'Even More' },
    { score: 8, label: 'Whole Lot' },
    { score: 10, label: 'Worst Hurt' }
  ];

  return (
    <div className="max-w-5xl mx-auto py-2 px-1 sm:px-4">
      {/* Clean Header */}
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight mb-1">
          दर्द व लक्षण विवरण (Pain Details)
        </h2>
        <div className="flex justify-center items-center gap-3">
          <p className="text-xs sm:text-sm text-muted-foreground">
            दर्द की तीव्रता और फैलाव का चयन करें
          </p>
          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              sovereignSound.speakGuidance('कृपया अपने दर्द का स्थान, फैलाव, और तीव्रता चुनें।');
            }}
            className="tactile-btn text-[11px] font-semibold px-2.5 py-0.5 rounded-full gap-1 text-primary border-primary/30 bg-primary/10 cursor-pointer"
          >
            <Volume2 size={12} />
            <span>सुनें</span>
          </button>
        </div>
      </div>

      {/* Emergency Red Flag Callout Banner */}
      {redFlags.length > 0 && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 mb-4 flex items-center gap-2.5">
          <AlertOctagon size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase">
              Red Flag Alert:
            </span>
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              {redFlags.join(' • ')}
            </span>
          </div>
        </div>
      )}

      {/* Code-Red Emergency Intercept */}
      {currentSymptom.severityScore >= 8 && currentSymptom.site && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/15 border border-rose-500/50 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <HeartPulse size={20} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <div className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-200">
                {/chest|precordium|heart|सीने|हृदय/i.test(currentSymptom.site)
                  ? 'EMERGENCY CODE-RED INTERCEPT: Suspected Acute Coronary Syndrome'
                  : /head|brain|cervical|सिर|मस्तिष्क/i.test(currentSymptom.site)
                  ? 'EMERGENCY CODE-RED INTERCEPT: Acute Neurological / Stroke Event'
                  : 'EMERGENCY TRIAGE INTERCEPT: Severe Acuity Level 2 Event'}
              </div>
              <div className="text-[11px] text-rose-600 dark:text-rose-300">
                Severity {currentSymptom.severityScore}/10 at {currentSymptom.site} → Route to Room 01 (Resuscitation Bay)
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              sovereignSound.playEmergencyCodeRed();
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([300, 100, 300, 100, 500]);
              }
              onNext();
            }}
            className="btn btn-danger text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Activity size={14} />
            <span>DIVERT TO ROOM 01 NOW</span>
          </button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Card 1: SOCRATES Symptom Characteristics */}
        <div className="physical-card p-4 sm:p-5 rounded-2xl flex flex-col gap-3">
          <div className="border-b border-border/70 pb-2">
            <h4 className="text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400 uppercase tracking-tight">
              1. दर्द का स्थान व प्रकार (Site &amp; Character)
            </h4>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Site (कहाँ दर्द है)
            </label>
            <input
              type="text"
              value={currentSymptom.site || ''}
              onChange={(e) => updateCurrentSymptom('site', e.target.value)}
              placeholder="e.g. Left Knee, Precordium, Epigastrium, Head..."
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder:text-muted-foreground/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Character (दर्द कैसा महसूस होता है)
            </label>
            <select
              value={currentSymptom.character || 'Dull aching (Bheda)'}
              onChange={(e) => {
                sovereignSound.playDialNotch();
                updateCurrentSymptom('character', e.target.value);
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 cursor-pointer"
            >
              <option value="Dull aching (Bheda)">मीठा-मीठा धीमा दर्द (Dull Aching / Bheda)</option>
              <option value="Sharp pricking (Toda)">तीखा चुभने वाला (Sharp Needle-like / Toda)</option>
              <option value="Crushing heaviness">भारी दबाव / कुचलने जैसा (Crushing / Heavy Pressure)</option>
              <option value="Burning sensation (Daha)">तेज़ जलन (Burning Sensation / Daha)</option>
              <option value="Throbbing / Pulsatile">धड़कने वाला दर्द (Throbbing / Pulsatile)</option>
              <option value="Stiffness / Stambha">जकड़न / अकड़न (Stiffness / Stambha)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Radiation (दर्द किस तरफ फैलता है)
            </label>
            <input
              type="text"
              value={currentSymptom.radiation || ''}
              onChange={(e) => updateCurrentSymptom('radiation', e.target.value)}
              placeholder="e.g. Left arm, neck, groin, down the leg (or None)"
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder:text-muted-foreground/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Onset &amp; Duration (कब और कैसे शुरू हुआ)
            </label>
            <input
              type="text"
              value={currentSymptom.onset || ''}
              onChange={(e) => updateCurrentSymptom('onset', e.target.value)}
              placeholder="e.g. 2 weeks, 3 days, sudden onset..."
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Card 2: Wong-Baker Pain Scale & Digital Vitals Instruments */}
        <div className="physical-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-3">
          <div>
            <div className="border-b border-border/70 pb-2 mb-3">
              <h4 className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
                2. दर्द की तीव्रता व वाइटल्स (Severity &amp; Vitals)
              </h4>
            </div>

            {/* Tactile Wong-Baker Slider Container */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/70 mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Pain Severity:
                </span>
                <span style={{ color: severityColor }} className="text-base sm:text-lg font-mono font-extrabold">
                  {currentSymptom.severityScore} / 10
                  <span className="text-xs font-sans font-semibold ml-1.5 opacity-90">
                    {currentSymptom.severityScore >= 8 ? '(Severe)' : currentSymptom.severityScore >= 5 ? '(Moderate)' : currentSymptom.severityScore > 0 ? '(Mild)' : '(No Pain)'}
                  </span>
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="10"
                value={currentSymptom.severityScore || 0}
                onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer h-1.5 rounded-lg mb-2"
                style={{ accentColor: severityColor }}
              />

              {/* Wong-Baker FACES Markers */}
              <div className="grid grid-cols-6 gap-1 text-center">
                {painFaces.map((f) => (
                  <div
                    key={f.score}
                    onClick={() => handleSliderChange(f.score)}
                    className={`cursor-pointer p-1.5 rounded-lg transition-all ${
                      currentSymptom.severityScore === f.score
                        ? 'bg-background shadow-xs border border-border ring-1 ring-sky-500/40'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <WongBakerFace score={f.score} isSelected={currentSymptom.severityScore === f.score} />
                    <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{f.score}</div>
                    <div className="text-[8.5px] font-semibold text-foreground/80 leading-tight">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bedside Vitals Telemetry Tiles */}
            <div className="grid grid-cols-2 gap-2">
              {/* 1. Blood Pressure */}
              <div className="p-3 rounded-2xl text-left border border-border/80 bg-card shadow-2xs hover:border-border transition-all">
                <div className="flex items-center gap-1.5">
                  <Activity size={13} className="text-primary" />
                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">BP</span>
                </div>
                <input
                  type="text"
                  value={vitals.bp || ''}
                  placeholder="120/80"
                  onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                  className="w-full bg-transparent border-none text-lg sm:text-xl font-mono font-extrabold text-foreground outline-hidden mt-0.5 placeholder:text-muted-foreground/30"
                />
                <div className="text-[9.5px] text-muted-foreground font-mono">mmHg</div>
              </div>

              {/* 2. Heart Rate */}
              <div className="p-3 rounded-2xl text-left border border-border/80 bg-card shadow-2xs hover:border-border transition-all">
                <div className="flex items-center gap-1.5">
                  <HeartPulse size={13} className="text-rose-500" />
                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Pulse</span>
                </div>
                <input
                  type="number"
                  value={vitals.pulse && vitals.pulse > 0 ? vitals.pulse : ''}
                  placeholder="72"
                  onChange={(e) => setVitals({ ...vitals, pulse: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-transparent border-none text-lg sm:text-xl font-mono font-extrabold text-foreground outline-hidden mt-0.5 placeholder:text-muted-foreground/30"
                />
                <div className="text-[9.5px] text-muted-foreground font-mono">BPM</div>
              </div>

              {/* 3. SpO2 Saturation */}
              <div className="p-3 rounded-2xl text-left border border-border/80 bg-card shadow-2xs hover:border-border transition-all">
                <div className="flex items-center gap-1.5">
                  <Activity size={13} className="text-primary" />
                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">SpO2</span>
                </div>
                <input
                  type="text"
                  value={vitals.spo2 || ''}
                  placeholder="98%"
                  onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                  className="w-full bg-transparent border-none text-lg sm:text-xl font-mono font-extrabold text-foreground outline-hidden mt-0.5 placeholder:text-muted-foreground/30"
                />
                <div className="text-[9.5px] text-muted-foreground font-mono">% O2</div>
              </div>

              {/* 4. Body Temperature */}
              <div className="p-3 rounded-2xl text-left border border-border/80 bg-card shadow-2xs hover:border-border transition-all">
                <div className="flex items-center gap-1.5">
                  <Activity size={13} className="text-amber-500" />
                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Temp</span>
                </div>
                <input
                  type="text"
                  value={vitals.temp || ''}
                  placeholder="98.6°F"
                  onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                  className="w-full bg-transparent border-none text-lg sm:text-xl font-mono font-extrabold text-foreground outline-none mt-0.5 placeholder:text-muted-foreground/30"
                />
                <div className="text-[9.5px] text-muted-foreground font-mono">°F</div>
              </div>
            </div>

            {/* Autonomous Biometric Concordance */}
            {(() => {
              const pulseNum = Number(vitals.pulse) || 0;
              const sbp = parseInt((vitals.bp || '').split('/')[0], 10) || 0;
              const spo2Num = parseInt((vitals.spo2 || '').replace('%', ''), 10) || 0;
              const isSeverePain = currentSymptom.severityScore >= 8;
              const isModeratePain = currentSymptom.severityScore >= 4;
              const isLowPain = currentSymptom.severityScore <= 3 && currentSymptom.severityScore > 0;
              const hasVitalsRecorded = pulseNum > 0 || sbp > 0 || spo2Num > 0;

              if (!hasVitalsRecorded && currentSymptom.severityScore === 0) {
                return (
                  <div className="mt-3 p-2.5 rounded-xl bg-card border border-border/80 flex items-center gap-2 shadow-2xs">
                    <ShieldCheck size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      वाइटल्स एवं दर्द पैमाना प्रविष्टि की प्रतीक्षा है (Awaiting Biometric &amp; Pain Matrix Entry) · ESI Level 4 (Routine)
                    </span>
                  </div>
                );
              }

              const hasAutonomicInstability = pulseNum > 105 || (pulseNum > 0 && pulseNum < 50) || sbp > 150 || (sbp > 0 && sbp < 90) || (spo2Num > 0 && spo2Num < 92);
              const isHighPainNormalVitals = isSeverePain && pulseNum >= 60 && pulseNum <= 80 && sbp >= 110 && sbp <= 128 && (spo2Num >= 98 || spo2Num === 0);
              const isLowPainSevereInstability = isLowPain && hasAutonomicInstability;

              if (isHighPainNormalVitals) {
                return (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                    <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                      <strong>बायोमेट्रिक संतुलन अंशांकन:</strong> वाइटल्स स्थिर हैं (HR {pulseNum || 'Norm'}, SpO2 {spo2Num || 'Norm'}%). क्लिनिकल ट्राइएज संतुलित किया जाएगा।
                    </div>
                  </div>
                );
              }

              if (isLowPainSevereInstability) {
                return (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2">
                    <AlertOctagon size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 leading-snug">
                      <strong>मौन फिजियोलॉजिकल विचलन:</strong> कम दर्द के बावजूद वाइटल्स में विचलन है (HR {pulseNum}, BP {vitals.bp}). आपातकालीन ट्राइएज सक्रिय है।
                    </div>
                  </div>
                );
              }

              const esiLevel = isSeverePain ? '2 (Emergent)' : isModeratePain ? '3 (Urgent)' : '4 (Standard)';

              return (
                <div className="mt-3 p-2 rounded-xl bg-card border border-border/80 flex items-center gap-2 shadow-2xs">
                  <ShieldCheck size={14} className="text-primary shrink-0" />
                  <span className="text-[11px] text-foreground font-semibold">
                    वाइटल्स एवं लक्षण सुसंगत (Biometric Telemetry Concordant) · ESI Level {esiLevel}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Bottom Step 4 Action Navigation Bar */}
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
          <span>पिछला: लक्षण (Back: Symptoms)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            try { sovereignSound.playMechanicalSnap(); } catch {}
            onNext();
          }}
          className="btn btn-primary px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-heading font-extrabold flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          <span>आगे बढ़ें: पाचन व स्वास्थ्य (Next: Health)</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
