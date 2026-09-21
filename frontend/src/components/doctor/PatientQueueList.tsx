import React, { useState } from 'react';
import { Search, AlertOctagon, Clock, User, Filter, RefreshCw, Activity, ChevronRight } from 'lucide-react';
import { PatientQueueItem, TriagePriority } from '../../types/api';
import { sovereignSound } from '../../utils/audio';

interface PatientQueueListProps {
  queue: PatientQueueItem[];
  selectedSessionId: string | null;
  onSelectPatient: (item: PatientQueueItem) => void;
  onRefresh: () => void;
}

export const PatientQueueList: React.FC<PatientQueueListProps> = ({
  queue,
  selectedSessionId,
  onSelectPatient,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  const filtered = queue.filter(item => {
    const matchesSearch = item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.sessionId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterPriority === 'ALL' || item.triagePriority === filterPriority;
    return matchesSearch && matchesFilter;
  });

  const handleSelect = (item: PatientQueueItem) => {
    sovereignSound.playDialNotch();
    onSelectPatient(item);
  };

  const handleRefreshClick = () => {
    sovereignSound.playMechanicalSnap();
    onRefresh();
  };

  return (
    <div className="physical-card p-4 h-full flex flex-col box-border">
      {/* Header Bar */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading font-bold text-foreground">
            Patient Queue
          </span>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground border border-border/80">
            {queue.length}
          </span>
        </div>

        <button
          type="button"
          onClick={handleRefreshClick}
          className="tactile-btn px-2.5 py-1 text-xs gap-1"
          title="Refresh queue"
        >
          <RefreshCw size={11} />
          <span>Sync</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-2.5">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search patient name or ID..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-xl placeholder:text-muted-foreground/60 text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-medium"
        />
        <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
      </div>

      {/* Segmented Filter Tabs */}
      <div className="flex gap-0.5 mb-3 bg-muted/60 p-1 rounded-xl border border-border/70">
        {[
          { id: 'ALL', label: 'ALL' },
          { id: 'EMERGENCY_RED_FLAG', label: 'STAT' },
          { id: 'HIGH_PRIORITY', label: 'PRIORITY' },
          { id: 'ROUTINE', label: 'ROUTINE' }
        ].map((p) => {
          const isActive = filterPriority === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                sovereignSound.playDialNotch();
                setFilterPriority(p.id);
              }}
              className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                isActive
                  ? 'bg-card text-foreground shadow-xs'
                  : p.id === 'EMERGENCY_RED_FLAG'
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-muted/40'
                  : p.id === 'HIGH_PRIORITY'
                  ? 'text-amber-600 dark:text-amber-400 hover:bg-muted/40'
                  : p.id === 'ROUTINE'
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-muted/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Queue Items List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5 no-scrollbar">
        {filtered.map((item) => {
          const isSelected = selectedSessionId === item.sessionId;
          const isEmergency = item.triagePriority === 'EMERGENCY_RED_FLAG';
          const isHigh = item.triagePriority === 'HIGH_PRIORITY';

          return (
            <div
              key={item.sessionId}
              onClick={() => handleSelect(item)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-sky-500/10 border-sky-500 ring-1 ring-sky-500/40 shadow-xs'
                  : isEmergency
                  ? 'bg-rose-500/10 border-rose-500/40 hover:border-rose-500/60'
                  : isHigh
                  ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
                  : 'bg-card hover:bg-muted/40 border-border/80'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-heading font-bold text-foreground truncate">
                    {item.patientName}
                  </span>
                  {isEmergency && (
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[9px] uppercase font-mono">
                      Urgent
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {item.age}y {item.gender.charAt(0)}
                </span>
              </div>

              <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {item.isPregnant && (
                    <span className="px-1.5 py-0.2 rounded bg-pink-500/15 text-pink-600 dark:text-pink-400 font-bold text-[9.5px]">
                      Preg
                    </span>
                  )}
                  <span>{item.prakriti || 'Vata-Pitta'}</span>
                </span>
                <span className={`font-mono text-[10.5px] ${isEmergency ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                  BP {item.vitals?.bp || '120/80'}
                </span>
              </div>

              {isEmergency && item.redFlags && item.redFlags.length > 0 && (
                <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 truncate font-medium">
                  <AlertOctagon size={11} className="shrink-0 text-rose-600 dark:text-rose-400" />
                  <span className="truncate">{item.redFlags[0]}</span>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs font-medium">
            No patients match filter criteria.
          </div>
        )}
      </div>
    </div>
  );
};
