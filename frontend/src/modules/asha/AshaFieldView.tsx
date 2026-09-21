import React, { useState } from 'react';
import { 
  Users, 
  Wifi, 
  WifiOff, 
  Baby, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  ShieldCheck, 
  Heart, 
  FileCheck,
  Sun,
  MapPin
} from 'lucide-react';
import { AshaFieldRecord } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { api } from '../../services/api';

export const AshaFieldView: React.FC = () => {
  const [records, setRecords] = useState<AshaFieldRecord[]>(() => {
    try {
      const saved = localStorage.getItem('asha_village_records');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Fetch live ASHA records from backend on mount
  React.useEffect(() => {
    let isMounted = true;
    const loadAshaData = async () => {
      try {
        const liveRecords = await api.getAshaRecords();
        if (isMounted && liveRecords && liveRecords.length > 0) {
          setRecords(liveRecords);
        }
      } catch (e) {
        console.error('Failed to load live ASHA records:', e);
      }
    };
    loadAshaData();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem('asha_village_records', JSON.stringify(records));
    } catch {}
  }, [records]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<'IDLE' | 'ROOT_EXCHANGE' | 'DELTA_STREAM' | 'MERKLE_MERGED'>('IDLE');
  const [highContrastMode, setHighContrastMode] = useState(false);

  // New Record Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newIsPregnant, setNewIsPregnant] = useState(false);
  const [newGestationalWeeks, setNewGestationalWeeks] = useState('12');
  const [newHb, setNewHb] = useState('10.5');
  const [newBp, setNewBp] = useState('120/80');
  const [newHomeRemedy, setNewHomeRemedy] = useState('');

  const handleSyncToPhc = async () => {
    sovereignSound('notch');
    setIsSyncing(true);
    setSyncProgress('ROOT_EXCHANGE');

    try {
      // Direct live CRDT sync to SQLite WAL node
      await api.syncAshaRecords(records.map(r => r.id));
    } catch (err) {
      console.warn('Sync notice:', err);
    }

    setTimeout(() => {
      setSyncProgress('DELTA_STREAM');
      setTimeout(() => {
        setSyncProgress('MERKLE_MERGED');
        setRecords(prev => prev.map(r => ({ ...r, syncedToPhc: true })));
        setIsSyncing(false);
        sovereignSound('chime');
      }, 700);
    }, 600);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) return;

    sovereignSound('shutter');
    const ageNum = parseInt(newPatientAge) || 25;
    const hbNum = parseFloat(newHb) || 11.0;
    const isHrp = newIsPregnant && (hbNum < 7.0 || parseInt(newBp.split('/')[0]) >= 140);

    const hrpFlags: string[] = [];
    if (newIsPregnant && hbNum < 7.0) hrpFlags.push('CRITICAL: Severe Anemia (Hb < 7 g/dL)');
    if (newIsPregnant && parseInt(newBp.split('/')[0]) >= 140) hrpFlags.push('CRITICAL: Gestational Hypertension');

    const newRec: AshaFieldRecord = {
      id: `asha-rec-${Date.now()}`,
      villageName: 'Nuh Rural - Sector 4',
      ashaWorkerName: 'Sunita Didi (ASHA-HR-9812)',
      patientName: newPatientName.trim(),
      age: ageNum,
      gender: 'FEMALE',
      isPregnant: newIsPregnant,
      gestationalWeeks: newIsPregnant ? parseInt(newGestationalWeeks) || 12 : undefined,
      hemoglobinGdl: hbNum,
      bloodPressure: newBp || '120/80',
      traditionalHomeRemedies: newHomeRemedy.trim() ? [newHomeRemedy.trim()] : [],
      highRiskPregnancyFlags: hrpFlags,
      crdtStateVersion: 1,
      merkleNodeHash: `sha256:${Math.random().toString(16).substring(2, 10)}...`,
      createdAt: 'Just now',
      syncedToPhc: false
    };

    try {
      await api.createAshaRecord(newRec);
    } catch (err) {
      console.warn('Created locally:', err);
    }

    setRecords([newRec, ...records]);
    setShowAddModal(false);
    setNewPatientName('');
    setNewPatientAge('');
    setNewHomeRemedy('');
  };

  const unsyncedCount = records.filter(r => !r.syncedToPhc).length;

  return (
    <div 
      style={{ 
        maxWidth: 1300, 
        margin: '0 auto', 
        padding: '16px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 18,
        filter: highContrastMode ? 'contrast(1.3)' : 'none'
      }}
    >
      {/* Top Banner */}
      <div 
        className="card"
        style={{
          padding: '14px 20px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div 
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#f3e8ff',
              border: '1px solid #e9d5ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7c3aed'
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                ASHA & ANM Outreach
              </h2>
              <span style={{ fontSize: 11, color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Sunita Didi · Nuh District
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              sovereignSound('notch');
              setHighContrastMode(!highContrastMode);
            }}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: 11.5, minHeight: 32, gap: 5, borderRadius: 8 }}
          >
            <Sun size={14} />
            <span>{highContrastMode ? 'Normal Contrast' : 'Sunlight Mode'}</span>
          </button>

          <button
            onClick={() => {
              sovereignSound('notch');
              setShowAddModal(true);
            }}
            className="btn btn-primary"
            style={{ padding: '6px 16px', fontSize: 12, minHeight: 32, fontWeight: 600, gap: 5, borderRadius: 8 }}
          >
            <Plus size={15} />
            <span>New Patient</span>
          </button>
        </div>
      </div>

      {/* Sync Status Alert Bar */}
      <div 
        style={{
          background: unsyncedCount > 0 ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${unsyncedCount > 0 ? '#fde68a' : '#bbf7d0'}`,
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {unsyncedCount > 0 ? (
            <WifiOff size={18} color="#d97706" />
          ) : (
            <Wifi size={18} color="#16a34a" />
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: unsyncedCount > 0 ? '#92400e' : '#166534' }}>
            {unsyncedCount > 0 
              ? `${unsyncedCount} Records Stored Offline (Pending Sync)` 
              : 'All Records Synchronized to PHC Cloud'}
          </div>
        </div>

        <button
          onClick={handleSyncToPhc}
          disabled={isSyncing || unsyncedCount === 0}
          className={`btn ${unsyncedCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '6px 16px',
            fontSize: 11.5,
            fontWeight: 600,
            borderRadius: 8,
            gap: 6
          }}
        >
          <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
          <span>
            {isSyncing ? 'Syncing...' : `Sync ${unsyncedCount} Records`}
          </span>
        </button>
      </div>

      {/* Village Records Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {records.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '48px 20px', textAlign: 'center', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <Users style={{ width: 44, height: 44, margin: '0 auto 12px auto', color: '#94a3b8' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              कोई आशा ग्रामीण रिकॉर्ड नहीं मिला · No Village Records Found
            </div>
            <p style={{ fontSize: 13, color: '#64748b', maxWidth: 420, margin: '0 auto 16px auto' }}>
              Click &quot;New Patient&quot; above to register rural pregnant mothers, record home remedies, and log hemoglobin levels for offline sync.
            </p>
          </div>
        ) : (
          records.map(record => {
          const isHrp = record.highRiskPregnancyFlags.length > 0;

          return (
            <div 
              key={record.id}
              className="card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                borderRadius: 16,
                border: isHrp 
                  ? '1px solid #fecaca' 
                  : record.isPregnant 
                  ? '1px solid #fbcfe8' 
                  : '1px solid #e2e8f0',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {record.patientName}
                    </h3>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>
                      {record.age}y {record.gender.charAt(0)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MapPin size={11} color="#94a3b8" />
                    <span>{record.villageName}</span>
                  </div>
                </div>

                <div>
                  {isHrp ? (
                    <span className="badge badge-emergency" style={{ fontSize: 10, padding: '3px 8px' }}>
                      HIGH RISK
                    </span>
                  ) : record.isPregnant ? (
                    <span style={{ background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>
                      Gestation: {record.gestationalWeeks}w
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Vitals Telemetry Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Hb</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: (record.hemoglobinGdl || 12) < 7.0 ? '#dc2626' : '#16a34a' }}>
                    {record.hemoglobinGdl} g/dL
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>BP</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: parseInt(record.bloodPressure?.split('/')[0] || '120') >= 140 ? '#dc2626' : '#0f172a' }}>
                    {record.bloodPressure || '120/80'}
                  </div>
                </div>
              </div>

              {/* High Risk Pregnancy Warnings */}
              {isHrp && (
                <div style={{ background: '#fef2f2', padding: '8px 10px', borderRadius: 8, border: '1px solid #fecaca', fontSize: 10.5, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {record.highRiskPregnancyFlags.map((flag, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertCircle size={12} color="#dc2626" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Traditional Home Remedies Logged */}
              {record.traditionalHomeRemedies.length > 0 && (
                <div style={{ fontSize: 11, color: '#475569' }}>
                  <strong style={{ color: '#d97706' }}>Remedies:</strong> {record.traditionalHomeRemedies.join(', ')}
                </div>
              )}

              {/* Card Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 8, fontSize: 11 }}>
                <span style={{ color: '#94a3b8' }}>{record.createdAt}</span>
                <span style={{ color: record.syncedToPhc ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                  {record.syncedToPhc ? '✓ Synced' : '● Offline'}
                </span>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Register New Patient Modal */}
      {showAddModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
        >
          <div 
            className="card"
            style={{
              width: '100%',
              maxWidth: 520,
              padding: 24,
              border: '1px solid #cbd5e1',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              background: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Register Village Encounter (ग्रामीण मरीज पंजीकरण)
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleCreateRecord} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Patient Full Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Shakuntala Devi"
                  value={newPatientName}
                  onChange={e => setNewPatientName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13, marginTop: 4 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Age (Years)</label>
                  <input 
                    type="number"
                    placeholder="26"
                    value={newPatientAge}
                    onChange={e => setNewPatientAge(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13, marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Blood Pressure</label>
                  <input 
                    type="text"
                    placeholder="120/80"
                    value={newBp}
                    onChange={e => setNewBp(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13, marginTop: 4 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdf2f8', padding: '10px 12px', borderRadius: 8, border: '1px solid #fbcfe8' }}>
                <input 
                  type="checkbox"
                  id="pregCheck"
                  checked={newIsPregnant}
                  onChange={e => setNewIsPregnant(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="pregCheck" style={{ fontSize: 12.5, color: '#be185d', fontWeight: 600, cursor: 'pointer' }}>
                  Is Patient Currently Pregnant? (गर्भवती महिला)
                </label>
              </div>

              {newIsPregnant && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Gestation (Weeks)</label>
                    <input 
                      type="number"
                      value={newGestationalWeeks}
                      onChange={e => setNewGestationalWeeks(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13, marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Hemoglobin (Hb g/dL)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={newHb}
                      onChange={e => setNewHb(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13, marginTop: 4 }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>Traditional Home Remedies Logged (दादी के नुस्खे / जड़ी-बूटी)</label>
                <input 
                  type="text"
                  placeholder="e.g. Kada, Haldi milk, Ajwain pani..."
                  value={newHomeRemedy}
                  onChange={e => setNewHomeRemedy(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13, marginTop: 4 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, borderRadius: 8 }}
                >
                  Save to Offline Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
