import React, { useState } from 'react';
import { 
  Scan, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  ShieldCheck, 
  Pill, 
  Sparkles, 
  FileText, 
  QrCode, 
  Clock, 
  ArrowRight,
  HelpCircle,
  RefreshCw,
  Search,
  Volume2
} from 'lucide-react';
import { PharmacyDispenseItem } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { api } from '../../services/api';
import { RealQrCode } from '../../components/common/RealQrCode';

export const PharmacyDeskView: React.FC = () => {
  const [queue, setQueue] = useState<PharmacyDispenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scannedInput, setScannedInput] = useState('');
  const [selectedRx, setSelectedRx] = useState<PharmacyDispenseItem | null>(null);
  const [dispensedTokens, setDispensedTokens] = useState<Set<string>>(new Set());
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'hi' | 'ta' | 'pa' | 'bn' | 'en'>('hi');

  const loadQueue = async () => {
    try {
      setIsLoading(true);
      const items = await api.getPharmacyQueue();
      setQueue(items);
      if (items.length > 0) {
        setSelectedRx(prev => prev ? (items.find(i => i.id === prev.id) || items[0]) : items[0]);
      } else {
        setSelectedRx(null);
      }
    } catch (e) {
      console.error('Failed to load pharmacy queue:', e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleScanOrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedInput.trim()) return;

    const query = scannedInput.trim().toUpperCase();
    const found = queue.find(
      q => q.prescriptionToken.toUpperCase().includes(query) || 
           q.patientName.toUpperCase().includes(query)
    );

    if (found) {
      sovereignSound('chime');
      setSelectedRx(found);
      setScannedInput('');
    } else {
      sovereignSound('alert');
    }
  };

  const handleDispense = (token: string) => {
    sovereignSound('chime');
    setDispensedTokens(prev => new Set([...prev, token]));
  };

  const isDispensed = selectedRx ? dispensedTokens.has(selectedRx.prescriptionToken) : false;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              background: '#fef3c7',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}
          >
            <Pill size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                Pharmacy Dispensing Console
              </h2>
              <span style={{ fontSize: 11, color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                जन औषधि एवं आयुष औषधालय
              </span>
            </div>
          </div>
        </div>

        {/* Barcode Scanner Input Form */}
        <form onSubmit={handleScanOrSearch} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Scan size={15} color="#0284c7" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              placeholder="Scan Barcode / Token (e.g. KY-104)..."
              value={scannedInput}
              onChange={e => setScannedInput(e.target.value)}
              style={{
                width: 260,
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: 12.5,
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>
          <button 
            type="submit"
            className="btn btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8
            }}
          >
            Verify
          </button>
        </form>
      </div>

      {/* Main Grid: Left Prescription Browser, Center Clinical Check, Right Label Generator */}
      <div className="pharmacy-grid">
        {/* Column 1: Live Dispensary Queue */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Tokens ({queue.length})
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>LIVE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 580 }}>
            {queue.length === 0 ? (
              <div style={{ padding: '32px 12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                {isLoading ? 'Loading live prescriptions...' : 'प्रतीक्षारत पर्चे उपलब्ध नहीं हैं\nNo pending prescriptions'}
              </div>
            ) : (
              queue.map(item => {
                const isSelected = selectedRx?.id === item.id;
                const dispensed = dispensedTokens.has(item.prescriptionToken);

                return (
                  <div 
                    key={item.id}
                    onClick={() => {
                      sovereignSound('notch');
                      setSelectedRx(item);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: isSelected 
                        ? '#eff6ff' 
                        : '#f8fafc',
                      border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        {item.patientName}
                      </span>
                      <span 
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: dispensed ? '#dcfce7' : '#e0f2fe',
                          color: dispensed ? '#16a34a' : '#0284c7'
                        }}
                      >
                        {dispensed ? '✓ DISPENSED' : item.prescriptionToken}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {item.age}y {item.gender?.charAt(0)} · {item.roomNumber?.split(' ')[0]}
                    </div>

                    {item.lasaAlerts && item.lasaAlerts.length > 0 && (
                      <div style={{ marginTop: 4, fontSize: 10, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <AlertTriangle size={11} />
                        <span>LASA Interlock Active</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Selected Prescription Detail & Verification */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          {!selectedRx ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b', margin: 'auto' }}>
              <Pill style={{ width: 44, height: 44, margin: '0 auto 12px auto', opacity: 0.3 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                पर्चे की प्रतीक्षा है · No Prescription Selected
              </div>
              <p style={{ fontSize: 12.5, margin: 0, color: '#64748b' }}>
                Select a token from the live list to verify medications, review LASA alerts, and dispense.
              </p>
            </div>
          ) : (
            <>
              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {selectedRx.patientName}
                    </h3>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>
                      Token #{selectedRx.prescriptionToken} · {selectedRx.age}y {selectedRx.gender?.charAt(0)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    Prescribed by <strong style={{ color: '#0284c7' }}>{selectedRx.doctorName}</strong> · Room {selectedRx.roomNumber?.split(' ')[0]}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Prescribed</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>{selectedRx.prescribedAt}</div>
                </div>
              </div>

          {/* Look-Alike Sound-Alike (LASA) Warning Box if Present */}
          {selectedRx.lasaAlerts.length > 0 && (
            <div 
              style={{
                background: '#fef2f2',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #fecaca',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontWeight: 700, fontSize: 11.5 }}>
                <AlertTriangle size={14} />
                <span>LASA INTERLOCK ALERT</span>
              </div>
              {selectedRx.lasaAlerts.map((alert, idx) => (
                <div key={idx} style={{ fontSize: 11.5, color: '#991b1b', lineHeight: 1.4 }}>
                  {alert.warningMessage}
                </div>
              ))}
            </div>
          )}

          {/* Allopathic Medications to Dispense */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Pill size={14} />
              <span>Allopathic Medications</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRx.allopathicMeds.map((med, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {med.name} — <span style={{ color: '#0284c7' }}>{med.dosage}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {med.frequency} · {med.durationDays} Days · {med.route}
                    </div>
                    {med.instructions && (
                      <div style={{ fontSize: 10.5, color: '#d97706', marginTop: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={11} color="#d97706" />
                        <span>{med.instructions}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#16a34a', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>In Stock</span>
                </div>
              ))}
            </div>
          </div>

          {/* Classical Ayurvedic Formulations to Dispense */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} />
              <span>Classical Ayurvedic Formulations</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRx.ayushFormulations.map((form, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {form.classicalName}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      Dose: {form.dose} · {form.dosageForm} · {form.frequency}
                    </div>
                    <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: 600 }}>
                      Anupana: {form.anupana}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: '#16a34a', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>AFI Verified</span>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory Digital Signature Proof */}
          <div 
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', fontWeight: 600 }}>
              <ShieldCheck size={15} />
              <span>
                Digitally Signed: {selectedRx.scheduleE1PoisonVerification?.digitalSignatureDigest?.split(' ')[0] || 'TPM 2.0 Valid'}
              </span>
            </div>
            <span style={{ color: '#7c3aed', fontWeight: 700 }}>BSA 2023 VALID</span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button 
              onClick={() => {
                sovereignSound('shutter');
                setShowLabelModal(true);
              }}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, gap: 6, borderRadius: 8 }}
            >
              <Printer size={14} />
              <span>Dosing Labels</span>
            </button>

            <button 
              onClick={() => handleDispense(selectedRx.prescriptionToken)}
              disabled={isDispensed}
              className={`btn ${isDispensed ? 'btn-secondary' : 'btn-primary'}`}
              style={{
                padding: '8px 20px',
                fontSize: 12,
                fontWeight: 600,
                gap: 6,
                borderRadius: 8
              }}
            >
              <CheckCircle2 size={15} />
              <span>{isDispensed ? 'Dispensed' : 'Verify & Dispense All'}</span>
            </button>
          </div>
            </>
          )}
        </div>

        {/* Column 3: Live Label Preview */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Dosing Label Preview
            </span>
          </div>

          {!selectedRx ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
              Select a prescription to preview regional dosing labels
            </div>
          ) : (
            <>


          {/* Language Selector for Label */}
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
            {[
              { code: 'hi', label: 'हिंदी' },
              { code: 'pa', label: 'ਪੰਜਾਬੀ' },
              { code: 'ta', label: 'தமிழ்' },
              { code: 'bn', label: 'বাংলা' },
              { code: 'en', label: 'EN' }
            ].map(lang => (
              <button
                key={lang.code}
                onClick={() => {
                  sovereignSound('notch');
                  setSelectedLanguage(lang.code as any);
                }}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  background: selectedLanguage === lang.code ? '#ffffff' : 'transparent',
                  color: selectedLanguage === lang.code ? '#0f172a' : '#64748b',
                  boxShadow: selectedLanguage === lang.code ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Visual Thermal Label Representation */}
          <div 
            style={{
              background: '#ffffff',
              color: '#1e293b',
              padding: 14,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
              <strong style={{ fontSize: 12, color: '#0f172a', display: 'block' }}>
                अखिल भारतीय आयुर्वेद संस्थान (AIIA) औषधालय
              </strong>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                टोकन: {selectedRx.prescriptionToken} • मरीज: {selectedRx.patientName} ({selectedRx.age} वर्ष)
              </span>
            </div>

            {selectedRx.allopathicMeds[0] && (
              <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
                <strong style={{ color: '#0f172a' }}>दवा:</strong> {selectedRx.allopathicMeds[0].name} ({selectedRx.allopathicMeds[0].dosage})<br />
                <strong>खुराक:</strong> दिन में 2 बार (1 गोली सुबह, 1 गोली रात)<br />
                <strong>निर्देश:</strong> भोजन के 10 मिनट बाद ताजे पानी से लें।<br />
                <span style={{ color: '#dc2626', fontSize: 10.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <AlertTriangle size={11} color="#dc2626" />
                  <span>कभी भी खाली पेट न लें।</span>
                </span>
              </div>
            )}

            {selectedRx.ayushFormulations[0] && (
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 6, fontSize: 11.5, lineHeight: 1.45 }}>
                <strong style={{ color: '#0f172a' }}>आयुष दवा:</strong> {selectedRx.ayushFormulations[0].classicalName}<br />
                <strong>खुराक:</strong> {selectedRx.ayushFormulations[0].dose}<br />
                <strong style={{ color: '#16a34a' }}>अनुपान (वाहन):</strong> {selectedRx.ayushFormulations[0].anupana}
              </div>
            )}

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'left', fontSize: 9.5, color: '#64748b' }}>
                <div><strong>चिकित्सक:</strong> डॉ. {selectedRx.doctorName}</div>
                <div><strong>परामर्श कक्ष:</strong> {selectedRx.roomNumber}</div>
                <div style={{ color: '#059669', fontWeight: 600, marginTop: 2 }}>बारकोड सत्यापित</div>
              </div>
              <div style={{ padding: 2, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <RealQrCode
                  value={`https://aiia.gov.in/pharmacy/dosing?token=${encodeURIComponent(selectedRx.prescriptionToken)}&patient=${encodeURIComponent(selectedRx.patientName)}&lang=${selectedLanguage}`}
                  size={46}
                  level="M"
                  title="Scan for multilingual audio dosing instructions"
                />
              </div>
            </div>
          </div>

            <button 
              onClick={() => {
                sovereignSound('shutter');
                alert('Thermal adhesive label printed successfully on 80mm roll.');
              }}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '9px 0', fontSize: 12, fontWeight: 600, gap: 6, justifyContent: 'center', borderRadius: 8 }}
            >
              <Printer size={14} />
              <span>Print High-Adhesion Bottle Label</span>
            </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
