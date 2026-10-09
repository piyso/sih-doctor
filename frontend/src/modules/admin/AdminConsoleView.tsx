import React, { useState } from 'react';
import { BarChart3, Users, MonitorSmartphone, ScrollText, ShieldCheck, Server } from 'lucide-react';
import { useStaffUser } from '../../components/auth/StaffGate';
import { AnalyticsPanel } from './AnalyticsPanel';
import { StaffPanel } from './StaffPanel';
import { DevicesPanel } from './DevicesPanel';
import { AuditPanel } from './AuditPanel';
import { PrivacyPanel } from './PrivacyPanel';
import { SystemPanel } from './SystemPanel';

type Tab = 'analytics' | 'staff' | 'devices' | 'audit' | 'privacy' | 'system';

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ size?: number }>; adminOnly: boolean }> = [
  { id: 'analytics', label: 'Hospital today', icon: BarChart3, adminOnly: false },
  { id: 'staff', label: 'Staff', icon: Users, adminOnly: true },
  { id: 'devices', label: 'Kiosks & screens', icon: MonitorSmartphone, adminOnly: true },
  { id: 'audit', label: 'Audit trail', icon: ScrollText, adminOnly: true },
  { id: 'privacy', label: 'Patient data requests', icon: ShieldCheck, adminOnly: true },
  { id: 'system', label: 'System & backups', icon: Server, adminOnly: true }
];

/** Hospital administration: live analytics for managers and clinicians, configuration for admins. */
export const AdminConsoleView: React.FC = () => {
  const user = useStaffUser();
  const isAdmin = user?.role === 'admin';
  const tabs = TABS.filter(t => isAdmin || !t.adminOnly);
  // ?tab=staff (etc.) opens a tab directly, e.g. from the demonstration-mode switch.
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      return t && TABS.some(x => x.id === t) ? t : 'analytics';
    } catch { return 'analytics'; }
  });

  const activeTab: Tab = tabs.some(t => t.id === tab) ? tab : 'analytics';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-4 pb-1" role="tablist">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border shrink-0 ${active ? 'bg-foreground text-background border-foreground' : 'bg-card hover:bg-muted border-border/80 text-foreground'}`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>
      {activeTab === 'analytics' && <AnalyticsPanel />}
      {activeTab === 'staff' && isAdmin && <StaffPanel />}
      {activeTab === 'devices' && isAdmin && <DevicesPanel />}
      {activeTab === 'audit' && isAdmin && <AuditPanel />}
      {activeTab === 'privacy' && isAdmin && <PrivacyPanel />}
      {activeTab === 'system' && isAdmin && <SystemPanel />}
    </div>
  );
};
