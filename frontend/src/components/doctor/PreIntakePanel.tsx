import React from 'react';
import { User, Activity, Flame, ShieldCheck, Heart, AlertCircle, FileText, CheckCircle2, AlertTriangle, Sparkles, HeartPulse } from 'lucide-react';
import { SessionDetail } from '../../types/api';

interface PreIntakePanelProps {
  session: SessionDetail | null;
}

export const PreIntakePanel: React.FC<PreIntakePanelProps> = ({ session }) => {
  if (!session) {
    return (
      <div className="physical-card p-8 text-center flex flex-col items-center justify-center gap-3">
        <User size={28} className="text-muted-foreground/40" />
        <span className="text-xs text-muted-foreground font-medium">Select a patient from the queue to view clinical intake.</span>
      </div>
    );
  }

  const primarySymptom = session.symptoms?.[0];
  const isEmergency = session.triagePriority === 'EMERGENCY_RED_FLAG';
  const isHigh = session.triagePriority === 'HIGH_PRIORITY';

  const sbp = parseInt((session.vitals?.bp || '120/80').split('/')[0], 10) || 120;
  const bpStatus = sbp >= 160 ? 'Stage 2 HTN' : sbp >= 140 ? 'Stage 1 HTN' : 'Optimal';

  const pulseNum = session.vitals?.pulse || 72;
  const pulseStatus = pulseNum >= 100 ? 'Tachycardia' : pulseNum < 60 ? 'Bradycardia' : 'Sinus Rhythm';

  const spo2Num = parseInt(String(session.vitals?.spo2 || '98').replace('%', ''), 10) || 98;
  const spo2Status = spo2Num < 92 ? 'Critical Hypoxia' : spo2Num < 95 ? 'Hypoxia' : 'Normal Sat';

  const tempNum = parseFloat(String(session.vitals?.temp || '98.6').replace('°F', '')) || 98.6;
  const tempStatus = tempNum >= 100.4 ? 'Febrile' : 'Afebrile';

  // Dynamic Tridosha calculation based on patient prakriti
  const prakritiStr = (session.pariksha?.prakriti || 'Vata-Pitta').toLowerCase();
  let vataPct = 34;
  let pittaPct = 33;
  let kaphaPct = 33;

  if (prakritiStr.includes('pitta-vata')) {
    pittaPct = 50; vataPct = 35; kaphaPct = 15;
  } else if (prakritiStr.includes('vata-pitta')) {
    vataPct = 50; pittaPct = 35; kaphaPct = 15;
  } else if (prakritiStr.includes('kapha-vata') || prakritiStr.includes('vata-kapha')) {
    kaphaPct = 50; vataPct = 35; pittaPct = 15;
  } else if (prakritiStr.includes('kapha-pitta') || prakritiStr.includes('pitta-kapha')) {
    pittaPct = 50; kaphaPct = 35; vataPct = 15;
  } else if (prakritiStr.includes('vata')) {
    vataPct = 65; pittaPct = 20; kaphaPct = 15;
  } else if (prakritiStr.includes('pitta')) {
    pittaPct = 65; vataPct = 20; kaphaPct = 15;
  } else if (prakritiStr.includes('kapha')) {
    kaphaPct = 65; pittaPct = 20; vataPct = 15;
  }

  const painScore = primarySymptom?.severityScore ?? (isEmergency ? 9 : isHigh ? 7 : 4);

  return (
    <div className="physical-card p-4 flex flex-col gap-3.5">
      {/* Patient Profile Header */}
      <div className="flex justify-between items-center border-b border-border/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
              isEmergency
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                : 'bg-muted text-foreground border border-border/80'
            }`}
          >
            {session.patientName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-heading font-bold text-foreground">
                {session.patientName}
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {session.age}y · {session.gender}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              ABHA: <span className="text-primary font-semibold">{session.patientId}</span>
            </div>
          </div>
        </div>

        <div>
          {isEmergency ? (
            <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-mono text-[10px] font-bold uppercase">
              EMERGENCY
            </span>
          ) : isHigh ? (
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono text-[10px] font-bold uppercase">
              HIGH PRIORITY
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-muted text-foreground border border-border/80 font-mono text-[10px] font-semibold uppercase">
              ROUTINE
            </span>
          )}
        </div>
      </div>

      {/* Maternal-Fetal Pharmacology Guard (If Pregnant or Lactating) */}
      {(session.isPregnant || session.isLactating) && (
        <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-pink-700 dark:text-pink-300 font-semibold">
            <Sparkles size={14} className="text-pink-600 dark:text-pink-400" />
            <span>Maternal Guard: {session.gestationalWeeks ? `${session.gestationalWeeks}w Gestation` : 'Pregnant'}</span>
          </div>
          <span className="text-[9.5px] font-mono font-bold text-pink-700 dark:text-pink-300 bg-pink-500/15 px-1.5 py-0.5 rounded">
            LOCKED TERATOGENS
          </span>
        </div>
      )}

      {/* 4-Vitals Metric Tiles */}
      <div className="vitals-4-grid">
        {/* 1. Blood Pressure */}
        <div className="apple-vitals-tile sky">
          <div className="text-[10px] font-mono text-muted-foreground uppercase">Blood Pressure</div>
          <div className="font-mono text-sm font-extrabold text-foreground mt-0.5">
            {session.vitals?.bp || '120/80'}
          </div>
          <div className="text-[9.5px] text-muted-foreground font-medium">{bpStatus}</div>
        </div>

        {/* 2. Pulse Rate */}
        <div className="apple-vitals-tile rose">
          <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center justify-center gap-1">
            <Heart size={10} className="text-rose-500" />
            <span>Pulse</span>
          </div>
          <div className="font-mono text-sm font-extrabold text-foreground mt-0.5">
            {pulseNum} <span className="text-[10px] font-normal text-muted-foreground">bpm</span>
          </div>
          <div className="text-[9.5px] text-muted-foreground font-medium">{pulseStatus}</div>
        </div>

        {/* 3. SpO2 */}
        <div className="apple-vitals-tile mint">
          <div className="text-[10px] font-mono text-muted-foreground uppercase">SpO2</div>
          <div className="font-mono text-sm font-extrabold text-foreground mt-0.5">
            {spo2Num}%
          </div>
          <div className="text-[9.5px] text-muted-foreground font-medium">{spo2Status}</div>
        </div>

        {/* 4. Temperature */}
        <div className="apple-vitals-tile peach">
          <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center justify-center gap-1">
            <Flame size={10} className="text-amber-500" />
            <span>Temp</span>
          </div>
          <div className="font-mono text-sm font-extrabold text-foreground mt-0.5">
            {tempNum}°F
          </div>
          <div className="text-[9.5px] text-muted-foreground font-medium">{tempStatus}</div>
        </div>
      </div>

      {/* Tridosha Balance Bar */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border/75 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">Tridosha Balance</span>
          <span className="text-xs font-heading font-bold text-foreground">{session.pariksha?.prakriti || 'Vata-Pitta'}</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-1 bg-muted p-0.5">
          <div className="bg-sky-500 rounded-l transition-all duration-300" style={{ width: `${vataPct}%` }} title={`Vata ${vataPct}% (Kinetic)`} />
          <div className="bg-rose-500 transition-all duration-300" style={{ width: `${pittaPct}%` }} title={`Pitta ${pittaPct}% (Metabolic)`} />
          <div className="bg-emerald-500 rounded-r transition-all duration-300" style={{ width: `${kaphaPct}%` }} title={`Kapha ${kaphaPct}% (Structural)`} />
        </div>
        <div className="flex justify-between text-[9.5px] font-mono text-muted-foreground">
          <span>Vata {vataPct}%</span>
          <span>Pitta {pittaPct}%</span>
          <span>Kapha {kaphaPct}%</span>
        </div>

        {/* Biometric Concordance */}
        {session.concordance && (
          <div className="text-[10.5px] flex justify-between items-center border-t border-border/70 pt-2 mt-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              {session.concordance.status === 'SILENT_ISCHEMIA_RISK' ? (
                <>
                  <AlertTriangle size={12} className="text-rose-500" />
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">Silent Ischemia override active</span>
                </>
              ) : session.concordance.status === 'MALINGERING_SUSPECTED' ? (
                <>
                  <AlertTriangle size={12} className="text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Autonomic discordance: normal vitals</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Biometric Concordance: Pain matches vitals</span>
                </>
              )}
            </span>
            <span className="font-mono font-bold text-foreground">ESI Tier {session.concordance.esiLevel}</span>
          </div>
        )}
      </div>

      {/* SOCRATES Anamnesis */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border/75">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-primary">
            SOCRATES Anamnesis
          </span>
          <span
            className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${
              painScore >= 8
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                : 'bg-muted text-foreground border border-border/70'
            }`}
          >
            Pain: {painScore}/10
          </span>
        </div>

        {primarySymptom ? (
          <div className="text-xs text-foreground space-y-1">
            <div><span className="text-muted-foreground">Site:</span> {primarySymptom.site} · <span className="text-muted-foreground">Onset:</span> {primarySymptom.onset}</div>
            <div><span className="text-muted-foreground">Character:</span> {primarySymptom.character} · <span className="text-muted-foreground">Radiation:</span> {primarySymptom.radiation}</div>
            {primarySymptom.associations && primarySymptom.associations.length > 0 && (
              <div><span className="text-muted-foreground">Associated:</span> {primarySymptom.associations.join(', ')}</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No symptoms recorded.</div>
        )}
      </div>

      {/* Dashavidha Pariksha Grid */}
      <div className="p-3 rounded-xl bg-muted/40 border border-border/75">
        <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-2">
          Dashavidha Pariksha
        </span>

        <div className="pariksha-4-grid text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">Prakriti</span>
            <strong className="text-foreground text-xs">{session.pariksha?.prakriti || 'Vata-Pitta'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Vikriti</span>
            <strong className="text-amber-600 dark:text-amber-400 text-xs">{session.pariksha?.vikriti || 'None'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Agni</span>
            <strong className="text-amber-600 dark:text-amber-400 text-xs">{session.pariksha?.agni || 'SAMAGNI'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Sara Dhatu</span>
            <strong className="text-foreground text-xs">{session.pariksha?.sara || 'Madhyama'}</strong>
          </div>
        </div>
      </div>

      {/* Normalized Lab Markers */}
      {session.normalizedLabMarkers && session.normalizedLabMarkers.length > 0 && (
        <div className="p-3 rounded-xl bg-muted/40 border border-sky-400/30">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Digitized Biomarkers
            </span>
            <span className="text-[9.5px] font-mono text-muted-foreground">OCR Verified</span>
          </div>

          <div className="space-y-1">
            {session.normalizedLabMarkers.map((m, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-foreground">{m.marker}</span>
                <span className={`font-mono font-bold ${m.isAbnormal ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {m.normalizedValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
