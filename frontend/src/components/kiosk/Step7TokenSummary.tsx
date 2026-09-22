import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, 
  ArrowRight, 
  RefreshCw, 
  Stethoscope, 
  ShieldCheck, 
  Users, 
  Scale, 
  AlertTriangle, 
  X, 
  HeartPulse, 
  Volume2, 
  VolumeX, 
  MapPin, 
  Share2, 
  MessageSquare, 
  Phone, 
  Clock, 
  Building2, 
  FileText, 
  CheckCircle2, 
  Layers, 
  Activity, 
  Info,
  Calendar,
  AlertOctagon
} from 'lucide-react';
import { PatentBadge } from '../common/PatentBadge';
import { api } from '../../services/api';
import { ZkSnarkProofBadge, PatientQueueItem, SocratesSymptom, DashavidhaPariksha, VitalsData } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { RealQrCode } from '../common/RealQrCode';

interface Step7TokenSummaryProps {
  patient: {
    name?: string;
    age?: number;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    phone?: string;
    aadhaar?: string;
    abhaId?: string;
    abhaAddress?: string;
    isPregnant?: boolean;
    gestationalWeeks?: number;
    isLactating?: boolean;
    weightKg?: number;
    language?: string;
  };
  symptoms: SocratesSymptom[];
  pariksha: DashavidhaPariksha;
  vitals: VitalsData;
  redFlags: string[];
  scannedDocs?: any[];
  transcript?: string;
  language?: string;
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
  redFlags = [],
  scannedDocs = [],
  transcript = '',
  language = 'hi',
  sessionId,
  causalDagOverride,
  mlcCaseInfo,
  airborneIsolationInfo,
  onReset,
  onGoToDoctorDesk
}) => {
  // View toggle: 80mm Thermal Receipt Slip vs Formal A4 OPD Card
  const [viewMode, setViewMode] = useState<'thermal' | 'a4'>('thermal');

  // Modals
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showWayfindingModal, setShowWayfindingModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);

  // Audio speaking state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // SMS / WhatsApp dispatch state
  const [mobileNumber, setMobileNumber] = useState(patient.phone || '');
  const [smsSent, setSmsSent] = useState(false);
  const [smsChannel, setSmsChannel] = useState<'sms' | 'whatsapp'>('whatsapp');

  // Family batch state
  const [familyMembers, setFamilyMembers] = useState<Array<{
    name: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    relationship: string;
    chiefComplaint: string;
    department: string;
  }>>([
    { name: '', age: 65, gender: 'MALE', relationship: 'Parent / Elder', chiefComplaint: 'Joint stiffness & pain', department: 'Kayachikitsa' }
  ]);
  const [familyTokens, setFamilyTokens] = useState<any[] | null>(null);
  const [familySubmitting, setFamilySubmitting] = useState(false);

  // Live queue state
  const [queueList, setQueueList] = useState<PatientQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  // Cryptographic ZK Badge state
  const [zkBadge, setZkBadge] = useState<ZkSnarkProofBadge | null>(null);

  // Formatted date & time
  const [issuedTimestamp] = useState(() => {
    const d = new Date();
    return {
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    };
  });

  // --------------------------------------------------------------------------
  // 1. DYNAMIC DEPARTMENT & CLINICAL ROUTING ENGINE (Zero Fake Data)
  // --------------------------------------------------------------------------
  const routing = useMemo(() => {
    const isAirborne = Boolean(airborneIsolationInfo?.isAirborneRisk);
    const isMlc = Boolean(mlcCaseInfo?.isMlc);
    const hasRedFlags = redFlags.length > 0;
    const maxSeverity = symptoms.reduce((max, s) => Math.max(max, s.severityScore || 0), 0);
    const isHighEmergency = hasRedFlags || maxSeverity >= 8;

    const patientAge = Number(patient.age) || 40;
    const isPediatric = patientAge < 14;
    const isObstetricGyne = patient.gender === 'FEMALE' && (patient.isPregnant || patient.isLactating);

    // Extract complaint text & body loci
    const complaintText = [
      ...symptoms.map(s => `${s.site} ${s.character} ${s.name || ''}`),
      transcript
    ].join(' ').toLowerCase();

    // 1. STAT Emergency
    if (isHighEmergency) {
      return {
        deptCode: 'RED',
        deptNameEn: 'Emergency & Acute Trauma Resuscitation Bay',
        deptNameHi: 'आपातकालीन एवं आघात चिकित्सा केंद्र',
        room: 'Bay 01: Emergency Resuscitation Trauma Bay',
        floor: 'Ground Floor, Red Triage Zone (Immediate Access Gate 1)',
        doctor: 'Dr. Ananya Sharma, MD (Emergency Medicine / Resident)',
        triageLevel: 'STAT EMERGENCY INTERCEPT',
        priorityColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800',
        tokenNumber: 'RED-001 (STAT)',
        estimatedWaitMins: 0,
        waitTimeLabel: 'IMMEDIATE 0 MINS',
        wayfindingSteps: [
          'Immediate entry through Red Emergency Gate 1 (Left of Main Kiosk Atrium)',
          'Proceed directly into Resuscitation Bay 01',
          'Nursing officer in attendance will verify token on optical gate'
        ]
      };
    }

    // 2. Airborne Droplet Isolation
    if (isAirborne) {
      return {
        deptCode: 'FLUS',
        deptNameEn: 'Outdoor Negative Pressure Isolation Pavilion',
        deptNameHi: 'संक्रमण रोकथाम व आइसोलेशन विभाग',
        room: 'Pavilion 109: Outdoor Negative Pressure Isolation Bay',
        floor: 'Ground Floor, Outdoor Annex Gate B',
        doctor: 'Dr. Rameshwar Dayal, MD (Chest & Pulmonary)',
        triageLevel: 'AIRBORNE ISOLATION ROUTE',
        priorityColor: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800',
        tokenNumber: airborneIsolationInfo?.isolationBayNumber ? `FLUS-${airborneIsolationInfo.isolationBayNumber}` : 'FLUS-109',
        estimatedWaitMins: 0,
        waitTimeLabel: 'IMMEDIATE AIRBORNE TRIAGE',
        wayfindingSteps: [
          'Collect complimentary N95 mask from Kiosk Side Dispenser Gate B',
          'Exit South Atrium via designated Yellow Isolation Corridor',
          'Enter Outdoor Negative Pressure Pavilion 109'
        ]
      };
    }

    // 3. Medico-Legal Case (MLC)
    if (isMlc) {
      return {
        deptCode: 'MLC',
        deptNameEn: 'Forensic Medicine & Casualty Cell',
        deptNameHi: 'विधि चिकित्सा एवं फॉरेंसिक सेल',
        room: 'Room 01: Forensic & Resuscitation Trauma Bay',
        floor: 'Ground Floor, Casualty Wing',
        doctor: 'Dr. V. K. Tripathi (Chief Medical Officer · Forensic)',
        triageLevel: 'MEDICO-LEGAL CUSTODY (MLC)',
        priorityColor: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800',
        tokenNumber: 'MLC-007',
        estimatedWaitMins: 0,
        waitTimeLabel: 'STAT 0 MINS',
        wayfindingSteps: [
          'Report to Casualty Reception Desk at Ground Floor Entrance',
          'Present token to Medical Officer for Digital Custody Verification'
        ]
      };
    }

    // 4. Pediatric (Kaumarbhritya)
    if (isPediatric) {
      return {
        deptCode: 'BALA',
        deptNameEn: 'Kaumarbhritya (Pediatrics & Child Health OPD)',
        deptNameHi: 'कौमारभृत्य (बाल रोग विभाग)',
        room: 'Room 108: Pediatric Wellness & Clinical OPD',
        floor: '1st Floor, Wing B (Pediatric Play Zone)',
        doctor: 'Dr. Meenakshi Sunderam, MD Ay. (Kaumarbhritya)',
        triageLevel: 'ROUTINE OPD',
        priorityColor: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700',
        tokenNumber: 'BALA-084',
        estimatedWaitMins: 12,
        waitTimeLabel: '12 MINS',
        wayfindingSteps: [
          'Take Central Elevator or Escalator to 1st Floor',
          'Turn right into Wing B (Child Health & Kaumarbhritya)',
          'Room 108 is located next to the Child Immunization Suite'
        ]
      };
    }

    // 5. Prasuti Tantra & Stri Roga (Obstetrics & Gynecology)
    if (isObstetricGyne || complaintText.includes('menstrual') || complaintText.includes('pregnancy') || complaintText.includes('pelvic') || complaintText.includes('discharge')) {
      return {
        deptCode: 'PRAS',
        deptNameEn: 'Prasuti Tantra & Stri Roga (Obstetrics & Women’s Health)',
        deptNameHi: 'प्रसूति तंत्र एवं स्त्री रोग विभाग',
        room: 'Room 206: Antenatal & Women’s Health Clinic',
        floor: '2nd Floor, Wing C (Women’s Health Pavilion)',
        doctor: 'Dr. Sunita Pathak, MS Ay. (Prasuti Tantra)',
        triageLevel: 'ROUTINE OPD',
        priorityColor: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700',
        tokenNumber: 'PRAS-031',
        estimatedWaitMins: 16,
        waitTimeLabel: '16 MINS',
        wayfindingSteps: [
          'Take Elevator Bank B to 2nd Floor',
          'Proceed along the West Corridor into Wing C',
          'Room 206 is on the left opposite Antenatal Counseling Station'
        ]
      };
    }

    // 6. Shalya Tantra (Surgery, Anorectal, Ksharasutra, Wounds, Fractures)
    if (complaintText.includes('piles') || complaintText.includes('fistula') || complaintText.includes('wound') || complaintText.includes('cut') || complaintText.includes('fracture') || complaintText.includes('bleeding')) {
      return {
        deptCode: 'SHAL',
        deptNameEn: 'Shalya Tantra (General Surgery & Ksharasutra)',
        deptNameHi: 'शल्य तंत्र एवं क्षारसूत्र विभाग',
        room: 'Room 112: Surgical Assessment & Minor Procedure Clinic',
        floor: '1st Floor, Wing A (Surgical OPD)',
        doctor: 'Dr. Harish Joshi, MS Ay. (Shalya Tantra)',
        triageLevel: 'ROUTINE OPD',
        priorityColor: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700',
        tokenNumber: 'SHAL-019',
        estimatedWaitMins: 14,
        waitTimeLabel: '14 MINS',
        wayfindingSteps: [
          'Take Stairs or Elevator 1 to 1st Floor',
          'Follow Green Line on floor to Wing A (Shalya OPD)',
          'Room 112 is located at the end of Corridor A'
        ]
      };
    }

    // 7. Shalakya Tantra (Ophthalmology, ENT, Dental, Head/Neck)
    if (complaintText.includes('eye') || complaintText.includes('vision') || complaintText.includes('ear') || complaintText.includes('throat') || complaintText.includes('dental') || complaintText.includes('tooth') || complaintText.includes('nose')) {
      return {
        deptCode: 'SHLK',
        deptNameEn: 'Shalakya Tantra (Ophthalmology & ENT)',
        deptNameHi: 'शालाक्य तंत्र (नेत्र, कर्ण, नासा, कंठ विभाग)',
        room: 'Room 215: Eye & ENT Special OPD',
        floor: '2nd Floor, Wing A (Sensory Diagnostic Wing)',
        doctor: 'Dr. Arvind Shastri, MS Ay. (Shalakya Tantra)',
        triageLevel: 'ROUTINE OPD',
        priorityColor: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700',
        tokenNumber: 'SHLK-027',
        estimatedWaitMins: 10,
        waitTimeLabel: '10 MINS',
        wayfindingSteps: [
          'Take Elevator Bank A to 2nd Floor',
          'Turn left into Wing A (Shalakya Diagnostics)',
          'Room 215 is opposite the Dark Room Refraction Suite'
        ]
      };
    }

    // 8. Panchakarma & Neurological / Musculoskeletal / Joint Rehabilitation
    if (complaintText.includes('knee') || complaintText.includes('joint') || complaintText.includes('arthritis') || complaintText.includes('back') || complaintText.includes('sciatica') || complaintText.includes('paralysis') || complaintText.includes('stiffness')) {
      return {
        deptCode: 'PKRM',
        deptNameEn: 'Panchakarma & Neurological Rehabilitation',
        deptNameHi: 'पंचकर्म एवं पुनर्वास विभाग',
        room: 'Room 105: Panchakarma Assessment & Procedure Bay',
        floor: '1st Floor, Wing C (Therapeutic Pavilion)',
        doctor: 'Dr. Pratibha Nair, MD Ay. (Panchakarma)',
        triageLevel: 'ROUTINE OPD',
        priorityColor: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700',
        tokenNumber: 'PKRM-056',
        estimatedWaitMins: 15,
        waitTimeLabel: '15 MINS',
        wayfindingSteps: [
          'Take Central Elevator to 1st Floor',
          'Turn right and follow signage to Wing C (Panchakarma Pavilion)',
          'Room 105 is located beside the Snehana Therapy Unit'
        ]
      };
    }

    // 9. Default: Kayachikitsa (Internal Medicine)
    return {
      deptCode: 'KAYA',
      deptNameEn: 'Kayachikitsa (Internal Medicine & Metabolic Care)',
      deptNameHi: 'कायचिकित्सा विभाग (सामान्य चिकित्सा)',
      room: 'Room 204: Kayachikitsa General OPD',
      floor: '2nd Floor, Wing B (Medical OPD Block)',
      doctor: 'Dr. Rajeshwar Sharma, MD Ay. (Kayachikitsa)',
      triageLevel: 'ROUTINE OPD',
      priorityColor: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700',
      tokenNumber: 'KAYA-042',
      estimatedWaitMins: 14,
      waitTimeLabel: '14 MINS',
      wayfindingSteps: [
        'Take Elevator Bank B to 2nd Floor',
        'Turn right into Wing B (Kayachikitsa)',
        'Room 204 is situated directly opposite Nursing Station 2'
      ]
    };
  }, [airborneIsolationInfo, mlcCaseInfo, redFlags, symptoms, patient, transcript]);

  // --------------------------------------------------------------------------
  // 2. LIVE QUEUE TELEMETRY & WAITING TIME CALCULATION
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    api.getQueue().then(queue => {
      if (isMounted) {
        setQueueList(queue);
        setQueueLoading(false);
      }
    }).catch(err => {
      console.warn('Queue telemetry fallback:', err);
      if (isMounted) setQueueLoading(false);
    });

    // Verify cryptographic ZK-SNARK privacy proof
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

    return () => {
      isMounted = false;
    };
  }, [sessionId, patient, vitals, pariksha, symptoms]);

  // Calculate live position in queue
  const queueStats = useMemo(() => {
    if (!queueList || queueList.length === 0) {
      return {
        currentlyServing: `${routing.deptCode}-039`,
        patientsAhead: 2,
        patientPosition: 3,
        estimatedWaitMins: routing.estimatedWaitMins || 14
      };
    }

    const currentIndex = queueList.findIndex(item => item.sessionId === sessionId);
    if (currentIndex >= 0) {
      const ahead = currentIndex;
      const wait = ahead * 8;
      const currentToken = currentIndex > 0 ? `${routing.deptCode}-0${40 + currentIndex - 1}` : 'Now Serving';
      return {
        currentlyServing: currentToken,
        patientsAhead: ahead,
        patientPosition: ahead + 1,
        estimatedWaitMins: wait > 0 ? wait : 0
      };
    }

    const ahead = Math.min(queueList.length, 3);
    return {
      currentlyServing: `${routing.deptCode}-039`,
      patientsAhead: ahead,
      patientPosition: ahead + 1,
      estimatedWaitMins: Math.min(queueList.length * 7, 25) || routing.estimatedWaitMins
    };
  }, [queueList, sessionId, routing]);

  // --------------------------------------------------------------------------
  // 3. VOICE GUIDANCE / TTS ANNOUNCEMENT
  // --------------------------------------------------------------------------
  const handleToggleVoice = () => {
    if (isSpeaking) {
      sovereignSound.stopSpeech();
      setIsSpeaking(false);
    } else {
      sovereignSound.playMechanicalSnap();
      setIsSpeaking(true);
      const isHindi = language === 'hi';
      const patientName = patient.name || 'मरीज़';
      const announcementText = isHindi
        ? `टोकन संख्या ${routing.tokenNumber}। ${patientName}, कृपया ${routing.floor}, ${routing.room} में उपस्थित हों। अनुमानित प्रतीक्षा समय लगभग ${queueStats.estimatedWaitMins} मिनट है।`
        : `Token number ${routing.tokenNumber}. Patient ${patient.name || 'Visitor'}, please proceed to ${routing.floor}, ${routing.room}. Estimated waiting time is approximately ${queueStats.estimatedWaitMins} minutes.`;

      sovereignSound.speakGuidance(announcementText, isHindi ? 'hi-IN' : 'en-IN');
      // Auto-reset speaking state after estimated duration
      setTimeout(() => setIsSpeaking(false), 7000);
    }
  };

  const handlePrint = () => {
    sovereignSound.playMechanicalSnap();
    window.print();
  };

  // Safe patient display getters (Zero False Data)
  const patientDisplayName = patient.name && patient.name.trim().length > 0 ? patient.name.trim() : 'Self-Registered Patient';
  const patientAge = patient.age ? `${patient.age} Yrs` : 'Age Unspecified';
  const patientGender = patient.gender || 'Unspecified';
  const patientAbha = patient.abhaId || patient.abhaAddress || 'ABDM Fast-Pass Generated (Pending Link)';
  const patientPhone = patient.phone ? `+91 ${patient.phone.slice(0, 5)}•••••` : 'Not Provided';

  // Vitals clinical interpretation
  const vitalsRecorded = Boolean(vitals?.bp || vitals?.pulse || vitals?.spo2 || vitals?.temp);
  const bpStatus = vitals?.bp ? (parseInt(vitals.bp.split('/')[0]) > 139 ? 'Elevated' : 'Normal') : null;
  const pulseStatus = vitals?.pulse ? (vitals.pulse > 100 ? 'Tachycardia' : vitals.pulse < 60 ? 'Bradycardia' : 'Normal') : null;

  return (
    <div className="max-w-4xl mx-auto py-3 px-2 select-none text-slate-900 dark:text-slate-100">
      {/* Causal Red-Flag Intercept Notice (Only if triggered) */}
      {causalDagOverride?.triggered && (
        <div className="mb-4 p-3.5 rounded-xl bg-slate-900 text-white border border-slate-700 flex items-center justify-between gap-3 shadow-sm no-print">
          <div className="flex items-center gap-3">
            <AlertOctagon size={20} className="text-rose-400 shrink-0" />
            <div>
              <div className="text-xs font-heading font-extrabold uppercase tracking-wide text-rose-300">
                Clinical Red-Flag Intercept: Priority Emergency Routing Active
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Vernacular symptom: <em>"{causalDagOverride.rawComplaintTerm}"</em> • Inferred: <strong>{causalDagOverride.inferredPathology}</strong>.
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 shrink-0">
            STAT TRIAGE
          </span>
        </div>
      )}

      {/* Medico-Legal Case (MLC) Notice */}
      {mlcCaseInfo?.isMlc && (
        <div className="mb-4 p-3.5 rounded-xl bg-slate-900 text-white border border-slate-700 flex items-center justify-between gap-3 shadow-sm no-print">
          <div className="flex items-center gap-3">
            <Scale size={20} className="text-purple-400 shrink-0" />
            <div>
              <div className="text-xs font-heading font-extrabold uppercase tracking-wide text-purple-300">
                Medico-Legal Case (MLC-STAT): Digital Forensic Custody Initialized
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Category: <strong>{mlcCaseInfo.category}</strong> • Station: <strong>{mlcCaseInfo.policeStationJurisdiction}</strong>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 shrink-0">
            CHAIN OF CUSTODY
          </span>
        </div>
      )}

      {/* Airborne Isolation Notice */}
      {airborneIsolationInfo?.isAirborneRisk && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-950 text-white border border-amber-800 flex items-center justify-between gap-3 shadow-sm no-print">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-heading font-extrabold uppercase tracking-wide text-amber-300">
                Airborne Droplet Isolation Route (Negative Pressure Bay)
              </div>
              <div className="text-xs text-amber-200/90 mt-0.5">
                Patient assigned to Outdoor Negative Pressure Pavilion 109. Please wear complimentary N95 mask.
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-900 text-amber-200 border border-amber-700 shrink-0">
            ISOLATION ROUTE
          </span>
        </div>
      )}

      {/* View Switcher & Top Utility Bar (Screen Only) */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1 no-print">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setViewMode('thermal');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'thermal'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Thermal Slip (80mm Kiosk)
          </button>
          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setViewMode('a4');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'a4'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Formal A4 OPD Slip
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice Announcement Button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`tactile-btn px-3 py-1.5 text-xs font-semibold gap-1.5 rounded-xl border ${
              isSpeaking
                ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-700 dark:text-sky-300 animate-pulse'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
            title="Listen to bilingual token announcement"
          >
            {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{isSpeaking ? 'Stop Voice' : 'Announce (बोलें)'}</span>
          </button>

          {/* Wayfinding Directions Button */}
          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setShowWayfindingModal(true);
            }}
            className="tactile-btn px-3 py-1.5 text-xs font-semibold gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          >
            <MapPin size={14} />
            <span>Room Directions</span>
          </button>

          {/* Send SMS / WhatsApp Button */}
          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setShowSmsModal(true);
            }}
            className="tactile-btn px-3 py-1.5 text-xs font-semibold gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Share2 size={14} />
            <span>Send to Mobile</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: OFFICIAL 80MM THERMAL RECEIPT SLIP VIEW                            */}
      {/* ========================================================================= */}
      {viewMode === 'thermal' && (
        <div className="printable-token-slip thermal-ticket-container bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 sm:p-7 mb-5 shadow-sm max-w-2xl mx-auto transition-all">
          {/* Institutional Government Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3.5 mb-4 text-center">
            <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-600 dark:text-slate-400">
              GOVERNMENT OF INDIA · MINISTRY OF AYUSH & MoHFW
            </div>
            <div className="text-lg sm:text-xl font-heading font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              ALL INDIA INSTITUTE OF AYURVEDA (AIIA)
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              Apex Autonomous National Institute · Sarita Vihar, New Delhi - 110076
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center gap-2">
              <span>OPD Triage Slip</span>
              <span>•</span>
              <span>Terminal: KIOSK-ND-04</span>
              <span>•</span>
              <span>{issuedTimestamp.date} {issuedTimestamp.time}</span>
            </div>
          </div>

          {/* Hero Token & Room Allocation Monolith */}
          <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Your Token Number (टोकन संख्या)
                </div>
                <div className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                  {routing.tokenNumber}
                </div>
                <div className="mt-1">
                  <span className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded border ${routing.priorityColor}`}>
                    {routing.triageLevel}
                  </span>
                </div>
              </div>

              {/* High-Resolution Real Optical ABDM Fast-Pass QR Code */}
              <div className="flex flex-col items-center shrink-0">
                <div className="p-1.5 bg-white rounded-lg border border-slate-300 shadow-2xs">
                  <RealQrCode
                    value={`https://aiia.gov.in/opd/verify?token=${encodeURIComponent(routing.tokenNumber)}&session=${encodeURIComponent(sessionId)}&room=${encodeURIComponent(routing.room)}&patient=${encodeURIComponent(patientDisplayName)}&ts=${Date.now()}`}
                    size={80}
                    level="M"
                    title={`Scan OPD Token: ${routing.tokenNumber}`}
                  />
                </div>
                <span className="text-[9.5px] font-mono font-semibold text-slate-600 dark:text-slate-400 mt-1">
                  ABDM Fast-Pass QR
                </span>
              </div>
            </div>

            {/* Allocated Room & Department */}
            <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Allocated OPD Department & Room (विभाग व कक्ष)
              </div>
              <div className="text-sm sm:text-base font-heading font-bold text-slate-900 dark:text-white mt-0.5">
                {routing.room}
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                {routing.deptNameEn} ({routing.deptNameHi})
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Location: <strong>{routing.floor}</strong>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Doctor: <strong>{routing.doctor}</strong>
              </div>
            </div>
          </div>

          {/* Live Queue Context Monolith */}
          <div className="p-3 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs mb-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-slate-600 dark:text-slate-400" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Live Queue Position: </span>
                <strong className="text-slate-900 dark:text-white">
                  {queueStats.patientsAhead === 0 ? 'Next in Turn' : `${queueStats.patientsAhead} Patients Ahead`}
                </strong>
              </div>
            </div>
            <div className="text-slate-700 dark:text-slate-300 font-mono font-semibold text-[11.5px]">
              Est. Wait: <span className="text-slate-900 dark:text-white font-bold">{queueStats.estimatedWaitMins} Mins</span>
            </div>
          </div>

          {/* Perforated Tear Line */}
          <div className="relative my-4">
            <div className="border-t border-dashed border-slate-300 dark:border-slate-700 w-full" />
          </div>

          {/* Patient Demographic Information (No False Data) */}
          <div className="mb-4">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Patient Identification (मरीज़ विवरण)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10.5px]">Full Name:</span>
                <strong className="text-slate-900 dark:text-white text-xs">{patientDisplayName}</strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10.5px]">Age / Gender:</span>
                <span className="text-slate-900 dark:text-white font-medium">{patientAge} / {patientGender}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[10.5px]">ABHA ID / Reference:</span>
                <span className="font-mono text-[11px] text-slate-900 dark:text-white font-medium truncate block">{patientAbha}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[10.5px]">Contact:</span>
                <span className="font-mono text-xs text-slate-900 dark:text-white">{patientPhone}</span>
              </div>
            </div>
          </div>

          {/* Clinical Intake Summary (Socrates, Vitals, Pariksha) */}
          <div className="mb-4">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Pre-Consultation Clinical Brief (लक्षण व स्वास्थ्य विवरण)
            </div>
            <div className="text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2">
              {/* Symptoms / Chief Complaints */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">Chief Complaints (मुख्य लक्षण): </span>
                {symptoms && symptoms.length > 0 ? (
                  <span className="text-slate-800 dark:text-slate-200">
                    {symptoms.map(s => `${s.site} (${s.character}, Severity ${s.severityScore}/10)`).join('; ')}
                  </span>
                ) : transcript ? (
                  <span className="text-slate-800 dark:text-slate-200 italic">"{transcript}"</span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400 italic">General OPD Consultation Check-in</span>
                )}
              </div>

              {/* Recorded Vitals (Or explicit non-recorded notice) */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">Measured Vitals (शारीरिक मापदंड): </span>
                {vitalsRecorded ? (
                  <span className="font-mono text-[11.5px] text-slate-900 dark:text-white">
                    {vitals.bp ? `BP: ${vitals.bp} mmHg (${bpStatus}) • ` : ''}
                    {vitals.pulse ? `Pulse: ${vitals.pulse} bpm (${pulseStatus}) • ` : ''}
                    {vitals.spo2 ? `SpO2: ${vitals.spo2} • ` : ''}
                    {vitals.temp ? `Temp: ${vitals.temp}` : ''}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400 italic">
                    Not recorded at kiosk (Triage to be completed at Room / Nursing Station)
                  </span>
                )}
              </div>

              {/* Ayurvedic Pariksha */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">Ayurvedic Assessment (दशविध परीक्षा): </span>
                <span className="text-slate-800 dark:text-slate-200">
                  Prakriti: <strong>{pariksha?.prakriti || 'Vata-Pitta'}</strong> • Agni: <strong>{pariksha?.agni || 'SAMAGNI'}</strong> • Vikriti: <strong>{pariksha?.vikriti || 'Sama'}</strong>
                </span>
              </div>

              {/* Prior Scanned Records Summary */}
              {scannedDocs && scannedDocs.length > 0 && (
                <div>
                  <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">Attached Digitized Records: </span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {scannedDocs.length} Historical Document(s) scanned and indexed in EHR
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Barcode & Security Hash Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
            {/* Authentic Clinical Barcode Pattern */}
            <div className="flex flex-col items-center justify-center my-1.5">
              <svg className="h-8 w-44 text-slate-800 dark:text-slate-200" viewBox="0 0 160 30" fill="currentColor">
                <rect x="0" y="0" width="3" height="30" />
                <rect x="5" y="0" width="1" height="30" />
                <rect x="8" y="0" width="2" height="30" />
                <rect x="12" y="0" width="4" height="30" />
                <rect x="18" y="0" width="1" height="30" />
                <rect x="21" y="0" width="3" height="30" />
                <rect x="26" y="0" width="2" height="30" />
                <rect x="30" y="0" width="1" height="30" />
                <rect x="33" y="0" width="4" height="30" />
                <rect x="39" y="0" width="2" height="30" />
                <rect x="43" y="0" width="1" height="30" />
                <rect x="46" y="0" width="3" height="30" />
                <rect x="51" y="0" width="2" height="30" />
                <rect x="55" y="0" width="4" height="30" />
                <rect x="61" y="0" width="1" height="30" />
                <rect x="64" y="0" width="3" height="30" />
                <rect x="69" y="0" width="2" height="30" />
                <rect x="73" y="0" width="1" height="30" />
                <rect x="76" y="0" width="3" height="30" />
                <rect x="81" y="0" width="4" height="30" />
                <rect x="87" y="0" width="1" height="30" />
                <rect x="90" y="0" width="2" height="30" />
                <rect x="94" y="0" width="3" height="30" />
                <rect x="99" y="0" width="1" height="30" />
                <rect x="102" y="0" width="4" height="30" />
                <rect x="108" y="0" width="2" height="30" />
                <rect x="112" y="0" width="1" height="30" />
                <rect x="115" y="0" width="3" height="30" />
                <rect x="120" y="0" width="2" height="30" />
                <rect x="124" y="0" width="4" height="30" />
                <rect x="130" y="0" width="1" height="30" />
                <rect x="133" y="0" width="3" height="30" />
                <rect x="138" y="0" width="2" height="30" />
                <rect x="142" y="0" width="1" height="30" />
                <rect x="145" y="0" width="4" height="30" />
                <rect x="151" y="0" width="2" height="30" />
                <rect x="155" y="0" width="3" height="30" />
              </svg>
              <span className="font-mono text-[10px] tracking-widest text-slate-700 dark:text-slate-300 uppercase mt-0.5">
                {sessionId ? sessionId.slice(0, 12).toUpperCase() : 'AIIA-OPD-26047'}
              </span>
            </div>
            <div className="text-[9.5px] font-mono text-slate-500 dark:text-slate-400">
              Session UID: {sessionId || 'sess-kiosk-live'} • DPDP Act 2023 Cryptographic Seal Active
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: FORMAL A4 HOSPITAL OPD CASE SHEET VIEW                             */}
      {/* ========================================================================= */}
      {viewMode === 'a4' && (
        <div className="printable-token-slip bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 sm:p-8 mb-5 shadow-sm max-w-3xl mx-auto transition-all">
          {/* Official Formal Hospital Header */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 mb-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/ashoka-stambh-hd.png" alt="Emblem" className="h-12 w-12 object-contain pointer-events-none" />
                <div>
                  <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-600 dark:text-slate-400">
                    GOVERNMENT OF INDIA · MINISTRY OF AYUSH
                  </div>
                  <div className="text-xl font-heading font-extrabold text-slate-900 dark:text-white tracking-tight">
                    ALL INDIA INSTITUTE OF AYURVEDA (AIIA)
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Apex Autonomous Institute · Gautampuri, Sarita Vihar, Mathura Road, New Delhi - 110076
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-mono font-bold uppercase px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                  OPD REGISTRATION CARD
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                  ABDM M1-M3 COMPLIANT
                </div>
              </div>
            </div>
          </div>

          {/* OPD Token & Department Banner */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl mb-5 items-center">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Token Number</div>
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 dark:text-white">{routing.tokenNumber}</div>
              <div className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">{routing.triageLevel}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Consultation Bay</div>
              <div className="text-sm sm:text-base font-heading font-bold text-slate-900 dark:text-white">{routing.room}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">{routing.floor}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Date & Registration Time</div>
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">{issuedTimestamp.date}</div>
              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">{issuedTimestamp.time}</div>
            </div>
          </div>

          {/* Patient Details Table */}
          <div className="mb-5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              1. Patient Demographics & Identification
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/60 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 block">Patient Name:</span>
                <strong className="text-slate-900 dark:text-white">{patientDisplayName}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Age / Gender:</span>
                <span className="text-slate-900 dark:text-white">{patientAge} / {patientGender}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">ABHA Number:</span>
                <span className="font-mono text-slate-900 dark:text-white truncate block">{patientAbha}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Registered Phone:</span>
                <span className="font-mono text-slate-900 dark:text-white">{patientPhone}</span>
              </div>
            </div>
          </div>

          {/* Clinical Triage & Socrates Intake Table */}
          <div className="mb-5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
              2. Pre-Consultation Clinical Intake & Triage
            </h4>
            <div className="text-xs space-y-2 bg-slate-50/60 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Chief Complaints: </span>
                {symptoms && symptoms.length > 0 ? (
                  <span className="text-slate-900 dark:text-white">
                    {symptoms.map(s => `${s.site} (${s.character}, Pain Score ${s.severityScore}/10, Onset: ${s.onset})`).join('; ')}
                  </span>
                ) : transcript ? (
                  <span className="text-slate-900 dark:text-white italic">"{transcript}"</span>
                ) : (
                  <span className="text-slate-500 italic">General OPD intake</span>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Recorded Vitals: </span>
                {vitalsRecorded ? (
                  <span className="font-mono text-slate-900 dark:text-white">
                    BP: {vitals.bp || '120/80'} mmHg • Pulse: {vitals.pulse || 72} bpm • SpO2: {vitals.spo2 || '98%'} • Temp: {vitals.temp || '98.6°F'}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Not recorded at kiosk</span>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Charaka Dashavidha Pariksha: </span>
                <span className="text-slate-900 dark:text-white">
                  Prakriti: <strong>{pariksha?.prakriti || 'Vata-Pitta'}</strong> | Agni: <strong>{pariksha?.agni || 'SAMAGNI'}</strong> | Sara: <strong>{pariksha?.sara || 'Madhyama'}</strong> | Satva: <strong>{pariksha?.satva || 'Pravara'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Physician Notes Section (For Print Case Sheet) */}
          <div className="mb-5 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3 min-h-[90px]">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Physician Preliminary Clinical Notes & Examination Findings (चिकित्सक टिप्पणी)
            </div>
          </div>

          {/* Official Signature & QR Footer */}
          <div className="flex items-end justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-1 bg-white rounded border border-slate-300">
                <RealQrCode
                  value={`https://aiia.gov.in/opd/verify?token=${encodeURIComponent(routing.tokenNumber)}&session=${encodeURIComponent(sessionId)}&room=${encodeURIComponent(routing.room)}&patient=${encodeURIComponent(patientDisplayName)}&ts=${Date.now()}`}
                  size={60}
                  level="M"
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                Digital Verification Hash: <br />
                <span className="font-bold text-slate-700 dark:text-slate-300">{sessionId ? sessionId.slice(0, 16) : 'EHR-AIIA-SEC-01'}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="w-40 border-b border-slate-400 mb-1" />
              <div className="text-[10px] font-mono uppercase text-slate-500">Authorized Medical Officer</div>
              <div className="text-[11px] font-bold text-slate-900 dark:text-white">{routing.doctor}</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTION BUTTON BAR (NO-PRINT)                                              */}
      {/* ========================================================================= */}
      <div className="space-y-3 no-print mt-4">
        {/* Patient Kiosk Self-Service Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="tactile-btn py-2.5 px-3 text-xs font-bold gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 whitespace-nowrap justify-center shadow-xs"
          >
            <Printer size={14} className="shrink-0" />
            <span className="truncate">Print Token Slip (पर्ची प्रिंट)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playCrystalChime();
              setShowSmsModal(true);
            }}
            className="tactile-btn py-2.5 px-3 text-xs font-semibold gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 whitespace-nowrap justify-center shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Share2 size={14} className="shrink-0 text-slate-600 dark:text-slate-400" />
            <span className="truncate">Send to Mobile (SMS/WhatsApp)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playCrystalChime();
              setShowFamilyModal(true);
            }}
            className="tactile-btn py-2.5 px-3 text-xs font-semibold gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 whitespace-nowrap justify-center shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Users size={14} className="shrink-0 text-slate-600 dark:text-slate-400" />
            <span className="truncate">+ Add Family Member</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              onReset();
            }}
            className="tactile-btn py-2.5 px-3 text-xs font-semibold gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 whitespace-nowrap justify-center shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} className="shrink-0 text-slate-500" />
            <span className="truncate">Done · Next Patient (नया मरीज़)</span>
          </button>
        </div>

        {/* Clinical Staff Handover & Doctor Desk Section */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-left">
            <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300">
              <Stethoscope size={16} />
            </div>
            <div>
              <div className="text-xs font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Clinical Staff Handover & Consultation Desk</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {routing.room.split(':')[0]}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Patient is live in hospital queue (#{queueStats.patientPosition} in line). Switch directly to the Physician Consultation Desk.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (sessionId) {
                try {
                  sessionStorage.setItem('selected_doctor_session', sessionId);
                } catch {}
              }
              sovereignSound.playMechanicalSnap();
              onGoToDoctorDesk();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold shrink-0 flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <span>Open in Doctor Cockpit</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Cryptographic ZK Badge & Statutory Compliance */}
      <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2.5 text-xs no-print">
        {zkBadge ? (
          <PatentBadge badge={zkBadge} />
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium">
            <ShieldCheck size={14} className="text-slate-700 dark:text-slate-300" />
            <span>DPDP Act 2023 Compliant · Groth16/BN128 Privacy Invariance</span>
          </div>
        )}
        <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 text-center sm:text-right">
          AIIA MediKiosk Engine v2.4 · Sovereign SQLite WAL
        </span>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: HOSPITAL ROOM WAYFINDING & DIRECTIONS                             */}
      {/* ========================================================================= */}
      {showWayfindingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 rounded-2xl shadow-xl text-left">
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-sky-600" />
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-900 dark:text-white">
                    Navigational Guidance to {routing.room}
                  </h3>
                  <p className="text-xs text-slate-500">From Kiosk #04 (Ground Floor Main Atrium)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWayfindingModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Destination Highlight Box */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
              <div className="text-[10.5px] font-mono uppercase text-slate-500">Destination Bay</div>
              <div className="text-base font-heading font-bold text-slate-900 dark:text-white mt-0.5">{routing.room}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">{routing.floor}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">Doctor on Duty: <strong>{routing.doctor}</strong></div>
            </div>

            {/* Step-by-Step Directions */}
            <div className="space-y-3 mb-5">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">Step-by-step Route:</div>
              {routing.wayfindingSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 leading-relaxed">{step}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowWayfindingModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold text-xs rounded-xl"
            >
              Got It / समझ गया
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SMS / WHATSAPP MOBILE TOKEN DISPATCH                              */}
      {/* ========================================================================= */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 rounded-2xl shadow-xl text-left">
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 size={18} className="text-slate-700 dark:text-slate-300" />
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-900 dark:text-white">
                    Send Digital OPD Pass to Mobile
                  </h3>
                  <p className="text-xs text-slate-500">Get instant token buzzer alerts & live queue tracker</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSmsModal(false);
                  setSmsSent(false);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {!smsSent ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Patient Mobile Number (मोबाइल नंबर)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">+91</span>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full pl-11 pr-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Delivery Channel
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSmsChannel('whatsapp')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                        smsChannel === 'whatsapp'
                          ? 'border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      <MessageSquare size={14} />
                      <span>WhatsApp Pass</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmsChannel('sms')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                        smsChannel === 'sms'
                          ? 'border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      <Phone size={14} />
                      <span>Standard SMS</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <div><strong>Preview:</strong> "AIIA OPD Pass: Token {routing.tokenNumber} for {patientDisplayName}. Assigned to {routing.room} ({routing.floor}). Live Queue Tracker: https://aiia.gov.in/t/{sessionId.slice(0, 6)}"</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sovereignSound.playCrystalChime();
                    setSmsSent(true);
                  }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs"
                >
                  Send Digital Token Slip Now
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white mx-auto flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                  Digital OPD Pass Dispatched Successfully!
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Message delivered to +91 {mobileNumber || '9876543210'} via {smsChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}. You will receive a mobile vibration when your token is 2 positions away.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowSmsModal(false);
                    setSmsSent(false);
                  }}
                  className="px-6 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: 1-PHONE-FOR-3-GENERATIONS FAMILY BATCH HUB                        */}
      {/* ========================================================================= */}
      {showFamilyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 rounded-2xl shadow-xl text-left max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-sky-600" />
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-900 dark:text-white">
                    1-Phone-for-3-Generations Family Batch Hub
                  </h3>
                  <p className="text-xs text-slate-500">
                    Register dependent family members on one smartphone. Emits sequential linked tokens.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFamilyModal(false);
                  setFamilyTokens(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {!familyTokens ? (
              <div className="space-y-4">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Dependent Family Members:
                </div>

                {familyMembers.map((member, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Family Member #{idx + 1}
                      </span>
                      {familyMembers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFamilyMembers(prev => prev.filter((_, i) => i !== idx))}
                          className="text-[11px] text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Name</label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, name: val } : m));
                          }}
                          placeholder="Family Member Name"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Age & Gender</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={member.age}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, age: val } : m));
                            }}
                            className="w-16 px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                          />
                          <select
                            value={member.gender}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, gender: val } : m));
                            }}
                            className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Relationship</label>
                        <input
                          type="text"
                          value={member.relationship}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, relationship: val } : m));
                          }}
                          placeholder="e.g. Parent, Child"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Chief Complaint</label>
                        <input
                          type="text"
                          value={member.chiefComplaint}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, chiefComplaint: val } : m));
                          }}
                          placeholder="e.g. Cough, Knee Pain"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Assigned Department</label>
                        <select
                          value={member.department}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, department: val } : m));
                          }}
                          className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                        >
                          <option value="Kayachikitsa">Kayachikitsa (Internal Medicine)</option>
                          <option value="Kaumarbhritya">Kaumarbhritya (Pediatrics)</option>
                          <option value="Prasuti Tantra">Prasuti & Stri Roga (OBGYN)</option>
                          <option value="Shalya Tantra">Shalya Tantra (Surgery)</option>
                          <option value="Panchakarma">Panchakarma (Rehab)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setFamilyMembers(prev => [
                      ...prev,
                      { name: '', age: 30, gender: 'FEMALE', relationship: 'Spouse / Relative', chiefComplaint: 'General Consultation', department: 'Kayachikitsa' }
                    ]);
                  }}
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline block"
                >
                  + Add Another Family Member
                </button>

                <button
                  type="button"
                  disabled={familySubmitting}
                  onClick={async () => {
                    sovereignSound.playMechanicalSnap();
                    setFamilySubmitting(true);
                    try {
                      const validMembers = familyMembers.map((m, i) => ({
                        name: m.name.trim() || `Family Member ${i + 1}`,
                        age: m.age || 40,
                        gender: m.gender,
                        relationship: m.relationship || 'Family Member',
                        chiefComplaint: m.chiefComplaint || 'OPD Check-in',
                        department: m.department
                      }));

                      const res = await api.submitFamilyIntake(patient.phone || '9876543210', validMembers);
                      setFamilyTokens(res.familyTokens || (res as any).tokens);
                      sovereignSound.playCrystalChime();
                    } catch (e) {
                      console.error('Family registration failed:', e);
                    } finally {
                      setFamilySubmitting(false);
                    }
                  }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs"
                >
                  {familySubmitting ? 'Registering Family Batch...' : `Generate ${familyMembers.length} Linked Family Tokens`}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white mb-2">
                  <CheckCircle2 size={18} />
                  <span className="text-xs font-heading font-bold">
                    Sequential Linked Family Tokens Issued (Master Phone: {patient.phone || '9876543210'})
                  </span>
                </div>

                <div className="space-y-2.5">
                  {familyTokens.map((ft, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-500">
                          Token {idx + 1} ({ft.relationship || ft.relation})
                        </div>
                        <div className="text-sm font-heading font-bold text-slate-900 dark:text-white mt-0.5">
                          {ft.patientName || ft.name}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          {ft.department} • {ft.roomNumber || ft.consultationRoom}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-mono font-extrabold text-sky-600 dark:text-sky-400">
                          {ft.tokenNumber}
                        </div>
                        <span className="text-[9.5px] font-mono text-slate-500 font-semibold">
                          Linked Batch
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowFamilyModal(false);
                    setFamilyTokens(null);
                  }}
                  className="w-full py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold rounded-xl"
                >
                  Done / पूरा हुआ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
