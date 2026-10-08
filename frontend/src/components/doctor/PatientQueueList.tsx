import React, { useState } from 'react';
import { Search, AlertOctagon, RefreshCw, Leaf, Pill, WifiOff, Users } from 'lucide-react';
import { PatientQueueItem } from '../../types/api';
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
  onLoadDemo: () => void;
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
  onLoadDemo
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  const term = searchTerm.trim().toLowerCase();
  const filtered = queue.filter(item =>
    (!term || item.patientName.toLowerCase().includes(term) || item.sessionId.toLowerCase().includes(term) || (item.tokenNo || '').toLowerCase().includes(term) || (item.primaryComplaint || '').toLowerCase().includes(term)) &&
    (filterPriority === 'ALL' || item.triagePriority === filterPriority)
  );
  const hiddenByRole = totalCount - queue.length;

  return (
    <div className="physical-card p-4 h-full flex flex-col box-border">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading font-bold text-foreground">Patient queue</span>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground border border-border/80">{queue.length}</span>
        </div>
        <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); onRefresh(); }} className="tactile-btn px-2.5 py-1 text-xs gap-1" title="Refresh queue">
          <RefreshCw size={11} />
          <span>Refresh</span>
        </button>
      </div>

      {!online && loaded && (
        <div className="mb-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-semibold text-amber-900 dark:text-amber-100 flex items-start gap-2" role="alert">
          <WifiOff size={14} className="shrink-0 mt-0.5" />
          <span>Hospital server not reachable — the queue cannot be loaded. Check that the backend is running.</span>
        </div>
      )}

      <div className="relative mb-2.5">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search name, complaint or token…"
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
      </div>

      <div className="flex gap-0.5 mb-2 bg-muted/60 p-1 rounded-xl border border-border/70">
        {PRIORITY_FILTERS.map(p => (
          <button
            key={p.id}
            type="button"
            title={p.title}
            onClick={() => { sovereignSound.playDialNotch(); setFilterPriority(p.id); }}
            className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-lg transition-colors ${
              filterPriority === p.id ? 'bg-card text-foreground shadow-xs' : p.id === 'EMERGENCY_RED_FLAG' ? 'text-rose-600' : p.id === 'HIGH_PRIORITY' ? 'text-amber-600' : p.id === 'ROUTINE' ? 'text-emerald-600' : 'text-muted-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3 cursor-pointer select-none">
        <input type="checkbox" checked={showAllStreams} onChange={onToggleShowAll} className="accent-sky-600" />
        <span>
          Show patients waiting for {role === 'AYURVEDA' ? 'modern medicine' : 'Ayurveda'} too
          {!showAllStreams && hiddenByRole > 0 ? ` (${hiddenByRole} hidden)` : ''}
        </span>
      </label>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5 no-scrollbar">
        {filtered.map(item => {
          const isSelected = selectedSessionId === item.sessionId;
          const isEmergency = item.triagePriority === 'EMERGENCY_RED_FLAG';
          const isHigh = item.triagePriority === 'HIGH_PRIORITY';
          const vit = summariseVitals(item.vitals);
          return (
            <button
              key={item.sessionId}
              type="button"
              onClick={() => { sovereignSound.playDialNotch(); onSelectPatient(item); }}
              aria-pressed={isSelected}
              className={`text-left p-3 rounded-xl border transition-colors ${
                isSelected ? 'bg-sky-500/10 border-sky-500 ring-1 ring-sky-500/40'
                  : isEmergency ? 'bg-rose-500/10 border-rose-500/40 hover:border-rose-500/60'
                  : isHigh ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
                  : 'bg-card hover:bg-muted/40 border-border/80'
              }`}
            >
              <div className="flex justify-between items-center gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {item.tokenNo && <span className="px-1.5 rounded bg-muted border border-border/70 font-mono font-bold text-[9.5px] text-foreground shrink-0">{item.tokenNo}</span>}
                  <span className="text-xs font-heading font-bold text-foreground truncate">{item.patientName}</span>
                  {item.status === 'IN_CONSULTATION' && <span className="px-1.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold text-[9.5px] shrink-0">Called{item.callCount && item.callCount > 1 ? ` ×${item.callCount}` : ''}</span>}
                  {isEmergency && <span className="px-1.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[9.5px] uppercase shrink-0">Emergency</span>}
                  {item.isPregnant && <span className="px-1.5 rounded bg-pink-500/15 text-pink-700 dark:text-pink-300 font-bold text-[9.5px] shrink-0">Pregnant</span>}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{item.age ? `${item.age}y` : ''} {item.gender?.charAt(0) || ''}</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{item.primaryComplaint || 'Complaint not recorded'}</span>
                <span className="shrink-0 flex items-center gap-1" title={item.careStream === 'AYURVEDA' ? 'Wants an Ayurveda doctor' : item.careStream === 'ALLOPATHY' ? 'Wants a modern medicine doctor' : 'No preference'}>
                  {item.careStream === 'AYURVEDA' ? <Leaf size={11} className="text-emerald-600" /> : item.careStream === 'ALLOPATHY' ? <Pill size={11} className="text-sky-600" /> : null}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 mt-1 text-[10.5px] font-mono">
                <span className={vit.anyCritical ? 'text-rose-600 font-bold' : vit.anyAbnormal ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                  {vit.anyRecorded ? `BP ${item.vitals?.bp || '—'} · P ${item.vitals?.pulse || '—'}` : 'Vitals not recorded'}
                </span>
                <span className="text-muted-foreground">{waitingFor(item.registeredAt)}</span>
              </div>
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
            <button type="button" onClick={onLoadDemo} className="text-[11px] font-semibold text-primary underline underline-offset-2">
              Add demo patients
            </button>
          </div>
        )}
        {queue.length > 0 && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs font-medium">No patients match this filter.</div>
        )}
      </div>
    </div>
  );
};
