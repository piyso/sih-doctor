import React, { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, WifiOff, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { ConflictAlert, SafetyEvaluation } from '../../types/api';

interface SafetyPanelProps {
  safety: SafetyEvaluation;
  checking: boolean;
  /** Alerts that are not attached to a specific line (patient-level, list-level). */
  showUnattachedOnly?: boolean;
  lineCount: number;
}

const group = (alerts: ConflictAlert[]) => {
  const map = new Map<string, ConflictAlert[]>();
  for (const a of alerts) map.set(a.groupKey || a.alertId || Math.random().toString(), [...(map.get(a.groupKey || a.alertId || '') || []), a]);
  return Array.from(map.values());
};

/**
 * What was checked and what was found. It never says "safe": it says which patient facts were
 * used, which lines could not be checked, and lists the alerts by tier.
 */
export const SafetyPanel: React.FC<SafetyPanelProps> = ({ safety, checking, lineCount }) => {
  const [showInfo, setShowInfo] = useState(false);
  const groups = useMemo(() => group(safety.alerts), [safety.alerts]);
  const stop = groups.filter(g => g.some(a => a.tier === 'STOP'));
  const warn = groups.filter(g => !g.some(a => a.tier === 'STOP') && g.some(a => a.tier === 'WARN'));
  const info = groups.filter(g => g.every(a => a.tier === 'INFO'));
  const cov = safety.coverage;

  if (lineCount === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2" aria-label="Safety check" aria-live="polite">
      <div className="flex items-start gap-2 text-[11.5px]">
        {checking ? <Loader2 size={14} className="animate-spin text-muted-foreground mt-0.5 shrink-0" />
          : !safety.checked ? <WifiOff size={14} className="text-rose-600 mt-0.5 shrink-0" />
          : stop.length ? <ShieldAlert size={14} className="text-rose-600 mt-0.5 shrink-0" />
          : <ShieldCheck size={14} className="text-emerald-600 mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          {!safety.checked && !checking ? (
            <span className="font-semibold text-rose-700">Not checked — the hospital server could not be reached. Do not assume this prescription is safe.</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">
                {stop.length ? `${stop.length} must be resolved or justified before signing` : warn.length ? `${warn.length} warning${warn.length > 1 ? 's' : ''} to review` : 'No interruptive alerts'}
              </span>
              {cov && (
                <span className="text-muted-foreground">
                  {' · '}Checked against: {cov.contextUsed.join(' · ') || 'medicines only'}
                  {cov.contextMissing.length > 0 && <span className="text-amber-800"> · Not on file: {cov.contextMissing.join(', ')}</span>}
                  {cov.unresolved.length > 0 && <span className="text-amber-800"> · Not in the safety database: {cov.unresolved.map(u => u.name).join(', ')}</span>}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {[...stop, ...warn].filter(g => !(g[0].lineRefs && g[0].lineRefs.length === 1)).map(g => {
        const a = g[0];
        const isStop = g.some(x => x.tier === 'STOP');
        return (
          <div key={a.groupKey} className={`rounded-lg border p-2 text-[11.5px] ${isStop ? 'border-rose-500 bg-rose-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
            <div className="font-bold text-foreground"><span className={`px-1.5 mr-1.5 rounded text-[11px] text-white ${isStop ? 'bg-rose-600' : 'bg-amber-500'}`}>{isStop ? 'STOP' : 'WARN'}</span>{a.itemA} × {a.itemB}</div>
            <div className="text-muted-foreground mt-0.5"><strong className="text-foreground">Why:</strong> {a.mechanism}</div>
            <div className="text-muted-foreground"><strong className="text-foreground">Do:</strong> {a.clinicalAction || a.recommendedAction}</div>
            <div className="text-[11px] text-muted-foreground">{a.evidence ? `Evidence: ${a.evidence}. ` : ''}{a.citation || ''}</div>
          </div>
        );
      })}

      {info.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowInfo(s => !s)} className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            {showInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {info.length} note{info.length > 1 ? 's' : ''} (spacing, statutory labels, stewardship)
          </button>
          {showInfo && (
            <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground list-disc pl-5">
              {info.map(g => <li key={g[0].groupKey}><strong className="text-foreground">{g[0].itemA} × {g[0].itemB}:</strong> {g[0].clinicalAction || g[0].mechanism}</li>)}
            </ul>
          )}
        </div>
      )}
      {cov?.reviewStatus && <div className="text-[11px] text-muted-foreground">{cov.reviewStatus}</div>}
    </section>
  );
};
