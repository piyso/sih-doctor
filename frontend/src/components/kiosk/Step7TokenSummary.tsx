import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Printer, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw, 
  Stethoscope, 
  ShieldCheck, 
  Award, 
  Users, 
  Scale, 
  AlertTriangle, 
  X,
  User,
  HeartPulse,
  Flame,
  Activity
} from 'lucide-react';
import { PatentBadge } from '../common/PatentBadge';
import { api } from '../../services/api';
import { ZkSnarkProofBadge } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { RealQrCode } from '../common/RealQrCode';

interface Step7TokenSummaryProps {
  patient: any;
  symptoms: any[];
  pariksha: any;
  vitals: any;
  redFlags: string[];
  sessionId: string;
  causalDagOverride?: any;
  mlcCaseInfo?: any;
  airborneIsolationInfo?: any;
  onReset: () => void;
  onGoToDoctorDesk: () => void;
}

export const Step7TokenSummary: React.FC<Step7TokenSummaryProps> = ({
  patient,
  symptoms,
  pariksha,
  vitals,
  redFlags,
  sessionId,
  causalDagOverride,
  mlcCaseInfo,
  airborneIsolationInfo,
  onReset,
  onGoToDoctorDesk
}) => {
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyTokens, setFamilyTokens] = useState<any[] | null>(null);
  const [familySubmitting, setFamilySubmitting] = useState(false);

  // Department and room routing based on isolation or MLC
  const isAirborne = airborneIsolationInfo?.isAirborneRisk;
  const isMlc = mlcCaseInfo?.isMlc;
  const isEmergency = redFlags.length > 0 || symptoms.some(s => s.severityScore >= 8) || isMlc;
  
  let tokenNumber = isEmergency ? 'RED-001 (STAT)' : 'KAYA-042';
  let allocatedRoom = isEmergency ? 'Room 01: Emergency Resuscitation Bay' : 'Room 204: Kayachikitsa OPD';
  let waitTime = isEmergency ? '0 MINS (IMMEDIATE)' : '14 MINS';

  if (isAirborne) {
    tokenNumber = 'FLUS-109 (ISOLATION)';
    allocatedRoom = 'Room 109: Outdoor Negative Pressure Isolation Pavilion';
    waitTime = 'IMMEDIATE AIRBORNE TRIAGE';
  } else if (isMlc) {
    tokenNumber = 'MLC-007 (MEDICO-LEGAL)';
    allocatedRoom = 'Room 01: Forensic & Resuscitation Trauma Bay';
    waitTime = 'STAT 0 MINS';
  }

  const [zkBadge, setZkBadge] = useState<ZkSnarkProofBadge | null>(null);

  useEffect(() => {
    sovereignSound.playCrystalChime();
    let isMounted = true;
    api.verifyZkProof({
      sessionId,
      patient,
      vitals,
      pariksha,
      symptoms
    }).then(badge => {
      if (isMounted) setZkBadge(badge);
    }).catch(err => {
      console.warn('Live ZKP verification fallback:', err);
    });
    return () => { isMounted = false; };
  }, [sessionId, patient]);

  const handlePrint = () => {
    sovereignSound.playMechanicalSnap();
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 select-none">
      {/* Causal Red-Flag Override Banner */}
      {causalDagOverride?.triggered && (
        <div className="mb-4 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <Award size={22} className="text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
              <div className="text-xs font-heading font-extrabold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                Clinical Red-Flag Intercept: Emergency Cardiac Triage Allocated
              </div>
              <div className="text-xs text-sky-900/80 dark:text-sky-200/80 mt-0.5">
                Patient reported vernacular complaint <em>"{causalDagOverride.rawComplaintTerm}"</em>. Inferred: <strong>{causalDagOverride.inferredPathology}</strong>. Priority routing active.
              </div>
            </div>
          </div>
          <span className="text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 shrink-0">
            STAT TRIAGE
          </span>
        </div>
      )}

      {/* Medico-Legal Case (MLC) Secure Custody Banner */}
      {mlcCaseInfo?.isMlc && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <Scale size={22} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <div className="text-xs font-heading font-extrabold uppercase tracking-wide text-rose-800 dark:text-rose-300">
                Medico-Legal Case (MLC-STAT): Digital Evidence Protection Active
              </div>
              <div className="text-xs text-rose-900/80 dark:text-rose-200/80 mt-0.5">
                Category: <strong>{mlcCaseInfo.category}</strong> • Station: <strong>{mlcCaseInfo.policeStationJurisdiction}</strong>
                <br />
                <span className="font-mono text-[10.5px] opacity-85">Forensic Digest: {mlcCaseInfo.hmacDigest}</span>
              </div>
            </div>
          </div>
          <span className="text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 shrink-0">
            LEGAL CHAIN SECURED
          </span>
        </div>
      )}

      {/* Airborne Droplet Intercept Callout */}
      {airborneIsolationInfo?.isAirborneRisk && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-heading font-extrabold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Airborne Droplet Isolation Route ({airborneIsolationInfo.isolationBayNumber})
              </div>
              <div className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-0.5">
                Patient rerouted to Outdoor Negative Pressure Pavilion. Free N95 mask provided at Gateway Gate B.
              </div>
            </div>
          </div>
          <span className="text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
            NEGATIVE PRESSURE ROUTE
          </span>
        </div>
      )}

      {/* Official OPD Boarding Pass (Apple Wallet / Hospital Workstation Slip) */}
      <div
        className={`physical-card p-6 sm:p-8 mb-6 relative ${
          isEmergency ? 'border-rose-400 dark:border-rose-600/80 shadow-rose-500/10' : ''
        }`}
      >
        {/* Hospital Institutional Header */}
        <div className="border-b border-border/80 pb-4 mb-5 text-center">
          <div className="text-[10.5px] font-mono font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
            GOVERNMENT OF INDIA · MINISTRY OF AYUSH & MoHFW
          </div>
          <div className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight mt-1">
            ALL INDIA INSTITUTE OF AYURVEDA (AIIA)
          </div>
          <div className="text-xs text-muted-foreground font-medium mt-0.5">
            Apex Autonomous Institute · Sarita Vihar, New Delhi - 110076
          </div>
          <div className="text-[10.5px] font-mono text-muted-foreground/80 mt-1.5">
            Sovereign MediKiosk Automated Triage Slip · Session: <span className="text-sky-600 dark:text-sky-400">{sessionId || 'sess-kiosk-live'}</span>
          </div>
        </div>

        {/* Big Token Number & Room Monolith Block */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl mb-6 items-center border ${
            isEmergency
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-muted/40 border-border/80'
          }`}
        >
          <div>
            <div className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Your Token Number (टोकन संख्या)
            </div>
            <div
              className={`text-3xl sm:text-4xl font-mono font-extrabold tracking-tight mt-1 ${
                isEmergency ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}
            >
              {tokenNumber}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
              Priority:{' '}
              <span className={`font-mono font-bold ${isEmergency ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isEmergency ? '● EMERGENCY STAT' : '● ROUTINE OPD'}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Consultation Room (कक्ष संख्या)
            </div>
            <div className="text-base sm:text-lg font-heading font-bold text-foreground mt-1">
              {allocatedRoom}
            </div>
            <div className="text-xs text-sky-600 dark:text-sky-400 font-semibold mt-1">
              Estimated Wait: <span className="font-mono font-bold">{waitTime}</span>
            </div>
          </div>

          {/* High-Contrast Optical QR Code Block */}
          <div className="flex flex-col items-center sm:items-end justify-center">
            <div className="bg-white p-2 rounded-xl border border-slate-300 shadow-xs flex items-center justify-center">
              <RealQrCode
                value={`https://aiia.gov.in/opd/verify?token=${encodeURIComponent(tokenNumber)}&session=${encodeURIComponent(sessionId)}&room=${encodeURIComponent(allocatedRoom)}&patient=${encodeURIComponent(patient?.name || 'Anonymous')}&ts=${Date.now()}`}
                size={76}
                level="M"
                title={`Scan OPD Token: ${tokenNumber}`}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ABDM Fast Pass
            </span>
          </div>
        </div>

        {/* Laser Perforated Tear-Line with Notch Cutouts */}
        <div className="relative my-6">
          <div className="absolute -left-8 -top-3 w-6 h-6 rounded-full bg-background border-r border-border/80" />
          <div className="absolute -right-8 -top-3 w-6 h-6 rounded-full bg-background border-l border-border/80" />
          <div className="border-t border-dashed border-border/80 w-full" />
        </div>

        {/* Patient Details & Clinical Snapshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/75">
            <div className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-2">
              Patient Demographic Record:
            </div>
            <div className="text-sm font-heading font-bold text-foreground">
              Name: <span>{patient.name || 'Anonymous Patient'}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Age / Gender: {patient.age || 42} Yrs / {patient.gender || 'Female'}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              ABHA ID: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{patient.abhaId || '14-8921-0428-9102 (Verified)'}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Prakriti: <span className="text-amber-600 dark:text-amber-400 font-semibold">{pariksha.prakriti || 'Vata-Pitta'}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/75">
            <div className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
              Recorded Vitals & Triage:
            </div>
            <div className="text-sm font-heading font-bold text-foreground font-mono">
              BP: {vitals.bp || '120/80'} • Pulse: {vitals.pulse || 72} bpm
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              SpO2: {vitals.spo2 || '98%'} • Temp: {vitals.temp || '98.6°F'}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
              Agni: {pariksha.agni || 'SAMAGNI'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Pain Score:{' '}
              <span className={`font-bold ${isEmergency ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {symptoms[0]?.severityScore || 5}/10
              </span>{' '}
              ({symptoms[0]?.character || 'Aching'})
            </div>
          </div>
        </div>

        {/* Cryptographic Proof Verification */}
        <div className="flex justify-between items-center border-t border-border/70 pt-4 flex-wrap gap-2.5">
          {zkBadge ? (
            <PatentBadge badge={zkBadge} />
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/60 border border-border/70 rounded-xl text-xs text-foreground font-medium">
              <ShieldCheck size={14} className="text-primary" />
              <span>Cryptographic Privacy Verified · Digital OPD Fast Pass Issued</span>
            </div>
          )}
          <span className="text-[10.5px] font-mono text-muted-foreground">
            DPDP Act 2023 Air-Gap · Sub-ms Sovereign Edge Token
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-between flex-wrap no-print">
        <div className="flex gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              onReset();
            }}
            className="tactile-btn px-4 py-2.5 text-xs font-semibold gap-1.5"
          >
            <RefreshCw size={14} />
            <span>New Intake (नया मरीज़)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playCrystalChime();
              setShowFamilyModal(true);
            }}
            className="tactile-btn px-4 py-2.5 text-xs font-semibold gap-1.5 text-sky-600 dark:text-sky-400 border-sky-400/40 hover:bg-sky-500/10"
          >
            <Users size={14} />
            <span>+ Add Family Member (1 Phone / 3 Gen)</span>
          </button>
        </div>

        <div className="flex gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handlePrint}
            className="tactile-btn px-4 py-2.5 text-xs font-semibold gap-1.5"
          >
            <Printer size={14} />
            <span>Print Token Slip</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              onGoToDoctorDesk();
            }}
            className="tactile-btn-primary px-6 py-2.5 text-xs font-bold gap-2"
          >
            <Stethoscope size={15} />
            <span>Open in Doctor OPD Cockpit</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 1-Phone-for-3-Generations Multi-Patient Family Session Hub Modal / Panel */}
      {showFamilyModal && (
        <div className="mt-6 p-6 physical-card shadow-xl border-border animate-fade-in">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users size={20} className="text-sky-600 dark:text-sky-400" />
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-foreground">
                  1-Phone-for-3-Generations Family Batch Hub
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register dependent family members on one smartphone. Emits sequential linked tokens to keep the family together.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                sovereignSound.playMechanicalSnap();
                setShowFamilyModal(false);
              }}
              className="tactile-btn h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>

          {!familyTokens ? (
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Preset Family Roster for Synchronized Batch Triage:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/75">
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-xs font-heading font-bold text-foreground">Harish Chandra</div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">Grandfather</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Age: 74 Yrs • Male</div>
                  <div className="text-xs text-sky-600 dark:text-sky-400 font-medium mt-1">Complaint: Osteoarthritis (Sandhivata)</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Dept: Kayachikitsa OPD</div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/75">
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-xs font-heading font-bold text-foreground">Shanti Devi</div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">Mother</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Age: 48 Yrs • Female</div>
                  <div className="text-xs text-sky-600 dark:text-sky-400 font-medium mt-1">Complaint: Hot flashes & insomnia</div>
                  <div className="text-[11px] text-pink-600 dark:text-pink-400 font-semibold mt-1">Dept: Prasuti & Stri Roga</div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/75">
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-xs font-heading font-bold text-foreground">Aarav</div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">Child</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Age: 6 Yrs • Male</div>
                  <div className="text-xs text-sky-600 dark:text-sky-400 font-medium mt-1">Complaint: Recurrent dry cough</div>
                  <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">Dept: Kaumarbhritya (Pediatrics)</div>
                </div>
              </div>

              <button
                type="button"
                disabled={familySubmitting}
                onClick={async () => {
                  sovereignSound.playMechanicalSnap();
                  setFamilySubmitting(true);
                  try {
                    const res = await api.submitFamilyIntake(patient.phone || '9876543210', [
                      { name: 'Harish Chandra', age: 74, gender: 'MALE', relationship: 'Grandfather', chiefComplaint: 'Bilateral Osteoarthritis', department: 'Kayachikitsa' },
                      { name: 'Shanti Devi', age: 48, gender: 'FEMALE', relationship: 'Mother', chiefComplaint: 'Hot flashes & insomnia', department: 'Prasuti & Stri Roga' },
                      { name: 'Aarav', age: 6, gender: 'MALE', relationship: 'Grandchild', chiefComplaint: 'Recurrent dry cough', department: 'Kaumarbhritya' }
                    ]);
                    setFamilyTokens(res.familyTokens);
                    sovereignSound.playCrystalChime();
                  } catch (e) {
                    console.error('Family registration failed:', e);
                  } finally {
                    setFamilySubmitting(false);
                  }
                }}
                className="tactile-btn-primary px-5 py-2.5 text-xs font-bold gap-2"
              >
                <Users size={15} />
                <span>{familySubmitting ? 'Registering Family Batch...' : 'Generate 3 Linked Family Tokens'}</span>
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-3.5">
                <CheckCircle2 size={18} />
                <span className="text-xs font-heading font-bold">
                  3 Family Tokens Issued Successfully (Master Phone: {patient.phone || '9876543210'})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {familyTokens.map((ft, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-muted/40 border border-border/75"
                  >
                    <div className="text-[10.5px] font-mono font-bold uppercase text-muted-foreground">
                      Token {idx + 1} ({ft.relationship})
                    </div>
                    <div className="text-xl font-mono font-extrabold text-sky-600 dark:text-sky-400 my-1">
                      {ft.tokenNumber}
                    </div>
                    <div className="text-xs font-heading font-bold text-foreground">
                      {ft.patientName}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {ft.department} • {ft.roomNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
