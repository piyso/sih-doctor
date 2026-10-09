import React, { useEffect, useState } from 'react';
import { Search, AlertOctagon, RefreshCw, Leaf, Pill, WifiOff, Users, UserCheck, Undo2, History, Repeat } from 'lucide-react';
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

const waitingFor = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(mins)) return '';
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

export const PatientQueueList: React.FC<PatientQueueListProps> = ({
  queue,
  totalCount,
  selectedSessionId,
  onSelectPatient,
  onRefresh,
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
  const tag = (cls: string, children: React.ReactNode) => <span className={`px-1.5 py-px rounded font-bold text-[9.5px] shrink-0 inline-flex items-center gap-0.5 ${cls}`}>{children}</span>;

  return (
    <div className="physical-card p-3 min-h-0 max-h-full flex flex-col box-border">
      <div className="flex justify-between items-center gap-2 mb-2.5">
        <div className="flex-1 flex items-center gap-0.5 p-0.5 rounded-xl bg-muted/60 border border-border/70" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'waiting'} onClick={() => setTab('waiting')} className={`flex-1 px-2.5 py-1 rounded-lg text-xs font-bold ${tab === 'waiting' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground'}`}>Waiting <span className="font-mono">{queue.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'seen'} onClick={() => setTab('seen')} className={`flex-1 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${tab === 'seen' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground'}`}><History size={11} /> Seen today</button>
        </div>
        <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); onRefresh(); }} className="h-8 w-8 rounded-lg border border-border/80 bg-card hover:bg-muted inline-flex items-center justify-center text-muted-foreground shrink-0" title="Refresh queue" aria-label="Refresh queue">
          <RefreshCw size={13} />
        </button>
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
                <span className="text-[10px] font-mono text-muted-foreground">{new Date(s.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{s.diagnosis || 'No diagnosis recorded'} · {s.items} item{s.items === 1 ? '' : 's'}{s.amended ? ' · amended' : ''}</div>
              <div className={`text-[10.5px] font-semibold ${s.dispenseStatus === 'DISPENSED' ? 'text-emerald-700' : s.dispenseStatus === 'REFERRED_BACK' ? 'text-rose-700' : 'text-amber-700'}`}>Pharmacy: {s.dispenseStatus.replace(/_/g, ' ').toLowerCase()}{s.dispenseNote ? ` — ${s.dispenseNote}` : ''}</div>
            </button>
          ))}
        </div>
      )}
      {tab === 'waiting' && <>
      <div className="relative mb-2">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search name, complaint or token…"
          aria-label="Search the queue"
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
      </div>

      <div className="grid grid-cols-4 gap-0.5 mb-2 bg-muted/60 p-0.5 rounded-xl border border-border/70" role="radiogroup" aria-label="Filter by priority">
        {PRIORITY_FILTERS.map(p => {
          const active = filterPriority === p.id;
          const n = countFor(p.id);
          const tone = p.id === 'EMERGENCY_RED_FLAG' ? 'text-rose-600' : p.id === 'HIGH_PRIORITY' ? 'text-amber-600' : p.id === 'ROUTINE' ? 'text-emerald-600' : 'text-foreground';
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={p.title}
              onClick={() => { sovereignSound.playDialNotch(); setFilterPriority(p.id); }}
              className={`py-1 px-0.5 rounded-lg text-[10.5px] font-bold leading-tight flex flex-col items-center transition-colors ${active ? 'bg-card shadow-xs' : 'hover:bg-card/60'} ${n === 0 && !active ? 'opacity-50' : ''}`}
            >
              <span className={active ? 'text-foreground' : tone}>{p.label}</span>
              <span className="font-mono text-[11px] text-foreground">{n}</span>
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2.5 cursor-pointer select-none">
        <input type="checkbox" checked={showAllStreams} onChange={onToggleShowAll} className="accent-sky-600" />
        <span>
          Include the {role === 'AYURVEDA' ? 'modern medicine' : 'Ayurveda'} queue
          {!showAllStreams && hiddenByRole > 0 ? ` (${hiddenByRole} more)` : ''}
        </span>
      </label>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5 no-scrollbar">
        {filtered.map(item => {
          const isSelected = selectedSessionId === item.sessionId;
          const isEmergency = item.triagePriority === 'EMERGENCY_RED_FLAG';
          const isHigh = item.triagePriority === 'HIGH_PRIORITY';
          const vit = summariseVitals(item.vitals);
          const tags = [
            isEmergency && tag('bg-rose-600 text-white uppercase', 'Emergency'),
            item.status === 'IN_CONSULTATION' && tag('bg-sky-500/15 text-sky-700 dark:text-sky-300', <>Called{item.callCount && item.callCount > 1 ? ` ×${item.callCount}` : ''}</>),
            item.isPregnant && tag('bg-pink-500/15 text-pink-700 dark:text-pink-300', 'Pregnant'),
            item.visitType === 'PHARMACY_REFERRED' && tag('bg-rose-500/15 text-rose-700 dark:text-rose-300', <><Undo2 size={9} />Pharmacy</>),
            item.visitType === 'FOLLOW_UP' && tag('bg-violet-500/15 text-violet-700 dark:text-violet-300', <><Repeat size={9} />Follow-up</>),
            item.visitType === 'REVISIT' && tag('bg-muted text-muted-foreground', 'Revisit')
          ].filter(Boolean);
          return (
            <button
              key={item.sessionId}
              type="button"
              onClick={() => { sovereignSound.playDialNotch(); onSelectPatient(item); }}
              aria-pressed={isSelected}
              className={`text-left pl-2.5 pr-3 py-2.5 rounded-xl border border-l-4 transition-colors ${
                isEmergency ? 'border-l-rose-500' : isHigh ? 'border-l-amber-500' : 'border-l-border'
              } ${isSelected ? 'bg-sky-500/10 border-sky-500 ring-1 ring-sky-500/40' : 'bg-card hover:bg-muted/40 border-border/80'}`}
            >
              <div className="flex justify-between items-baseline gap-2">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  {item.tokenNo && <span className="font-mono font-bold text-[10px] text-muted-foreground shrink-0">{item.tokenNo}</span>}
                  <span className="text-[13px] font-heading font-bold text-foreground truncate">{item.patientName}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{item.age ? `${item.age}y` : ''} {item.gender?.charAt(0) || ''}</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                <span className="truncate flex items-center gap-1">
                  {item.careStream === 'AYURVEDA' ? <Leaf size={11} className="text-emerald-600 shrink-0" aria-label="Wants an Ayurveda doctor" /> : item.careStream === 'ALLOPATHY' ? <Pill size={11} className="text-sky-600 shrink-0" aria-label="Wants a modern medicine doctor" /> : null}
                  <span className="truncate">{item.primaryComplaint || 'Complaint not recorded'}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px]">{waitingFor(item.registeredAt)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 mt-1">
                <span className={`text-[10.5px] font-mono ${vit.anyCritical ? 'text-rose-600 font-bold' : vit.anyAbnormal ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                  {vit.anyRecorded ? `BP ${item.vitals?.bp || '—'} · P ${item.vitals?.pulse || '—'}` : 'Vitals not recorded'}
                </span>
                {tags.length > 0 && <span className="flex items-center gap-1 flex-wrap justify-end">{tags.map((t, i) => <React.Fragment key={i}>{t}</React.Fragment>)}</span>}
              </div>
              {item.claimedBy && item.claimedBy.id !== staffId && (
                <div className="text-[10.5px] text-sky-800 dark:text-sky-300 mt-1 flex items-center gap-1 font-semibold"><UserCheck size={11} /> With {item.claimedBy.name}</div>
              )}
              {item.pharmacyReferral && (
                <div className="text-[10.5px] text-rose-700 mt-1 font-medium truncate" title={item.pharmacyReferral.note}>Pharmacy ({item.pharmacyReferral.pharmacist}): {item.pharmacyReferral.note}</div>
              )}
              {isEmergency && item.redFlags && item.redFlags.length > 0 && (
                <div className="text-[10.5px] text-rose-700 dark:text-rose-300 mt-1 flex items-center gap-1 font-medium">
                  <AlertOctagon size={11} className="shrink-0" />
                  <span className="truncate">{item.redFlags[0]}</span>
                </div>
              )}
            </button>
          );
        })}

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
