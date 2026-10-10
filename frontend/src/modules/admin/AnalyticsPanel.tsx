import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { api } from '../../services/api';
import { Panel, Stat, Btn, Loading, ErrorNote, fmtMins } from './adminUi';

const LANG_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', or: 'Odia', UNKNOWN: 'Not recorded'
};
const STREAM_NAMES: Record<string, string> = { AYURVEDA: 'Ayurveda', ALLOPATHY: 'Modern medicine', UNDECIDED: 'Not chosen' };

const Breakdown: React.FC<{ data: Record<string, number>; names?: Record<string, string> }> = ({ data, names = {} }) => {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="text-xs text-muted-foreground">No visits yet today.</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate font-medium text-foreground">{names[k] || k}</span>
          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(v / total) * 100}%` }} />
          </div>
          <span className="w-10 text-right tabular-nums font-semibold">{v}</span>
        </div>
      ))}
    </div>
  );
};

/** Real operational and outcome numbers from the hospital database. */
export const AnalyticsPanel: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAnalytics());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return error ? <ErrorNote message={error} /> : <Loading />;
  const { snapshot, trend, syndromicSignals, prescribingSafety, followUp } = data;
  const maxDay = Math.max(1, ...trend.map((d: any) => d.visits));
  // Patients still open from earlier days explain "0 checked in today" beside "10 waiting now".
  const carried: number = snapshot.totals.carriedOver || 0;
  const emergencyCarried: number = snapshot.totals.emergencyCarriedOver || 0;
  const openNow: number = snapshot.totals.waitingNow + snapshot.totals.inConsultationNow;
  const fromEarlier = (n: number, of: number) => (n <= 0 ? undefined : n >= of ? 'all from earlier days' : `${n} from earlier days`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">Today ({snapshot.date}). Updates every 30 seconds. Every number below is counted from hospital records.</p>
        <Btn onClick={load} busy={loading}><RefreshCw size={13} /> Refresh</Btn>
      </div>
      <ErrorNote message={error} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Checked in today" value={snapshot.totals.checkedInToday} />
        <Stat label="Waiting now" value={snapshot.totals.waitingNow} hint={fromEarlier(carried, openNow)} tone={snapshot.totals.waitingNow > 25 ? 'warn' : 'default'} />
        <Stat label="With a doctor now" value={snapshot.totals.inConsultationNow} />
        <Stat label="Emergency now" value={snapshot.totals.emergencyNow} hint={fromEarlier(emergencyCarried, snapshot.totals.emergencyNow)} tone={snapshot.totals.emergencyNow ? 'danger' : 'ok'} />
        <Stat label="Median wait" value={fmtMins(snapshot.timings.medianWaitMinutes)} hint="check-in → called" />
        <Stat label="SOS response" value={snapshot.timings.medianSosAckSeconds === null ? '—' : `${snapshot.timings.medianSosAckSeconds}s`} hint={`${snapshot.timings.sosAlerts24h} alerts in 24 h`} tone={snapshot.timings.medianSosAckSeconds > 120 ? 'danger' : 'default'} />
      </div>

      <Panel title="Rooms right now" subtitle="A status is shown only when a room needs attention. ‘Busy’ means the last waiting patient is expected to wait more than 45 minutes.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left border-b border-border/70">
                <th className="py-2 pr-3 font-semibold">Room</th>
                <th className="py-2 pr-3 font-semibold">Department</th>
                <th className="py-2 pr-3 font-semibold text-right">Waiting</th>
                <th className="py-2 pr-3 font-semibold text-right">With doctor</th>
                <th className="py-2 pr-3 font-semibold text-right">Emergency</th>
                <th className="py-2 pr-3 font-semibold text-right">Median consult (7 days)</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rooms.filter((r: any) => r.queuedPatientsCount > 0 || r.medianConsultMinutes !== null).map((r: any) => (
                <tr key={r.departmentCode} className="border-b border-border/40">
                  <td className="py-2 pr-3 font-bold">{r.roomNumber}</td>
                  <td className="py-2 pr-3">{r.department}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.waitingCount}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.inConsultation}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${r.emergencyCount ? 'text-rose-600 font-bold' : ''}`}>{r.emergencyCount}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtMins(r.medianConsultMinutes)}</td>
                  <td className="py-2 whitespace-nowrap">
                    {r.emergencyCount > 0
                      ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">Emergency waiting</span>
                      : r.pacingStatus === 'BUSY'
                        ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">Busy</span>
                        : <span className="text-muted-foreground" aria-label="No issue">—</span>}
                  </td>
                </tr>
              ))}
              {snapshot.rooms.every((r: any) => r.queuedPatientsCount === 0 && r.medianConsultMinutes === null) && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No patients in any room.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid md:grid-cols-3 gap-4">
        <Panel title="Priority today">
          <Breakdown data={{ Emergency: snapshot.triageToday.emergency, Urgent: snapshot.triageToday.high, Routine: snapshot.triageToday.routine }} />
        </Panel>
        <Panel title="Type of care chosen">
          <Breakdown data={snapshot.byCareStream} names={STREAM_NAMES} />
        </Panel>
        <Panel title="Language used at the kiosk">
          <Breakdown data={snapshot.byLanguage} names={LANG_NAMES} />
        </Panel>
      </div>

      <Panel title="Visits, last 14 days" subtitle="Bar height = visits; red part = emergencies.">
        {trend.length === 0 ? <p className="text-xs text-muted-foreground">No visits in the last 14 days.</p> : (
          <div className="flex items-end gap-1.5 h-36">
            {trend.map((d: any) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${d.day}: ${d.visits} visits, ${d.emergencies} emergencies, ${d.completed} completed`}>
                <span className="text-[11px] tabular-nums text-muted-foreground">{d.visits}</span>
                <div className="w-full rounded-t-md bg-primary/60 relative" style={{ height: `${(d.visits / maxDay) * 100}px` }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-rose-500/80 rounded-t-sm" style={{ height: `${d.visits ? (d.emergencies / d.visits) * 100 : 0}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground truncate w-full text-center">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Symptom trends (for review)"
          subtitle="A signal appears when this week has at least 5 cases and more than the previous 4-week average + 2√average. It is a prompt to look closer, not a diagnosis of an outbreak."
        >
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="text-left border-b border-border/70">
              <th className="py-1.5 font-semibold">Symptom group</th>
              <th className="py-1.5 font-semibold text-right">This week</th>
              <th className="py-1.5 font-semibold text-right">Usual (avg)</th>
              <th className="py-1.5 font-semibold text-right">Signal at</th>
              <th className="py-1.5 font-semibold pl-3">Status</th>
            </tr></thead>
            <tbody>
              {syndromicSignals.map((s: any) => (
                <tr key={s.id} className="border-b border-border/40">
                  <td className="py-1.5 font-medium">{s.syndrome}</td>
                  <td className="py-1.5 text-right tabular-nums font-bold">{s.thisWeek}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.baselineWeeklyMean}</td>
                  <td className="py-1.5 text-right tabular-nums">&gt; {s.threshold}</td>
                  <td className="py-1.5 pl-3">
                    {s.signal
                      ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">Review — report to IDSP if confirmed</span>
                      : <span className="text-muted-foreground">Normal</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="space-y-4">
          <Panel title={`Medicine safety (last ${prescribingSafety.days} days)`}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Stat label="Prescriptions" value={prescribingSafety.prescriptions} />
              <Stat label="With an interaction warning" value={prescribingSafety.prescriptionsWithWarning} tone={prescribingSafety.prescriptionsWithWarning ? 'warn' : 'default'} />
            </div>
            {prescribingSafety.topPairs.length > 0 ? (
              <ul className="text-xs space-y-1">
                {prescribingSafety.topPairs.map((p: any) => (
                  <li key={p.pair} className="flex justify-between gap-2"><span className="truncate">{p.pair}</span><span className="tabular-nums font-semibold">{p.count}</span></li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">No interaction warnings were raised.</p>}
          </Panel>
          <Panel title="Follow-up visits (last 90 days)" subtitle="Patients counted as returned if they came back within 3 days of the date the doctor asked.">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Due" value={followUp.due} />
              <Stat label="Returned" value={followUp.returned} />
              <Stat label="Adherence" value={followUp.adherence === null ? '—' : `${followUp.adherence}%`} tone={followUp.adherence !== null && followUp.adherence < 50 ? 'warn' : 'default'} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1"><Info size={12} /> {followUp.upcoming} follow-ups are scheduled in the coming days.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
};
