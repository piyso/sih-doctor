import React, { useEffect, useMemo, useState } from 'react';
import { FileCode, Download, Copy, Check, X, Loader2, User, Building2, Stethoscope, CalendarClock, ClipboardList, Activity, Pill, FileText, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { SessionDetail } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { DoctorRole, RxDraft } from './doctorRole';

interface AbdmFhirExportModalProps {
  sessionId: string;
  session: SessionDetail;
  role: DoctorRole;
  draft: RxDraft;
  onClose: () => void;
}

type Coding = { system?: string; code?: string; display?: string };

const codeSystemName = (system = '') =>
  /namaste|namstp/i.test(system) ? 'NAMASTE'
    : /icd-?10/i.test(system) ? 'ICD-10'
    : /icd-?11|who\.int/i.test(system) ? 'ICD-11'
    : /snomed/i.test(system) ? 'SNOMED CT'
    : /loinc/i.test(system) ? 'LOINC'
    : system.replace(/^https?:\/\//, '').split('/')[0] || 'Code';

const displayName = (r: any): string => {
  if (!r) return '';
  if (Array.isArray(r.name) && r.name[0]) return r.name[0].text || [r.name[0].prefix, r.name[0].given?.join(' '), r.name[0].family].filter(Boolean).join(' ');
  if (typeof r.name === 'string') return r.name;
  return r.code?.text || r.code?.coding?.[0]?.display || r.title || r.id || '';
};

const codingsOf = (r: any): Coding[] => [
  ...(r?.code?.coding || []),
  ...(r?.medicationCodeableConcept?.coding || []),
  ...(r?.type?.[0]?.coding || [])
];

/** Builds a minimal local bundle when the server cannot be reached, so the doctor still sees the record. */
const buildLocalBundle = (session: SessionDetail, role: DoctorRole, draft: RxDraft) => ({
  resourceType: 'Bundle',
  id: `local-preview-${session.sessionId}`,
  type: 'document',
  timestamp: new Date().toISOString(),
  entry: [
    { resource: { resourceType: 'Composition', status: 'preliminary', title: role === 'AYURVEDA' ? 'Ayurveda OPD consultation' : 'OPD consultation', date: new Date().toISOString() } },
    { resource: { resourceType: 'Patient', id: session.patientId, name: [{ text: session.patientName }], gender: (session.gender || '').toLowerCase(), identifier: session.abhaId ? [{ system: 'https://healthid.abdm.gov.in', value: session.abhaId }] : [] } },
    ...session.symptoms.map(s => ({ resource: { resourceType: 'Condition', code: { text: s.name || s.site } } })),
    ...draft.allopathic.map(m => ({ resource: { resourceType: 'MedicationRequest', status: 'draft', medicationCodeableConcept: { text: m.name }, dosageInstruction: [{ text: [m.dosage, m.frequency, m.durationDays ? `${m.durationDays} days` : ''].filter(Boolean).join(' · ') }] } })),
    ...draft.ayush.map(a => ({ resource: { resourceType: 'MedicationRequest', status: 'draft', medicationCodeableConcept: { text: a.classicalName }, dosageInstruction: [{ text: [a.dose, a.frequency, a.anupana ? `with ${a.anupana}` : '', a.durationDays ? `${a.durationDays} days` : ''].filter(Boolean).join(' · ') }] } }))
  ].map((e, i) => ({ fullUrl: `urn:uuid:local-${i}`, ...e }))
});

export const AbdmFhirExportModal: React.FC<AbdmFhirExportModalProps> = ({ sessionId, session, role, draft, onClose }) => {
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [tab, setTab] = useState<'document' | 'json'>('document');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Built from the doctor's current draft, so the preview shows what signing will send.
    api.previewFhirDraft(sessionId, {
      symptoms: session.symptoms, pariksha: session.pariksha, vitals: session.vitals,
      diagnoses: draft.diagnoses, allopathicPrescription: draft.allopathic, ayushPrescription: draft.ayush,
      investigationsOrdered: draft.investigations, pathya: draft.pathya, apathya: draft.apathya, advice: draft.advice, followUpDays: draft.followUpDays || undefined
    })
      .then(r => { if (alive) { setBundle(r.bundle); setFinalized(r.finalized); setIsLocal(false); } })
      .catch(err => {
        console.warn('[FHIR] Server bundle unavailable, showing local preview:', err);
        if (alive) { setBundle(buildLocalBundle(session, role, draft)); setIsLocal(true); }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sessionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resources: any[] = useMemo(() => (bundle?.entry || []).map((e: any) => e.resource).filter(Boolean), [bundle]);
  const byType = (type: string) => resources.filter(r => r.resourceType === type);
  const allCodes = useMemo(() => {
    const seen = new Set<string>();
    return resources.flatMap(codingsOf).filter(c => {
      const key = `${c.system}|${c.code}`;
      if (!c.code || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [resources]);
  const jsonString = bundle ? JSON.stringify(bundle, null, 2) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      sovereignSound.playDialNotch();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ABDM_FHIR_${session.patientName.replace(/\s+/g, '_')}_${bundle?.id || sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const patient = byType('Patient')[0];
  const composition = byType('Composition')[0];
  const encounter = byType('Encounter')[0];
  const practitioner = byType('Practitioner')[0];
  const organization = byType('Organization')[0];
  const conditions = byType('Condition');
  const observations = byType('Observation');
  const medications = [...byType('MedicationRequest'), ...byType('MedicationStatement')];
  const knownTypes = new Set(['Patient', 'Composition', 'Encounter', 'Practitioner', 'Organization', 'Condition', 'Observation', 'MedicationRequest', 'MedicationStatement']);
  const others = resources.filter(r => !knownTypes.has(r.resourceType));

  const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="p-3 rounded-xl border border-border bg-card">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">{icon}{title}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="ABDM FHIR record">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30"><FileCode size={20} className="text-emerald-600" /></div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-foreground m-0">ABDM health record (FHIR R4 bundle)</h3>
              <p className="text-xs text-muted-foreground m-0 truncate">{session.patientName} · {bundle?.id || sessionId}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 pt-3">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border">
            {(['document', 'json'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === t ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground'}`}>
                {t === 'document' ? 'Readable record' : 'Raw JSON'}
              </button>
            ))}
          </div>
          {!loading && <span className="text-[11px] text-muted-foreground">{resources.length} resources</span>}
        </div>

        {!loading && !isLocal && !finalized && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/40 text-xs font-semibold text-sky-900 dark:text-sky-100 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            Draft preview built from this prescription (status “preliminary”). Nothing is sent to ABDM until you sign; the signed record is shared when the patient’s consent request arrives.
          </div>
        )}
        {isLocal && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            Server not reachable — showing a local preview built from this screen. It has not been sent to ABDM.
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-sm font-semibold">Building the FHIR bundle…</span>
            </div>
          ) : tab === 'json' ? (
            <pre className="text-[11.5px] leading-relaxed font-mono whitespace-pre-wrap break-all bg-muted/40 border border-border rounded-xl p-4 text-foreground">{jsonString}</pre>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              <Section icon={<FileText size={12} />} title="Document">
                <div className="font-semibold">{composition?.title || 'Clinical document'}</div>
                <div className="text-xs text-muted-foreground">
                  Status: {composition?.status || '—'} · {composition?.date ? new Date(composition.date).toLocaleString('en-IN') : bundle?.timestamp ? new Date(bundle.timestamp).toLocaleString('en-IN') : ''}
                </div>
              </Section>
              <Section icon={<User size={12} />} title="Patient">
                <div className="font-semibold">{displayName(patient) || session.patientName}</div>
                <div className="text-xs text-muted-foreground">
                  {[patient?.gender, patient?.birthDate, ...(patient?.identifier || []).map((i: any) => `${/abdm|healthid/i.test(i.system || '') ? 'ABHA' : 'ID'} ${i.value}`)].filter(Boolean).join(' · ')}
                </div>
              </Section>
              {(practitioner || organization) && (
                <Section icon={<Building2 size={12} />} title="Provider">
                  {practitioner && <div className="font-semibold flex items-center gap-1.5"><Stethoscope size={13} /> {displayName(practitioner)}</div>}
                  {organization && <div className="text-xs text-muted-foreground">{displayName(organization)}</div>}
                </Section>
              )}
              {encounter && (
                <Section icon={<CalendarClock size={12} />} title="Visit">
                  <div className="font-semibold">{encounter.class?.display || encounter.class?.code || 'Outpatient'} · {encounter.status}</div>
                  {encounter.period?.start && <div className="text-xs text-muted-foreground">{new Date(encounter.period.start).toLocaleString('en-IN')}</div>}
                </Section>
              )}
              <div className="sm:col-span-2" style={{ gridColumn: '1 / -1' }}>
                <Section icon={<ClipboardList size={12} />} title={`Diagnoses / conditions (${conditions.length})`}>
                  {conditions.length === 0 ? <span className="text-xs text-muted-foreground">None recorded</span> : (
                    <ul className="space-y-1.5">
                      {conditions.map((c, i) => (
                        <li key={i}>
                          <div className="font-semibold">{displayName(c)}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {codingsOf(c).filter(k => k.code).map((k, j) => (
                              <span key={j} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border">{codeSystemName(k.system)} {k.code}</span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
              {observations.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Section icon={<Activity size={12} />} title={`Observations (${observations.length})`}>
                    <ul className="space-y-1 text-xs">
                      {observations.map((o, i) => (
                        <li key={i}><strong>{displayName(o)}</strong>: {o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}` : o.valueString || (o.component || []).map((c: any) => `${displayName(c)} ${c.valueQuantity?.value ?? ''}`).join(', ')}</li>
                      ))}
                    </ul>
                  </Section>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <Section icon={<Pill size={12} />} title={`Medicines (${medications.length})`}>
                  {medications.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Medicines are added to this record when the prescription is finalized.</span>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {medications.map((m, i) => (
                        <li key={i}><strong>{m.medicationCodeableConcept?.text || displayName({ code: m.medicationCodeableConcept })}</strong>{m.dosageInstruction?.[0]?.text ? ` — ${m.dosageInstruction[0].text}` : ''}</li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
              {others.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Section icon={<FileCode size={12} />} title="Other resources">
                    <div className="text-xs text-muted-foreground">{others.map(o => o.resourceType).join(', ')}</div>
                  </Section>
                </div>
              )}
              {allCodes.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }} className="text-[11px] text-muted-foreground">
                  Codes in this bundle: {allCodes.map(c => `${codeSystemName(c.system)} ${c.code}`).join(' · ')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button type="button" onClick={handleCopy} disabled={!bundle} className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: 12 }}>
            {copied ? <Check size={14} /> : <Copy size={14} />} <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
          <button type="button" onClick={handleDownload} disabled={!bundle} className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 12 }}>
            <Download size={14} /> <span>Download bundle</span>
          </button>
        </div>
      </div>
    </div>
  );
};
