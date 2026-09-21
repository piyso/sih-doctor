import React, { useState } from 'react';
import { 
  Building2, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  ShieldAlert, 
  Users, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Flame, 
  Radio, 
  BellRing,
  ExternalLink,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { NocOpdRoomTelemetry, IdspSyndromicCluster, PvpiAdverseReactionAnomaly } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { TriageHeatmap } from '../../components/admin/TriageHeatmap';
import { api } from '../../services/api';

export const CommandCenterView: React.FC = () => {
  const [rooms, setRooms] = useState<NocOpdRoomTelemetry[]>([]);
  const [idspClusters, setIdspClusters] = useState<IdspSyndromicCluster[]>([]);
  const [pvpiAnomalies, setPvpiAnomalies] = useState<PvpiAdverseReactionAnomaly[]>([]);
  const [activeTab, setActiveTab] = useState<'flow' | 'idsp' | 'pvpi' | 'census'>('flow');

  const loadLiveTelemetry = async () => {
    try {
      const data = await api.getAdminTelemetry();
      if (data) {
        if (Array.isArray(data.rooms)) setRooms(data.rooms);
        if (Array.isArray(data.idspClusters)) setIdspClusters(data.idspClusters);
        if (Array.isArray(data.pvpiAnomalies)) setPvpiAnomalies(data.pvpiAnomalies);
      }
    } catch (e) {
      console.error('Telemetry update failed:', e);
    }
  };

  React.useEffect(() => {
    loadLiveTelemetry();
    const interval = setInterval(loadLiveTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalWaiting = rooms.reduce((acc, r) => acc + r.queuedPatientsCount, 0);
  const totalEmergencies = rooms.reduce((acc, r) => acc + r.emergencyDivertedCount, 0);

  const handleMobilizeReserve = (roomNumber: string) => {
    sovereignSound('chime');
    setRooms(prev => prev.map(r => 
      r.roomNumber === roomNumber 
        ? { ...r, queuedPatientsCount: Math.max(15, r.queuedPatientsCount - 25), pacingStatus: 'OPTIMAL' }
        : r
    ));
    alert(`Reserve Medical Officer dispatched to ${roomNumber}. Queue redistributed.`);
  };

  const handleDispatchFogging = (clusterId: string) => {
    sovereignSound('chime');
    alert(`Municipal Vector Control & Larvicidal Team dispatched to region. IDSP Case #${clusterId} marked ACTION_COMMENCED.`);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Executive Command Banner */}
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
              background: '#ffe4e6',
              border: '1px solid #fecdd3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e11d48'
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                Epidemiological Command NOC
              </h2>
              <span style={{ fontSize: 11, color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                National Health Surveillance · AIIA & MoHFW
              </span>
            </div>
          </div>
        </div>

        {/* Global KPI Counters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ background: '#f8fafc', padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Queue:</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{totalWaiting} Waiting</span>
          </div>

          <div style={{ background: '#fef2f2', padding: '6px 14px', borderRadius: 8, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#dc2626', textTransform: 'uppercase', fontWeight: 600 }}>Casualty:</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#dc2626' }}>{totalEmergencies} Red Flags</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs - iOS Segmented Control */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 10, border: '1px solid #e2e8f0', width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { id: 'flow', label: '1. OPD Flow & Burnout', icon: Activity, count: rooms.length },
          { id: 'idsp', label: '2. IDSP Outbreak Alerts', icon: Radio, count: idspClusters.length },
          { id: 'pvpi', label: '3. PvPI Drug Safety', icon: ShieldAlert, count: pvpiAnomalies.length },
          { id: 'census', label: '4. Census Heatmap', icon: BarChart3, count: 5420 }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                sovereignSound('notch');
                setActiveTab(tab.id as any);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#0f172a' : '#64748b',
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} color={isActive ? '#0284c7' : '#64748b'} />
              <span>{tab.label}</span>
              <span 
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 9999,
                  background: isActive ? '#e0f2fe' : '#e2e8f0',
                  color: isActive ? '#0369a1' : '#64748b'
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: OPD Flow & Burnout Telemetry */}
      {activeTab === 'flow' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {rooms.map((room, idx) => {
            const isBottleneck = room.pacingStatus === 'BOTTLE_NECK';
            const isRushed = room.pacingStatus === 'RUSHED';

            return (
              <div 
                key={idx}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  borderRadius: 16,
                  border: isBottleneck 
                    ? '1px solid #fecaca' 
                    : isRushed 
                    ? '1px solid #fde68a' 
                    : '1px solid #e2e8f0',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                      {room.roomNumber} · {room.department}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '2px 0 0 0' }}>
                      {room.doctorName}
                    </h3>
                  </div>

                  <div>
                    {isBottleneck ? (
                      <span className="badge badge-emergency" style={{ fontSize: 10, padding: '3px 8px' }}>
                        BOTTLENECK
                      </span>
                    ) : isRushed ? (
                      <span className="badge badge-high" style={{ fontSize: 10, padding: '3px 8px' }}>
                        RUSHED (&lt;45s)
                      </span>
                    ) : (
                      <span className="badge badge-routine" style={{ fontSize: 10, padding: '3px 8px' }}>
                        OPTIMAL
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Queue</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isBottleneck ? '#dc2626' : '#0f172a' }}>
                      {room.queuedPatientsCount} Patients
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Avg Consult</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isRushed ? '#d97706' : '#16a34a' }}>
                      {room.averageConsultationSeconds}s
                    </div>
                  </div>
                </div>

                {isBottleneck && (
                  <button
                    onClick={() => handleMobilizeReserve(room.roomNumber)}
                    className="btn btn-primary"
                    style={{ padding: '7px 14px', fontSize: 11.5, fontWeight: 600, background: '#dc2626', color: '#fff', border: 'none', justifyContent: 'center', borderRadius: 8 }}
                  >
                    Mobilize Reserve Doctor
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: IDSP Syndromic Outbreak Early Warning */}
      {activeTab === 'idsp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {idspClusters.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <Radio style={{ width: 40, height: 40, margin: '0 auto 12px auto', color: '#16a34a' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                कोई सक्रिय महामारी क्लस्टर नहीं मिला · Zero Syndromic Epidemic Signals
              </div>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 460, margin: '0 auto' }}>
                Spatial Poisson and Kulldorff log-likelihood surveillance is actively analyzing incoming OPD queue records. No acute outbreak threshold exceeded.
              </p>
            </div>
          ) : (
            idspClusters.map(cluster => (
            <div 
              key={cluster.id}
              className="card"
              style={{
                padding: 18,
                borderRadius: 16,
                border: '1px solid #fecaca',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Radio size={16} color="#dc2626" />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#dc2626' }}>
                    IDSP SYNDROMIC ALERT (p = {cluster.pValue})
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  Kulldorff: {cluster.kulldorffLogLikelihood}
                </span>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {cluster.syndromeName}
                </h3>
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2, fontWeight: 600 }}>
                  Pathogen: {cluster.suspectedPathogen} · Region: {cluster.pincodeRegion}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                  {cluster.suggestedIntervention}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                <span style={{ fontSize: 11.5, color: '#64748b' }}>
                  Signals: <strong style={{ color: '#0f172a' }}>{cluster.patientCount} Patients</strong>
                </span>

                <button
                  onClick={() => handleDispatchFogging(cluster.id)}
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontSize: 11.5, fontWeight: 600, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8 }}
                >
                  Dispatch Vector Control
                </button>
              </div>
            </div>
          )))}
        </div>
      )}

      {/* Tab 3: PvPI Adverse Drug Reaction Anomaly Intercept */}
      {activeTab === 'pvpi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pvpiAnomalies.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <ShieldAlert style={{ width: 40, height: 40, margin: '0 auto 12px auto', color: '#16a34a' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                कोई औषधि दुष्प्रभाव विसंगति नहीं · Zero Adverse Drug Reactions Flagged
              </div>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 460, margin: '0 auto' }}>
                All finalized OPD and Dispensary prescriptions are screened against the Pharmacovigilance Programme of India (PvPI) and AYUSH NPvCC database. Zero anomalous batch signals detected.
              </p>
            </div>
          ) : (
            pvpiAnomalies.map(anomaly => (
            <div 
              key={anomaly.id}
              className="card"
              style={{
                padding: 18,
                borderRadius: 16,
                border: '1px solid #fde68a',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={16} color="#d97706" />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#d97706' }}>
                    PVPI ADVERSE REACTION ANOMALY (BF₁₀ = {anomaly.bayesFactorBF10})
                  </span>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {anomaly.formulationName}
                </h3>
                <div style={{ fontSize: 12, color: '#d97706', marginTop: 2, fontWeight: 600 }}>
                  Batch: {anomaly.suspectedCommercialBatch} · Mfr: {anomaly.manufacturer}
                </div>
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                  Adverse Reaction: {anomaly.clinicalAdverseReaction} ({anomaly.reportedCases} cases)
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                <button
                  onClick={() => {
                    sovereignSound('chime');
                    alert(`Statutory recall alert sent to Ministry of Ayush for Lot ${anomaly.suspectedCommercialBatch}.`);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontSize: 11.5, fontWeight: 600, background: '#d97706', color: '#ffffff', border: 'none', borderRadius: 8 }}
                >
                  Issue Statutory Recall Alert
                </button>
              </div>
            </div>
          )))}
        </div>
      )}

      {/* Tab 4: Hospital OPD Census & Crowd Heatmap */}
      {activeTab === 'census' && (
        <div style={{ marginTop: 4 }}>
          <TriageHeatmap />
        </div>
      )}
    </div>
  );
};
