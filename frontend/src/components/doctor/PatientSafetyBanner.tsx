import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Baby, Droplets, HeartPulse, Scale, ShieldAlert, Pill, UserCheck } from 'lucide-react';
import { SessionDetail } from '../../types/api';

const HIGH_RISK = /warfarin|acitrom|acenocoumarol|apixaban|rivaroxaban|dabigatran|insulin|digoxin|lithium|methotrexate|phenytoin|carbamazepine|valproate|amiodarone|clopidogrel|tacrolimus|cyclosporin/i;

/**
 * The facts that must never be more than zero clicks away: allergies, pregnancy / breastfeeding,
 * kidney function, early-warning score, weight (for children), and high-risk medicines on board.
 */
export const PatientSafetyBanner: React.FC<{ session: SessionDetail; claimedByOther?: string | null; actions?: React.ReactNode }> = ({ session, claimedByOther, actions }) => {
  const ctx = session.patientContext;
  const allergies = ctx?.allergies;
  const news = session.vitalsAssessment;
  const reported = ctx?.reportedMedicines || [];
  const onBoard = reported.filter(m => HIGH_RISK.test(m));
  const child = typeof session.age === 'number' && session.age < 12;
  const weight = ctx?.weightKg || session.weightKg || (session.vitals as any)?.weightKg;
  const missingNews = (session.vitals as any)?.news2?.missing as string[] | undefined;

  // The queue and intake panes stick just below this banner; tell them how tall it is (chips wrap).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--desk-banner-h', `${Math.ceil(el.getBoundingClientRect().height) + 12}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--desk-banner-h'); };
  }, []);

  const chip = (tone: 'red' | 'amber' | 'pink' | 'sky' | 'muted', children: React.ReactNode, title?: string) => (
    <span title={title} className={`px-2 py-1 rounded-lg border text-[11.5px] font-semibold flex items-center gap-1.5 ${
      tone === 'red' ? 'bg-rose-600 text-white border-rose-700'
        : tone === 'amber' ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/40'
        : tone === 'pink' ? 'bg-pink-500/15 text-pink-900 dark:text-pink-100 border-pink-500/40'
        : tone === 'sky' ? 'bg-sky-500/10 text-sky-900 dark:text-sky-100 border-sky-500/30'
        : 'bg-muted text-muted-foreground border-border'}`}>{children}</span>
  );

  return (
    <div ref={ref} className="doctor-safety-banner no-print sticky z-30 mb-3 rounded-2xl border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-sm flex items-center gap-2 flex-wrap" aria-label="Patient safety summary" data-testid="safety-banner">
      <span className="text-sm font-heading font-extrabold text-foreground mr-1">{session.patientName}</span>
      <span className="text-xs font-mono text-muted-foreground">{session.age ? `${session.age} y` : ''} · {session.gender}{weight ? ` · ${weight} kg` : ''}</span>
      {claimedByOther && chip('amber', <><UserCheck size={12} /> With {claimedByOther}</>)}
      {allergies === undefined
        ? chip('amber', <><ShieldAlert size={12} /> Allergies not asked</>, 'Ask about drug allergies before prescribing')
        : allergies.length
          ? chip('red', <><ShieldAlert size={12} /> ALLERGY: {allergies.map(a => `${a.agent}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ')}</>)
          : chip('muted', <>No known drug allergies</>)}
      {session.isPregnant && chip('pink', <><Baby size={12} /> Pregnant{session.gestationalWeeks ? ` ${session.gestationalWeeks} wk` : ''}</>)}
      {session.isPregnant === null && String(session.gender).toUpperCase() === 'FEMALE' && session.age >= 12 && session.age <= 50
        && chip('amber', <><Baby size={12} /> Pregnancy status not known</>, 'Not answered or not sure at the kiosk — ask before prescribing')}
      {session.isLactating && chip('pink', <><Baby size={12} /> Breastfeeding</>)}
      {ctx?.eGfr !== undefined
        ? chip(ctx.eGfr < 30 ? 'red' : ctx.eGfr < 60 ? 'amber' : 'muted', <><Droplets size={12} /> eGFR {ctx.eGfr}{ctx.eGfrMethod === 'CKD-EPI-2021' ? ' (CKD-EPI)' : ''}</>, ctx.latestCreatinine ? `Creatinine ${ctx.latestCreatinine.value} ${ctx.latestCreatinine.unit}` : undefined)
        : chip('muted', <><Droplets size={12} /> Kidney function not on file</>)}
      {news?.applicable && chip(news.band === 'HIGH' ? 'red' : news.band === 'MEDIUM' || news.band === 'LOW_MEDIUM' ? 'amber' : 'muted', <><HeartPulse size={12} /> NEWS2 {news.news2}{news.selfReported ? ' (self-reported)' : ''}{missingNews?.length ? ` · missing ${missingNews.join(', ')}` : ''}</>, news.clinicalResponse)}
      {child && !weight && chip('amber', <><Scale size={12} /> Weight needed for child doses</>)}
      {onBoard.length > 0 && chip('amber', <><Pill size={12} /> On: {onBoard.join(', ')}</>, 'High-risk medicines the patient reports taking')}
      {(ctx?.conditions?.length || 0) > 0 && chip('sky', <><AlertTriangle size={12} /> {ctx!.conditions!.slice(0, 4).join(', ')}</>)}
      {/* Patient-scoped actions (call, not present, ADR) live with the patient, at the end of the bar. */}
      {actions && <div className="ml-auto flex items-center gap-1.5 flex-wrap">{actions}</div>}
    </div>
  );
};
