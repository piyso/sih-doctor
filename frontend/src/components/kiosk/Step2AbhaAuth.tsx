import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, User, ArrowLeft, ArrowRight, Sparkles, CreditCard, Lock, Smartphone, Check, Volume2 } from 'lucide-react';
import { VerhoeffD5 } from '../../utils/verhoeff';
import { sovereignSound } from '../../utils/audio';

interface Step2AbhaAuthProps {
  patient: {
    name: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phone?: string;
    aadhaar?: string;
    abhaId?: string;
    isPregnant?: boolean;
    isLactating?: boolean;
    weightKg?: number;
  };
  setPatient: React.Dispatch<React.SetStateAction<any>>;
  onNext: () => void;
  onBack: () => void;
}

export const Step2AbhaAuth: React.FC<Step2AbhaAuthProps> = ({
  patient,
  setPatient,
  onNext,
  onBack
}) => {
  const [authMethod, setAuthMethod] = useState<'abha' | 'aadhaar' | 'guest'>('abha');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('4829');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [verified, setVerified] = useState(false);

  const cleanAadhaar = (patient.aadhaar || '').replace(/\D/g, '');
  const aadhaarDigitCount = Math.min(cleanAadhaar.length, 12);
  const aadhaarRadius = 14;
  const aadhaarCircumference = 2 * Math.PI * aadhaarRadius;
  const aadhaarDashoffset = aadhaarCircumference - (aadhaarDigitCount / 12) * aadhaarCircumference;
  const isAadhaarComplete = aadhaarDigitCount === 12;
  const isAadhaarValid = patient.aadhaar ? VerhoeffD5.validate(patient.aadhaar) : false;
  const aadhaarRingColor = !isAadhaarComplete ? '#06b6d4' : (isAadhaarValid ? '#10b981' : '#f43f5e');
  const isAbhaValid = patient.abhaId ? patient.abhaId.length >= 14 : false;

  const handleSendOtp = () => {
    sovereignSound.playMechanicalSnap();
    setOtpSent(true);
  };

  const handleVerifyOtp = () => {
    setIsVerifyingOtp(true);
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setVerified(true);
      sovereignSound.playCrystalChime();
    }, 450);
  };

  const handleQuickSelectPreset = (name: string, age: number, gender: any, abha: string, aadhaar: string, isPregnant = false, weightKg = 58) => {
    sovereignSound.playCrystalChime();
    setPatient({
      ...patient,
      name,
      age,
      gender,
      abhaId: abha,
      aadhaar,
      isPregnant,
      weightKg
    });
    setVerified(true);
  };

  return (
    <div className="max-w-4xl mx-auto py-3 px-1 sm:px-4">
      {/* Title Header */}
      <div className="text-center mb-5 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight mb-1">
          रोगी पहचान (Patient Verification)
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3">
          Enter ABHA ID, Mobile number, or select a demo profile below
        </p>

        {/* Audio Guidance Accessibility */}
        <button
          type="button"
          onClick={() => {
            sovereignSound.playMechanicalSnap();
            sovereignSound.speakGuidance('कृपया अपना आभा आईडी, आधार नंबर या नाम और उम्र दर्ज करें। यदि आप गर्भवती हैं या स्तनपान करा रही हैं, तो मातृत्व सुरक्षा विकल्प अवश्य चुनें।');
          }}
          className="tactile-btn text-xs font-semibold px-3 py-1 rounded-full gap-1.5 text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/10 cursor-pointer"
        >
          <Volume2 size={13} />
          <span>निर्देश सुनें / Audio Guidance</span>
        </button>
      </div>

      {/* Preset Fast-Triage Selector */}
      <div className="physical-card p-4 sm:p-5 rounded-2xl mb-4">
        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
          <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} />
            Quick Evaluator Profiles
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleQuickSelectPreset('Smt. Shanti Devi', 58, 'FEMALE', '14-8921-0428-9102', '543298761234', false, 62)}
            className="p-3 rounded-xl text-left border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 transition-all cursor-pointer group"
          >
            <div className="text-xs sm:text-sm font-bold text-foreground">Smt. Shanti Devi (58 F)</div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">Critical Cardiac Emergency (Chest Pain)</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickSelectPreset('Shri Rajesh Sharma', 46, 'MALE', '91-2384-5912-7014', '789123456012', false, 74)}
            className="p-3 rounded-xl text-left border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all cursor-pointer group"
          >
            <div className="text-xs sm:text-sm font-bold text-foreground">Shri Rajesh Sharma (46 M)</div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Metabolic &amp; Sandhivata (Joint Pain)</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickSelectPreset('Priya Verma', 28, 'FEMALE', '32-9014-7281-5541', '901234567890', true, 58)}
            className="p-3 rounded-xl text-left border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all cursor-pointer group"
          >
            <div className="text-xs sm:text-sm font-bold text-foreground">Priya Verma (28 F)</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Prasuti Tantra (Antenatal Regimen)</div>
          </button>
        </div>
      </div>

      {/* Main Verification Card */}
      <div className="physical-card p-5 sm:p-6 rounded-2xl mb-5">
        {/* Method Selector Tabs */}
        <div className="flex gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60 mb-5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setAuthMethod('abha');
            }}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
              authMethod === 'abha'
                ? 'bg-background text-foreground shadow-xs font-bold border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard size={14} className={authMethod === 'abha' ? 'text-sky-500' : 'text-muted-foreground'} />
            <span>ABHA 2.0 ID</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setAuthMethod('aadhaar');
            }}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
              authMethod === 'aadhaar'
                ? 'bg-background text-foreground shadow-xs font-bold border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck size={14} className={authMethod === 'aadhaar' ? 'text-sky-500' : 'text-muted-foreground'} />
            <span>Aadhaar Verhoeff D5</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sovereignSound.playMechanicalSnap();
              setAuthMethod('guest');
            }}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
              authMethod === 'guest'
                ? 'bg-background text-foreground shadow-xs font-bold border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User size={14} className={authMethod === 'guest' ? 'text-emerald-500' : 'text-muted-foreground'} />
            <span>Emergency Fast-Intake</span>
          </button>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Patient Full Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              रोगी का पूरा नाम / Full Legal Name *
            </label>
            <input
              type="text"
              value={patient.name}
              onChange={(e) => setPatient({ ...patient, name: e.target.value })}
              placeholder="e.g. Smt. Shanti Devi"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          {/* ABHA or Aadhaar Input */}
          {authMethod === 'abha' && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-foreground/80">
                  ABHA 2.0 ID (14 Digits) *
                </label>
                {isAbhaValid && (
                  <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> FORMAT VALID
                  </span>
                )}
              </div>
              <input
                type="text"
                value={patient.abhaId || ''}
                onChange={(e) => {
                  setPatient({ ...patient, abhaId: e.target.value });
                  if (e.target.value.length >= 14) sovereignSound.playDialNotch();
                }}
                placeholder="14-8921-0428-9102"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-mono tracking-wider outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          )}

          {authMethod === 'aadhaar' && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-foreground/80">
                  Aadhaar (12 Digits) · Verhoeff D5 Check
                </label>
                {patient.aadhaar && (
                  <span className={`text-[10.5px] font-mono font-bold flex items-center gap-1 ${
                    isAadhaarValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {isAadhaarValid ? 'D5 VALID (0 ERRORS)' : isAadhaarComplete ? 'D5 CHECKSUM FAILED' : `${aadhaarDigitCount}/12 DIGITS`}
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={patient.aadhaar || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPatient({ ...patient, aadhaar: val });
                    const digits = val.replace(/\D/g, '');
                    if (digits.length === 12) {
                      if (VerhoeffD5.validate(digits)) {
                        sovereignSound.playCrystalChime();
                      } else {
                        sovereignSound.playClinicalAlert();
                      }
                    } else if (digits.length > 0) {
                      sovereignSound.playDialNotch();
                    }
                  }}
                  placeholder="5432 9876 1234"
                  className="w-full px-3.5 pr-10 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-mono tracking-wider outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                />
                <div className="absolute right-3 flex items-center justify-center pointer-events-none">
                  <svg width="24" height="24" viewBox="0 0 36 36" className="-rotate-90">
                    <circle cx="18" cy="18" r={aadhaarRadius} stroke="currentColor" strokeWidth="2.5" fill="none" className="text-border" />
                    <circle
                      cx="18"
                      cy="18"
                      r={aadhaarRadius}
                      stroke={aadhaarRingColor}
                      strokeWidth="2.5"
                      strokeDasharray={aadhaarCircumference}
                      strokeDashoffset={aadhaarDashoffset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-300"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Age & Gender */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                आयु / Age *
              </label>
              <input
                type="number"
                value={patient.age}
                onChange={(e) => setPatient({ ...patient, age: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-mono"
              />
            </div>

            <div className="flex-1.4">
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                लिंग / Gender *
              </label>
              <select
                value={patient.gender}
                onChange={(e) => setPatient({ ...patient, gender: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 cursor-pointer"
              >
                <option value="MALE">पुरुष / Male</option>
                <option value="FEMALE">महिला / Female</option>
                <option value="OTHER">अन्य / Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Maternal-Fetal Pharmacology Guard */}
        {patient.gender === 'FEMALE' && (
          <div className="mt-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-rose-600 dark:text-rose-400" />
                <span className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300">
                  मातृत्व एवं गर्भ सुरक्षा / Maternal-Fetal Pharmacology Guard
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                Gates Classical Emmenagogues &amp; Teratogens
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pregnancy Toggle */}
              <div className="bg-background/80 p-3 rounded-xl border border-border/80">
                <label className="block text-xs font-semibold text-foreground/80 mb-2">
                  क्या आप गर्भवती हैं? / Pregnant?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sovereignSound.playMechanicalSnap();
                      setPatient({ ...patient, isPregnant: true });
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all border ${
                      patient.isPregnant
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/40 text-foreground border-border/70 hover:bg-muted'
                    }`}
                  >
                    हाँ / Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sovereignSound.playMechanicalSnap();
                      setPatient({ ...patient, isPregnant: false, gestationalWeeks: undefined });
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all border ${
                      !patient.isPregnant
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/40 text-foreground border-border/70 hover:bg-muted'
                    }`}
                  >
                    नहीं / No
                  </button>
                </div>
              </div>

              {/* Lactation Toggle */}
              <div className="bg-background/80 p-3 rounded-xl border border-border/80">
                <label className="block text-xs font-semibold text-foreground/80 mb-2">
                  स्तनपान करा रही हैं? / Breastfeeding?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sovereignSound.playMechanicalSnap();
                      setPatient({ ...patient, isLactating: true });
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all border ${
                      patient.isLactating
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/40 text-foreground border-border/70 hover:bg-muted'
                    }`}
                  >
                    हाँ / Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sovereignSound.playMechanicalSnap();
                      setPatient({ ...patient, isLactating: false });
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all border ${
                      !patient.isLactating
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/40 text-foreground border-border/70 hover:bg-muted'
                    }`}
                  >
                    नहीं / No
                  </button>
                </div>
              </div>
            </div>

            {patient.isPregnant && (
              <div className="flex items-center gap-2 bg-muted/80 p-2.5 rounded-xl border border-border/80 text-foreground text-xs font-semibold">
                <ShieldCheck size={14} className="text-primary shrink-0" />
                <span>गर्भावस्था सुरक्षा सक्रिय: राजा प्रवर्तनी वटी, कासीसादी, एवं एलोपैथिक टेराटोजेन्स (ACEI/ARBs/Statins) स्वतः ब्लॉक होंगे।</span>
              </div>
            )}
          </div>
        )}

        {/* OTP Simulation Trigger */}
        {authMethod !== 'guest' && !verified && (
          <div className="mt-4 p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500 shrink-0">
                <Smartphone size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">Aadhaar/ABHA OTP Challenge</div>
                <div className="text-[11px] text-muted-foreground">Sends cryptographic OTP to linked mobile device</div>
              </div>
            </div>

            {!otpSent ? (
              <button
                type="button"
                onClick={handleSendOtp}
                className="btn btn-secondary text-xs px-3.5 py-1.5 rounded-lg"
              >
                Send Verification OTP
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  className="w-20 px-2.5 py-1.5 text-center font-mono font-bold text-sm bg-background border-2 border-sky-500 rounded-lg text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="btn btn-primary text-xs px-3.5 py-1.5 rounded-lg"
                >
                  {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            )}
          </div>
        )}

        {verified && (
          <div className="mt-4 p-3.5 rounded-xl bg-card border border-border/80 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-primary shrink-0" />
            <div>
              <div className="text-xs font-mono font-bold text-foreground">
                ABDM SOVEREIGN RECORD VERIFIED &amp; AIR-GAPPED
              </div>
              <div className="text-[11px] text-muted-foreground">
                Local Verhoeff cryptographic token created with zero foreign cloud data transmission.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
