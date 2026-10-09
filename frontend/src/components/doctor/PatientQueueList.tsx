import React, { useEffect, useState } from 'react';
import { Search, AlertOctagon, Leaf, Pill, WifiOff, Users, UserCheck, Undo2, History, Repeat, ChevronRight } from 'lucide-react';
import { PatientQueueItem, SeenTodayItem } from '../../types/api';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';
import { summariseVitals } from '../../utils/vitals';
import { DoctorRole } from './doctorRole';

interface PatientQueueListProps {
  queue: PatientQueueItem[];
  totalCount: number;
  selectedSessionId: string | null;
  onSelectPatient: (item: PatientQueueItem) => void;
  onRefresh: () => void;
  /** Open the next / previous waiting patient (also the ] and [ keys). */
  onStep?: (direction: 1 | -1) => void;
  online: boolean;
  loaded: boolean;
  role: DoctorRole;
  showAllStreams: boolean;
  onToggleShowAll: () => void;
  /** Demo servers only: refill the queue with the sample patients. */
  onLoadDemo?: () => void;
  /** Signed-in staff id: claims by others are shown as "with Dr …". */
  staffId?: string;
  onOpenSeen?: (item: SeenTodayItem) => void;
}

const PRIORITY_FILTERS = [
  { id: 'ALL', label: 'All', title: 'All waiting patients' },
  { id: 'EMERGENCY_RED_FLAG', label: 'Emergency', title: 'Needs immediate attention' },
  { id: 'HIGH_PRIORITY', label: 'Priority', title: 'Abnormal vitals or severe symptoms — see soon' },
  { id: 'ROUTINE', label: 'Routine', title: 'Routine OPD order' }
];

/** "12 min", "2 h 5 min"; past 12 hours the clock time it started ("since 9 Oct 14:20") — a 36-hour wait is a stale visit, not a wait. */
const waitingFor = (iso: string) => {
  const t = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (!Number.isFinite(mins)) return '';
  if (mins >= 12 * 60) return `since ${new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

export const PatientQueueList: React.FC<PatientQueueListProps> = ({
  queue,
  totalCount,
  selectedSessionId,
  onSelectPatient,
  onRefresh,
  onStep,
  online,
  loaded,
  role,
  showAllStreams,
  onToggleShowAll,
  onLoadDemo,
  staffId,
  onOpenSeen
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [tab, setTab] = useState<'waiting' | 'seen'>('waiting');
  const [seen, setSeen] = useState<SeenTodayItem[]>([]);
  useEffect(() => { if (tab === 'seen') api.getSeenToday().then(setSeen); }, [tab, queue]);

  const term = searchTerm.trim().toLowerCase();
  const filtered = queue.filter(item =>
    (!term || item.patientName.toLowerCase().includes(term) || item.sessionId.toLowerCase().includes(term) || (item.tokenNo || '').toLowerCase().includes(term) || (item.primaryComplaint || '').toLowerCase().includes(term)) &&
    (filterPriority === 'ALL' || item.triagePriority === filterPriority)
  );
  const hiddenByRole = totalCount - queue.length;

  const countFor = (id: string) => (id === 'ALL' ? queue.length : queue.filter(item => item.triagePriority === id).length);
  const tag = (cls: string, children: React.ReactNode) => <span className={`px-1.5 py-px rounded font-bold text-[11px] shrink-0 inline-flex items-center gap-0.5 ${cls}`}>{children}</span>;

  void onRefresh; // the desk polls every 15 s; no manual refresh needed here
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-2.5 min-h-0 max-h-full flex flex-col box-border">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="flex-1 flex items-center gap-0.5 p-0.5 rounded-xl bg-muted/60 border border-border/70" role="tablist" aria-label="Queue view">
          <button type="button" role="tab" aria-selected={tab === 'waiting'} onClick={() => setTab('waiting')} className={`flex-1 h-8 px-2 rounded-lg text-xs font-bold ${tab === 'waiting' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Waiting <span className="font-mono">{queue.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'seen'} onClick={() => setTab('seen')} className={`flex-1 h-8 px-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1 ${tab === 'seen' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}><History size={12} /> Seen<span className="hidden 2xl:inline">&nbsp;today</span></button>
        </div>
        {onStep && tab === 'waiting' && (
          <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); onStep(1); }} className="h-9 px-2.5 rounded-lg border border-border/80 bg-card hover:bg-muted inline-flex items-center gap-1 text-xs font-bold text-foreground shrink-0" title="Open the next waiting patient ( ] )" aria-label="Next patient">
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>

      {!online && loaded && (
        <div className="mb-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-semibold text-amber-900 dark:text-amber-100 flex items-start gap-2" role="alert">
          <WifiOff size={14} className="shrink-0 mt-0.5" />
          <span>Hospital server not reachable — the queue cannot be loaded. Check that the backend is running.</span>
        </div>
      )}

      {tab === 'seen' && (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5 no-scrollbar">
          {seen.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs">No prescriptions signed by you today.</div>}
          {seen.map(s => (
            <button key={s.encounterId} type="button" onClick={() => onOpenSeen?.(s)} className="text-left px-3 py-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs font-bold text-foreground truncate">{s.tokenNo ? `${s.tokenNo} · ` : ''}{s.patientName}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{new Date(s.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{s.diagnosis || 'No diagnosis recorded'} · {s.items} item{s.items === 1 ? '' : 's'}{s.amended ? ' · amended' : ''}</div>
              <div className={`text-[11px] font-semibold ${s.dispenseStatus === 'DISPENSED' ? 'text-emerald-700' : s.dispenseStatus === 'REFERRED_BACK' ? 'text-rose-700' : 'text-amber-700'}`}>Pharmacy: {s.dispenseStatus.replace(/_/g, ' ').toLowerCase()}{s.dispenseNote ? ` — ${s.dispenseNote}` : ''}</div>
            </button>
          ))}
        </div>
      )}
      {tab === 'waiting' && <>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Name, complaint or token"
            aria-label="Search the queue"
            className="w-full h-9 pl-8 pr-2 text-xs bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <select value={filterPriority} onChange={e => { sovereignSound.playDialNotch(); setFilterPriority(e.target.value); }} aria-label="Filter by priority"
          className={`h-9 px-2 rounded-lg border bg-background text-xs font-semibold shrink-0 max-w-[112px] ${filterPriority === 'ALL' ? 'border-border/80 text-foreground' : 'border-primary/60 text-primary'}`}>
          {PRIORITY_FILTERS.map(p => <option key={p.id} value={p.id} title={p.title}>{p.label} ({countFor(p.id)})</option>)}
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5 no-scrollbar">
        {filtered.map(item => {
          const isSelected = selectedSessionId === item.sessionId;
          const isEmergency = item.triagePriority === 'EMERGENCY_RED_FLAG';
          const isHigh = item.triagePriority === 'HIGH_PRIORITY';
          const vit = summariseVitals(item.vitals);
          // Only what changes the order of seeing patients: called, pregnant, back from pharmacy, follow-up.
          const tags = [
            item.status === 'IN_CONSULTATION' && tag('bg-sky-500/15 text-sky-800', <>Called{item.callCount && item.callCount > 1 ? ` ×${item.callCount}` : ''}</>),
            item.isPregnant && tag('bg-pink-500/15 text-pink-800', 'Pregnant'),
            item.visitType === 'PHARMACY_REFERRED' && tag('bg-rose-500/15 text-rose-800', <><Undo2 size={10} />Pharmacy</>),
            item.visitType === 'FOLLOW_UP' && tag('bg-violet-500/15 text-violet-800', <><Repeat size={10} />Follow-up</>)
          ].filter(Boolean);
          const second = isEmergency && item.redFlags?.length ? item.redFlags[0] : item.primaryComplaint || 'Complaint not recorded';
          return (
            <button
              key={item.sessionId}
              type="button"
              onClick={() => { sovereignSound.playDialNotch(); onSelectPatient(item); }}
              aria-current={isSelected ? 'true' : undefined}
              aria-label={`${isEmergency ? 'Emergency: ' : isHigh ? 'Priority: ' : ''}${item.patientName}, ${item.age || ''} ${item.gender || ''}, ${second}, waiting ${waitingFor(item.registeredAt)}`}
              className={`text-left pl-2.5 pr-2.5 py-2 rounded-xl border border-l-4 transition-colors ${
                isEmergency ? 'border-l-rose-500' : isHigh ? 'border-l-amber-500' : 'border-l-transparent'
              } ${isSelected ? 'bg-sky-500/10 border-sky-500/70' : 'bg-background hover:bg-muted/40 border-border/70'}`}
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className="flex items-baseline gap-1.5 min-w-0">
                  {isEmergency && <AlertOctagon size={12} className="text-rose-600 shrink-0 self-center" aria-hidden="true" />}
                  <span className="text-[13px] font-bold text-foreground truncate">{item.patientName}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{item.age ? `${item.age}` : ''}{item.gender?.charAt(0) || ''}</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-mono shrink-0">{item.tokenNo || ''}</span>
              </div>
              <div className="flex justify-between items-center gap-2 mt-0.5">
                <span className={`text-xs truncate flex items-center gap-1 ${isEmergency ? 'text-rose-700 font-semibold' : 'text-muted-foreground'}`}>
                  {item.careStream === 'AYURVEDA' ? <Leaf size={11} className="text-emerald-600 shrink-0" aria-label="Wants an Ayurveda doctor" /> : item.careStream === 'ALLOPATHY' ? <Pill size={11} className="text-sky-600 shrink-0" aria-label="Wants a modern medicine doctor" /> : null}
                  <span className="truncate">{second}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{waitingFor(item.registeredAt)}</span>
              </div>
              {(tags.length > 0 || vit.anyAbnormal || vit.anyCritical || (item.claimedBy && item.claimedBy.id !== staffId) || item.pharmacyReferral) && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {(vit.anyAbnormal || vit.anyCritical) && <span className={`text-[11px] font-mono ${vit.anyCritical ? 'text-rose-600 font-bold' : 'text-amber-700 font-semibold'}`}>BP {item.vitals?.bp || '—'} · P {item.vitals?.pulse || '—'}</span>}
                  {tags.map((t, i) => <React.Fragment key={i}>{t}</React.Fragment>)}
                  {item.claimedBy && item.claimedBy.id !== staffId && <span className="text-[11px] text-sky-800 inline-flex items-center gap-1 font-semibold"><UserCheck size={11} /> With {item.claimedBy.name}</span>}
                  {item.pharmacyReferral && <span className="text-[11px] text-rose-700 font-medium truncate max-w-full" title={item.pharmacyReferral.note}>Pharmacy ({item.pharmacyReferral.pharmacist}): {item.pharmacyReferral.note}</span>}
                </div>
              )}
            </button>
          );
        })}

        {!showAllStreams && hiddenByRole > 0 && (
          <button type="button" onClick={onToggleShowAll} className="mt-1 text-[11px] font-semibold text-primary hover:underline self-center py-1.5">
            Also show the {role === 'AYURVEDA' ? 'modern medicine' : 'Ayurveda'} queue ({hiddenByRole} more)
          </button>
        )}
        {showAllStreams && (
          <button type="button" onClick={onToggleShowAll} className="mt-1 text-[11px] font-semibold text-muted-foreground hover:underline self-center py-1.5">
            Show only my {role === 'AYURVEDA' ? 'Ayurveda' : 'modern medicine'} queue
          </button>
        )}

        {loaded && online && queue.length === 0 && (
          <div className="text-center py-8 px-3 text-muted-foreground flex flex-col items-center">
            <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center mb-3">
              <Users size={18} />
            </div>
            <span className="text-xs font-heading font-bold text-foreground mb-1">No patients waiting</span>
            <p className="text-[11px] max-w-[230px] leading-relaxed mb-3">
              New patients appear here as soon as they finish check-in at the kiosk.
            </p>
            {onLoadDemo && (
              <button type="button" onClick={onLoadDemo} className="text-[11px] font-semibold text-primary underline underline-offset-2">
                Add demo patients
              </button>
            )}
          </div>
        )}
        {queue.length > 0 && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs font-medium">No patients match this filter.</div>
        )}
      </div>
      </>}
    </div>
  );
};
