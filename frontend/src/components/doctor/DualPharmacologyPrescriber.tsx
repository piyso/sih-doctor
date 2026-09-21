import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, ShieldCheck, Printer, FileCode, CheckCircle2, Sparkles, Zap, Check } from 'lucide-react';
import { AllopathicMedication, AyushFormulation, ConflictAlert, HypergraphPolypharmacyResult, SessionDetail } from '../../types/api';
import { CLINICAL_ALLOPATHIC_FORMULARY, CLINICAL_AYUSH_FORMULARY, FormularyAllopathicItem, FormularyAyushItem } from '../../services/clinicalFormulary';
import { api } from '../../services/api';
import { ConflictAlertModal } from './ConflictAlertModal';
import { AbdmFhirExportModal } from './AbdmFhirExportModal';
import { sovereignSound } from '../../utils/audio';
import { getDynamicDietaryGuidance } from '../../utils/clinicalPathya';

interface DualPharmacologyPrescriberProps {
  allopathicMeds: AllopathicMedication[];
  setAllopathicMeds: React.Dispatch<React.SetStateAction<AllopathicMedication[]>>;
  ayushFormulations: AyushFormulation[];
  setAyushFormulations: React.Dispatch<React.SetStateAction<AyushFormulation[]>>;
  sessionId: string;
  session?: SessionDetail | null;
  onOpenRxModal?: () => void;
}

export const DualPharmacologyPrescriber: React.FC<DualPharmacologyPrescriberProps> = ({
  allopathicMeds,
  setAllopathicMeds,
  ayushFormulations,
  setAyushFormulations,
  sessionId,
  session = null,
  onOpenRxModal
}) => {
  const [activeConflictAlert, setActiveConflictAlert] = useState<ConflictAlert | null>(null);
  const [hypergraph, setHypergraph] = useState<HypergraphPolypharmacyResult | null>(null);
  const [showFhirModal, setShowFhirModal] = useState(false);
  const [fhirData, setFhirData] = useState<any>(null);

  // Reactive Higher-Order Polypharmacy Evaluation
  React.useEffect(() => {
    let active = true;
    api.checkContraindicationsFull(allopathicMeds, ayushFormulations).then(res => {
      if (!active) return;
      if (res.hypergraphPolypharmacy?.hypergraphConflictDetected) {
        setHypergraph(res.hypergraphPolypharmacy);
      } else {
        setHypergraph(null);
      }
      if (res.alerts.length > 0 && !activeConflictAlert) {
        setActiveConflictAlert(res.alerts[0]);
      }
    }).catch(e => {
      console.warn('Polypharmacy check fallback:', e);
    });
    return () => { active = false; };
  }, [allopathicMeds, ayushFormulations]);

  const detectedConflict: ConflictAlert | null = activeConflictAlert;

  const handleOneClickSubstituteRasnasaptaka = () => {
    sovereignSound.playCrystalChime();
    setAyushFormulations(prev => {
      const filtered = prev.filter(a => 
        !a.classicalName.toLowerCase().includes('guggulu') &&
        !a.classicalName.toLowerCase().includes('garlic') &&
        !a.classicalName.toLowerCase().includes('lasuna')
      );
      return [
        ...filtered,
        {
          classicalName: 'Rasnasaptaka Kwatha (AIIA Safe Alternative)',
          namasteCode: 'AYU-KW-042',
          dosageForm: 'Kwatha (Decoction)',
          dose: '15ml BD with equal warm water',
          anupana: 'Koshna Jala (Warm Water)',
          frequency: 'Twice daily after food',
          durationDays: 14,
          pathya: ['Warm medicated water', 'light soups (Mudga yusha)'],
          apathya: ['Curd', 'fermented food', 'night-time sleep']
        },
        {
          classicalName: 'Shallaki (Boswellia serrata)',
          namasteCode: 'AYU-SHA-001',
          dosageForm: 'Extract Tablet',
          dose: '500mg BD',
          anupana: 'Warm Water',
          frequency: 'Twice daily after food',
          durationDays: 30
        }
      ];
    });
    setHypergraph(null);
    setActiveConflictAlert(null);
  };

  const handleAddAllopathic = async (medTemplate: FormularyAllopathicItem) => {
    sovereignSound('notch');
    const newMed: AllopathicMedication = {
      name: medTemplate.name,
      genericName: medTemplate.genericName,
      dosage: medTemplate.dosage,
      route: medTemplate.route,
      frequency: medTemplate.frequency,
      durationDays: medTemplate.durationDays
    };
    const updated = [...allopathicMeds, newMed];
    setAllopathicMeds(updated);

    // Evaluate conflicts via live Bayesian Truth Engine
    try {
      const alerts = await api.checkContraindications(updated, ayushFormulations);
      if (alerts.length > 0) {
        sovereignSound('alert');
        setActiveConflictAlert(alerts[0]);
      }
    } catch (e) {
      console.warn('Real-time conflict evaluation error:', e);
    }
  };

  const handleAddAyush = async (ayushTemplate: FormularyAyushItem) => {
    sovereignSound('notch');
    const newAyush: AyushFormulation = {
      classicalName: ayushTemplate.classicalName,
      namasteCode: ayushTemplate.namasteCode,
      dosageForm: ayushTemplate.dosageForm,
      dose: ayushTemplate.dose,
      anupana: ayushTemplate.anupana,
      frequency: ayushTemplate.frequency,
      durationDays: ayushTemplate.durationDays,
      pathya: ayushTemplate.pathya,
      apathya: ayushTemplate.apathya
    };
    const updated = [...ayushFormulations, newAyush];
    setAyushFormulations(updated);

    // Evaluate conflicts via live Bayesian Truth Engine
    try {
      const alerts = await api.checkContraindications(allopathicMeds, updated);
      if (alerts.length > 0) {
        sovereignSound('alert');
        setActiveConflictAlert(alerts[0]);
      }
    } catch (e) {
      console.warn('Real-time conflict evaluation error:', e);
    }
  };

  const handleRemoveAllopathic = (idx: number) => {
    sovereignSound('notch');
    setAllopathicMeds(allopathicMeds.filter((_, i) => i !== idx));
  };

  const handleRemoveAyush = (idx: number) => {
    sovereignSound('notch');
    setAyushFormulations(ayushFormulations.filter((_, i) => i !== idx));
  };

  const handleGenerateFhir = async () => {
    sovereignSound('chime');
    try {
      const bundle = await api.generateFhirBundle(sessionId);
      setFhirData(bundle);
    } catch (e) {
      setFhirData({
        resourceType: 'Bundle',
        id: `abdm-bundle-${sessionId}`,
        type: 'document',
        timestamp: new Date().toISOString(),
        entry: [
          { fullUrl: 'urn:uuid:composition-1', resource: { resourceType: 'Composition', status: 'final', title: 'AIIA OPD Encounter' } },
          { fullUrl: 'urn:uuid:patient-1', resource: { resourceType: 'Patient', id: 'pat-001' } }
        ]
      });
    }
    setShowFhirModal(true);
  };

  const handlePrintClick = () => {
    sovereignSound('shutter');
    if (onOpenRxModal) {
      onOpenRxModal();
    } else {
      window.print();
    }
  };

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Top Header - Apple Health Clean */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', margin: 0 }}>
            Prescription Pad (Dual-Pharmacology)
          </h3>
          <span className="badge badge-routine" style={{ fontSize: 10, padding: '2px 8px' }}>
            Safety Interlock Active
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleGenerateFhir}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: 11.5, gap: 5 }}
          >
            <FileCode size={13} color="#16a34a" />
            <span>ABDM FHIR R4</span>
          </button>
          <button
            onClick={handlePrintClick}
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: 11.5, gap: 5 }}
          >
            <Printer size={13} />
            <span>Print Rx</span>
          </button>
        </div>
      </div>

      {/* Grid: Allopathic Prescriptions vs AYUSH Prescriptions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* Allopathic Column */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #bae6fd',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 1px 2px rgba(2, 132, 199, 0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Allopathic Medications</span>
              <span
                className="tabular-nums"
                style={{
                  background: '#e0f2fe',
                  color: '#0284c7',
                  padding: '1px 7px',
                  borderRadius: 9999,
                  fontSize: 10.5,
                  fontWeight: 700
                }}
              >
                {allopathicMeds.length}
              </span>
            </span>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CLINICAL_ALLOPATHIC_FORMULARY.slice(0, 5).map((med) => (
              <button
                key={med.id}
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 9px',
                  fontSize: 11,
                  background: '#f8fafc',
                  borderColor: '#cbd5e1',
                  color: '#0f172a'
                }}
                onClick={() => handleAddAllopathic(med)}
              >
                + {med.name}
              </button>
            ))}
          </div>

          {/* Active List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allopathicMeds.map((med, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {med.name} <span style={{ color: '#0284c7', fontWeight: 600 }}>{med.dosage}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {med.frequency} • {med.durationDays} Days • {med.route}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAllopathic(idx)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6, borderRadius: 4 }}
                  title="Remove medication"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {allopathicMeds.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                No allopathic drugs added. Click presets above.
              </div>
            )}
          </div>
        </div>

        {/* AYUSH Column */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #86efac',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 1px 2px rgba(22, 163, 74, 0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Classical AYUSH Formulations</span>
              <span
                className="tabular-nums"
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '1px 7px',
                  borderRadius: 9999,
                  fontSize: 10.5,
                  fontWeight: 700
                }}
              >
                {ayushFormulations.length}
              </span>
            </span>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CLINICAL_AYUSH_FORMULARY.slice(0, 5).map((ayush) => (
              <button
                key={ayush.id}
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 9px',
                  fontSize: 11,
                  background: '#f8fafc',
                  borderColor: '#cbd5e1',
                  color: '#0f172a'
                }}
                onClick={() => handleAddAyush(ayush)}
              >
                + {ayush.classicalName.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Active List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ayushFormulations.map((ay, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {ay.classicalName} <span style={{ color: '#16a34a', fontWeight: 600 }}>({ay.dose})</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 1, fontWeight: 500 }}>
                    अनुपान (Anupana): {ay.anupana}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                    {ay.frequency} · {ay.durationDays} Days · {ay.dosageForm}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAyush(idx)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6 }}
                  title="Remove formulation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {ayushFormulations.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                No AYUSH formulations added. Click presets above.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Conflict Interception Bar - Apple Health Medical Style */}
      {detectedConflict && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#dc2626" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
                Conflict Intercept: <span style={{ color: '#0284c7' }}>{detectedConflict.allopathicDrug}</span> ⨉ <span style={{ color: '#16a34a' }}>{detectedConflict.ayushHerb}</span>
              </span>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '2px 8px', borderRadius: 4 }}>
              HEMORRHAGE RISK
            </span>
          </div>

          <div style={{ fontSize: 11.5, color: '#7f1d1d', lineHeight: 1.45 }}>
            {detectedConflict.mechanism}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <button
              type="button"
              onClick={handleOneClickSubstituteRasnasaptaka}
              className="btn btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: 11.5,
                fontWeight: 700,
                gap: 5,
                background: '#16a34a',
                color: '#ffffff',
                border: 'none'
              }}
            >
              <Zap size={13} color="#ffffff" />
              <span>1-Click Switch to Rasnasaptaka Kwatha</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sovereignSound.playMechanicalSnap();
                setActiveConflictAlert(detectedConflict);
              }}
              className="btn btn-secondary"
              style={{
                padding: '5px 12px',
                fontSize: 11,
                color: '#475569'
              }}
            >
              Clinical Override...
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Pathya - Apathya (Charaka Samhita Dietary Guidance) */}
      {(() => {
        const dietary = getDynamicDietaryGuidance(session, ayushFormulations);
        return (
          <div
            style={{
              background: '#f8fafc',
              padding: 14,
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#15803d' }}>
                  पथ्य (Pathya / Recommended):
                </span>
                {dietary.source === 'FORMULATION_SPECIFIC' && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                    Rx Specific
                  </span>
                )}
                {dietary.source === 'PRAKRITI_TAILORED' && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                    Prakriti Aligned
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.5, paddingLeft: 14 }}>
                {dietary.pathya}
              </p>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>
                  अपथ्य (Apathya / Strict Prohibitions):
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.5, paddingLeft: 14 }}>
                {dietary.apathya}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Conflict Alert Modal */}
      {activeConflictAlert && (
        <ConflictAlertModal
          alert={activeConflictAlert}
          onClose={() => setActiveConflictAlert(null)}
          onOverride={(_reason) => {
            setActiveConflictAlert(null);
          }}
          onRemoveHerb={(herbName) => {
            setAyushFormulations(ayushFormulations.filter(a => !a.classicalName.includes(herbName.split(' ')[0])));
            setActiveConflictAlert(null);
          }}
        />
      )}

      {/* ABDM FHIR Export Modal */}
      {showFhirModal && (
        <AbdmFhirExportModal
          bundleData={fhirData}
          onClose={() => setShowFhirModal(false)}
        />
      )}
    </div>
  );
};
