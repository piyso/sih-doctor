import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, User, CreditCard, Smartphone, Volume2, Sparkles, Leaf, Pill, HelpCircle } from 'lucide-react';
import { VerhoeffD5 } from '../../utils/verhoeff';
import { sovereignSound } from '../../utils/audio';
import { BCP47, kioskText, normalizeLang } from '../../utils/kioskLocalization';
import { CareStream } from '../../types/api';
import { RegisterNav, useStepNav } from './kioskNav';
import { KioskConsent } from '../../services/api';
import { useDemoMode } from '../../services/runtimeMode';
import { ConsentCard } from './ConsentCard';

export interface KioskPatient {
  name: string;
  age?: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone?: string;
  aadhaar?: string;
  abhaId?: string;
  isPregnant?: boolean;
  isLactating?: boolean;
  weightKg?: number;
  careStream: CareStream;
}

interface Step2AbhaAuthProps {
  patient: KioskPatient;
  setPatient: React.Dispatch<React.SetStateAction<KioskPatient>>;
  language?: string;
  registerNav?: RegisterNav;
  consent: KioskConsent;
  setConsent: (c: KioskConsent) => void;
}

const DEMO_OTP = '4829';
const digits = (v?: string) => (v || '').replace(/\D/g, '');

/** Fixed-height slot under a field so error messages never push the layout around. */
const FieldError: React.FC<{ message?: string | null }> = ({ message }) => (
  <p className={`min-h-[18px] mt-1 text-xs font-semibold ${message ? 'text-rose-600 dark:text-rose-400' : 'text-transparent'}`} role={message ? 'alert' : undefined}>
    {message || '·'}
  </p>
);

export const Step2AbhaAuth: React.FC<Step2AbhaAuthProps> = ({ patient, setPatient, language = 'hi', registerNav, consent, setConsent }) => {
  const tx = kioskText(language);
  // Sample patients and the demo OTP exist only on demo servers; real ABHA/Aadhaar OTP needs ABDM.
  const demoMode = useDemoMode();
  const [authMethod, setAuthMethod] = useState<'abha' | 'aadhaar' | 'walkin'>(patient.aadhaar ? 'aadhaar' : patient.abhaId ? 'abha' : 'walkin');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [verified, setVerified] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const update = (patch: Partial<KioskPatient>) => setPatient(prev => ({ ...prev, ...patch }));

  // ---------------------------------------------------------------- validation
  const aadhaarDigits = digits(patient.aadhaar);
  const abhaDigits = digits(patient.abhaId);
  const phoneDigits = digits(patient.phone);
  const errors = {
    name: patient.name.trim().length < 2 ? tx('errName') : null,
    age: patient.age === undefined || Number.isNaN(Number(patient.age)) || Number(patient.age) < 0 || Number(patient.age) > 120 ? tx('errAge') : null,
    abha: authMethod === 'abha' && abhaDigits.length > 0 && abhaDigits.length !== 14 ? tx('errAbha') : null,
    aadhaar: authMethod === 'aadhaar' && aadhaarDigits.length > 0 && (aadhaarDigits.length !== 12 || !VerhoeffD5.validate(aadhaarDigits)) ? tx('errAadhaar') : null,
    phone: phoneDigits.length > 0 && phoneDigits.length !== 10 ? tx('errPhone') : null
  };
  const isValid = Object.values(errors).every(e => !e) && consent.purposes.care;
  const visibleError = (field: keyof typeof errors) => (showErrors || touched[field] ? errors[field] : null);

  // Without a phone number there is nowhere to send SMS, so drop that consent.
  React.useEffect(() => {
    if (phoneDigits.length !== 10 && consent.purposes.sms) setConsent({ ...consent, purposes: { ...consent.purposes, sms: false } });
  }, [phoneDigits.length, consent, setConsent]);

  useStepNav(registerNav, {
    canNext: isValid,
    blockedHint: Object.values(errors).every(e => !e) ? tx('consentNeeded') : tx('s2FixErrors'),
    onBlockedNext: () => setShowErrors(true)
  });

  const handleQuickSelectPreset = (preset: Partial<KioskPatient>) => {
    sovereignSound.playCrystalChime();
    setPatient(prev => ({ ...prev, isPregnant: false, isLactating: false, ...preset }));
    setAuthMethod('abha');
    setVerified(true);
  };

  const handleVerifyOtp = () => {
    setIsVerifyingOtp(true);
    setTimeout(() => {
      setIsVerifyingOtp(false);
      if (otpValue.trim() === DEMO_OTP) {
        setVerified(true);
        setOtpError(false);
        sovereignSound.playCrystalChime();
      } else {
        setOtpError(true);
        sovereignSound.playClinicalAlert();
      }
    }, 400);
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3.5 py-2.5 rounded-xl bg-background border text-foreground text-sm outline-none focus:ring-2 ${
      hasError ? 'border-rose-500 focus:ring-rose-500/30' : 'border-border focus:ring-sky-500/30 focus:border-sky-500'
    }`;

  const streams: Array<{ id: CareStream; title: string; sub: string; icon: React.ComponentType<{ size?: number; className?: string }>; tone: string }> = [
    { id: 'AYURVEDA', title: tx('streamAyurveda'), sub: tx('streamAyurvedaSub'), icon: Leaf, tone: 'emerald' },
    { id: 'ALLOPATHY', title: tx('streamAllopathy'), sub: tx('streamAllopathySub'), icon: Pill, tone: 'sky' },
    { id: 'UNDECIDED', title: tx('streamUnsure'), sub: tx('streamUnsureSub'), icon: HelpCircle, tone: 'slate' }
  ];

  return (
    <div className="max-w-4xl mx-auto py-3 px-1 sm:px-4">
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight mb-1">{tx('s2Title')}</h2>
        <p className="text-sm text-muted-foreground mb-3">{tx('s2Sub')}</p>
        <button
          type="button"
          onClick={() => { sovereignSound.playMechanicalSnap(); sovereignSound.speakGuidance(tx('s2Audio'), BCP47[normalizeLang(language)]); }}
          className="tactile-btn text-xs font-semibold px-3 py-1 rounded-full gap-1.5 text-sky-700 dark:text-sky-300 border-sky-500/30 bg-sky-500/10"
        >
          <Volume2 size={13} />
          <span>{tx('listenBtn')}</span>
        </button>
      </div>

      {/* Demo profiles for testing the prototype (demo servers only) */}
      {demoMode && <div className="physical-card p-4 rounded-2xl mb-4">
        <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
          <Sparkles size={13} />
          {tx('s2Demo')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { name: 'Shanti Devi', age: 58, gender: 'FEMALE' as const, abhaId: '14-8921-0428-9102', careStream: 'ALLOPATHY' as CareStream, weightKg: 62 },
            { name: 'Rajesh Sharma', age: 46, gender: 'MALE' as const, abhaId: '91-2384-5912-7014', careStream: 'AYURVEDA' as CareStream, weightKg: 74 },
            { name: 'Priya Verma', age: 28, gender: 'FEMALE' as const, abhaId: '32-9014-7281-5541', careStream: 'AYURVEDA' as CareStream, isPregnant: true, weightKg: 58 }
          ].map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => handleQuickSelectPreset({ ...p, aadhaar: '' })}
              className="p-3 rounded-xl text-left border border-border/80 bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <div className="text-sm font-bold text-foreground">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.age} · {p.gender === 'FEMALE' ? tx('s2Female') : tx('s2Male')} · {p.careStream === 'AYURVEDA' ? tx('streamAyurveda') : tx('streamAllopathy')}</div>
            </button>
          ))}
        </div>
      </div>}

      <div className="physical-card p-5 sm:p-6 rounded-2xl mb-5">
        {/* ID method */}
        <div className="flex gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60 mb-5 flex-wrap" role="tablist">
          {([
            { id: 'abha', label: tx('s2TabAbha'), icon: CreditCard },
            { id: 'aadhaar', label: tx('s2TabAadhaar'), icon: ShieldCheck },
            { id: 'walkin', label: tx('s2TabWalkin'), icon: User }
          ] as const).map(tab => {
            const Icon = tab.icon;
            const active = authMethod === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { sovereignSound.playMechanicalSnap(); setAuthMethod(tab.id); setOtpSent(false); setVerified(false); }}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                  active ? 'bg-background text-foreground shadow-xs border border-border/80' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <label className="block text-sm font-semibold text-foreground/90 mb-1.5" htmlFor="kiosk-name">{tx('s2Name')} *</label>
            <input
              id="kiosk-name"
              type="text"
              autoComplete="off"
              value={patient.name}
              onChange={e => update({ name: e.target.value })}
              onBlur={() => setTouched(t => ({ ...t, name: true }))}
              placeholder={tx('s2NamePh')}
              className={inputClass(!!visibleError('name'))}
            />
            <FieldError message={visibleError('name')} />
          </div>

          {authMethod === 'abha' && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-foreground/90" htmlFor="kiosk-abha">{tx('s2Abha')}</label>
                <span className={`text-xs font-mono font-bold ${abhaDigits.length === 14 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {abhaDigits.length === 14 ? `✓ ${tx('s2Valid')}` : tx('s2DigitsCount', { n: abhaDigits.length, total: 14 })}
                </span>
              </div>
              <input
                id="kiosk-abha"
                inputMode="numeric"
                value={patient.abhaId || ''}
                onChange={e => update({ abhaId: e.target.value.replace(/[^\d-\s]/g, '').slice(0, 17) })}
                onBlur={() => setTouched(t => ({ ...t, abha: true }))}
                placeholder="14-8921-0428-9102"
                className={`${inputClass(!!visibleError('abha'))} font-mono tracking-wider`}
              />
              <FieldError message={visibleError('abha')} />
            </div>
          )}

          {authMethod === 'aadhaar' && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-foreground/90" htmlFor="kiosk-aadhaar">{tx('s2Aadhaar')}</label>
                <span className={`text-xs font-mono font-bold ${aadhaarDigits.length === 12 && !errors.aadhaar ? 'text-emerald-600' : aadhaarDigits.length === 12 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                  {aadhaarDigits.length === 12 && !errors.aadhaar ? `✓ ${tx('s2Valid')}` : tx('s2DigitsCount', { n: aadhaarDigits.length, total: 12 })}
                </span>
              </div>
              <input
                id="kiosk-aadhaar"
                inputMode="numeric"
                value={patient.aadhaar || ''}
                onChange={e => {
                  const val = e.target.value.replace(/[^\d\s]/g, '').slice(0, 14);
                  update({ aadhaar: val });
                  const d = digits(val);
                  if (d.length === 12) {
                    if (VerhoeffD5.validate(d)) sovereignSound.playCrystalChime();
                    else sovereignSound.playClinicalAlert();
                  }
                }}
                onBlur={() => setTouched(t => ({ ...t, aadhaar: true }))}
                placeholder="5432 9876 1234"
                className={`${inputClass(!!(visibleError('aadhaar') || (aadhaarDigits.length === 12 && errors.aadhaar)))} font-mono tracking-wider`}
              />
              <FieldError message={visibleError('aadhaar') || (aadhaarDigits.length === 12 ? errors.aadhaar : null)} />
            </div>
          )}

          {(
            <div>
              <label className="block text-sm font-semibold text-foreground/90 mb-1.5" htmlFor="kiosk-phone">
                {tx('s2Phone')} <span className="font-normal text-muted-foreground">({tx('optional')})</span>
              </label>
              <input
                id="kiosk-phone"
                inputMode="tel"
                value={patient.phone || ''}
                onChange={e => update({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                onBlur={() => setTouched(t => ({ ...t, phone: true }))}
                placeholder="98765 43210"
                className={`${inputClass(!!visibleError('phone'))} font-mono`}
              />
              <FieldError message={visibleError('phone')} />
            </div>
          )}

          <div>
          <div className="flex gap-3">
            <div className="w-36 shrink-0">
              <label className="block text-sm font-semibold text-foreground/90 mb-1.5" htmlFor="kiosk-age">{tx('s2Age')} *</label>
              <input
                id="kiosk-age"
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                value={patient.age ?? ''}
                onChange={e => update({ age: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                onBlur={() => setTouched(t => ({ ...t, age: true }))}
                className={`${inputClass(!!visibleError('age'))} font-mono`}
              />
            </div>
            <div className="flex-1">
              <span className="block text-sm font-semibold text-foreground/90 mb-1.5">{tx('s2Gender')} *</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['MALE', 'FEMALE', 'OTHER'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => update({ gender: g, ...(g !== 'FEMALE' ? { isPregnant: false, isLactating: false } : {}) })}
                    aria-pressed={patient.gender === g}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      patient.gender === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {g === 'MALE' ? tx('s2Male') : g === 'FEMALE' ? tx('s2Female') : tx('s2Other')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <FieldError message={visibleError('age')} />
          </div>
        </div>

        {/* Which kind of doctor */}
        <div className="mt-2">
          <span className="block text-sm font-semibold text-foreground/90 mb-2">{tx('s2Stream')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup">
            {streams.map(s => {
              const Icon = s.icon;
              const active = patient.careStream === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => { sovereignSound.playDialNotch(); update({ careStream: s.id }); }}
                  className={`p-3 rounded-xl text-left border transition-colors flex items-start gap-2.5 ${
                    active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/80 bg-background hover:bg-muted/50'
                  }`}
                >
                  <Icon size={18} className={`shrink-0 mt-0.5 ${s.tone === 'emerald' ? 'text-emerald-600' : s.tone === 'sky' ? 'text-sky-600' : 'text-muted-foreground'}`} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground">{s.title}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{s.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {patient.gender === 'FEMALE' && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/30 flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300">
                <ShieldCheck size={16} />
                <span>{tx('maternalTitle')}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{tx('maternalSub')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { field: 'isPregnant', label: tx('pregnantQ') },
                { field: 'isLactating', label: tx('lactatingQ') }
              ] as const).map(q => (
                <div key={q.field} className="bg-background/80 p-3 rounded-xl border border-border/80">
                  <span className="block text-sm font-semibold text-foreground/90 mb-2">{q.label}</span>
                  <div className="flex gap-2">
                    {[true, false].map(val => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => { sovereignSound.playMechanicalSnap(); update({ [q.field]: val } as Partial<KioskPatient>); }}
                        aria-pressed={!!patient[q.field] === val}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg border transition-colors ${
                          !!patient[q.field] === val ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-foreground border-border/70 hover:bg-muted'
                        }`}
                      >
                        {val ? tx('yes') : tx('no')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!demoMode && authMethod !== 'walkin' && (abhaDigits.length === 14 || (aadhaarDigits.length === 12 && !errors.aadhaar)) && (
          <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/80 text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <ShieldCheck size={15} className="shrink-0" /> {tx('abhaUnverified')}
          </div>
        )}

        {/* OTP (demo servers only — real OTP verification needs the ABDM gateway) */}
        {demoMode && authMethod !== 'walkin' && !verified && (abhaDigits.length === 14 || (aadhaarDigits.length === 12 && !errors.aadhaar)) && (
          <div className="mt-4 p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 shrink-0">
                <Smartphone size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{tx('otpTitle')}</div>
                <div className="text-xs text-muted-foreground">{otpSent ? tx('otpDemoHint') : tx('otpSub')}</div>
                {otpError && <div className="text-xs font-semibold text-rose-600 mt-0.5">{tx('otpWrong')}</div>}
              </div>
            </div>
            {!otpSent ? (
              <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); setOtpSent(true); }} className="btn btn-secondary text-sm px-3.5 py-1.5 rounded-lg">
                {tx('otpSend')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={otpValue}
                  onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(false); }}
                  className="w-24 px-2.5 py-1.5 text-center font-mono font-bold text-sm bg-background border-2 border-sky-500 rounded-lg text-foreground outline-none"
                  aria-label={tx('otpTitle')}
                />
                <button type="button" onClick={handleVerifyOtp} disabled={otpValue.length < 4 || isVerifyingOtp} className="btn btn-primary text-sm px-3.5 py-1.5 rounded-lg disabled:opacity-50">
                  {isVerifyingOtp ? tx('otpVerifying') : tx('otpVerify')}
                </button>
              </div>
            )}
          </div>
        )}

        {demoMode && verified && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 size={17} className="shrink-0" />
            <span>{tx('otpDone')}</span>
          </div>
        )}
      </div>

      <ConsentCard
        consent={consent}
        setConsent={setConsent}
        language={language}
        hasPhone={phoneDigits.length === 10}
        hasAbha={abhaDigits.length === 14}
        showError={showErrors}
      />
    </div>
  );
};
