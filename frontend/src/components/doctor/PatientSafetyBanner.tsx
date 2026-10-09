import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertOctagon, Baby, Droplets, HeartPulse, Scale, ShieldAlert, Pill, UserCheck, Ambulance, CheckCircle2, Mic } from 'lucide-react';
import { SessionDetail } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

export type RoomRecordingState = 'off' | 'recording' | 'paused';

const HIGH_RISK = /warfarin|acitrom|acenocoumarol|apixaban|rivaroxaban|dabigatran|insulin|digoxin|lithium|methotrexate|phenytoin|carbamazepine|valproate|amiodarone|clopidogrel|tacrolimus|cyclosporin/i;

/**
 * The facts that must never be more than zero clicks away: allergies, pregnancy / breastfeeding,
 * kidney function, early-warning score, weight (for children), and high-risk medicines on board.
 */
export const PatientSafetyBanner: React.FC<{
  session: SessionDetail;
  claimedByOther?: string | null;
  actions?: React.ReactNode;
  /** Emergency patient: the reason and the Emergency Room hand-off live on this bar (no separate banner). */
  emergency?: { flags: string[]; diverted: boolean; onDivert: () => void };
  /** A room recording is running or paused: always shown, whatever else is collapsed; the chip opens the scribe. */
  recording?: { state: RoomRecordingState; since: number | null; onShow: () => void };
}> = ({ session, claimedByOther, actions, emergency, recording }) => {
  const ctx = session.patientContext;
  const allergies = ctx?.allergies;
  const news = session.vitalsAssessment;
  const reported = ctx?.reportedMedicines || [];
  const onBoard = reported.filter(m => HIGH_RISK.test(m));
  const child = typeof session.age === 'number' && session.age < 12;
  const weight = ctx?.weightKg || session.weightKg || (session.vitals as any)?.weightKg;
  const missingNews = (session.vitals as any)?.news2?.missing as string[] | undefined;

  // An emergency patient is announced once when opened (as the old full-width banner did).
  const flagKey = emergency ? emergency.flags.join('|') : '';
  useEffect(() => { if (flagKey) { try { sovereignSound.playClinicalAlert(); } catch {} } }, [flagKey]);

  // Room-recording clock (mm:ss), only while recording.
  const [, tick] = React.useState(0);
  useEffect(() => {
    if (recording?.state !== 'recording') return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [recording?.state]);
  const elapsed = recording?.since ? Math.max(0, Math.floor((Date.now() - recording.since) / 1000)) : 0;
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

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
    <div ref={ref} className={`doctor-safety-banner no-print sticky z-30 mb-3 rounded-2xl border bg-card/95 backdrop-blur pl-3 pr-2 py-2 shadow-sm flex items-center gap-x-2 gap-y-1.5 flex-wrap ${emergency ? 'border-rose-500/60 border-l-[6px] border-l-rose-600' : 'border-border'}`} aria-label="Patient safety summary" data-testid="safety-banner">
      <h2 className="m-0 text-[15px] font-heading font-extrabold text-foreground leading-tight">{session.patientName}</h2>
      <span className="text-xs text-muted-foreground">{session.age ? `${session.age} y` : ''} · {String(session.gender || '').charAt(0) + String(session.gender || '').slice(1).toLowerCase()}{weight ? ` · ${weight} kg` : ''}{(session as any).tokenNo ? <> · <span className="font-mono font-semibold text-foreground">{(session as any).tokenNo}</span></> : null}</span>
      {emergency && (
        <span role="alert" className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 min-w-0">
          <AlertOctagon size={14} className="shrink-0" />
          <span className="uppercase tracking-wide">Emergency</span>
          {emergency.flags[0] && <span className="font-semibold normal-case truncate max-w-[360px]" title={emergency.flags.join('\n')}>· {emergency.flags[0]}{emergency.flags.length > 1 ? ` (+${emergency.flags.length - 1})` : ''}</span>}
        </span>
      )}
      {recording && recording.state !== 'off' && (
        <button type="button" onClick={recording.onShow} className={`h-7 px-2.5 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1.5 border ${recording.state === 'recording' ? 'bg-rose-600 text-white border-rose-700' : 'bg-amber-500/15 text-amber-900 border-amber-500/40'}`}
          title="Recording the room with the patient's consent — open the scribe to pause or record a withdrawal">
          <Mic size={12} className={recording.state === 'recording' ? 'animate-pulse' : ''} />
          {recording.state === 'recording' ? `Recording the room · ${clock}` : 'Room recording paused'}
        </button>
      )}
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
      {/* Patient-scoped actions (emergency hand-off, call, not present, more) live with the patient, at the end of the bar. */}
      {(actions || emergency) && <div className="ml-auto flex items-center gap-1.5 flex-wrap">
        {emergency && (emergency.diverted
          ? <span className="h-8 px-2.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Sent to Emergency Room</span>
          : <button type="button" onClick={emergency.onDivert} className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5"><Ambulance size={13} /> Send to Emergency Room</button>)}
        {actions}
      </div>}
    </div>
  );
};
