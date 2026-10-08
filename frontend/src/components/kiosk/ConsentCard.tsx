import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, Check } from 'lucide-react';
import { KioskConsent } from '../../services/api';
import { kioskText, KioskTextKey } from '../../utils/kioskLocalization';
import { sovereignSound } from '../../utils/audio';

export const emptyConsent = (language: string): KioskConsent => ({
  purposes: { care: false, abha_link: false, sms: false, research: false },
  language,
  method: 'kiosk_self'
});

interface ConsentCardProps {
  consent: KioskConsent;
  setConsent: (c: KioskConsent) => void;
  language: string;
  hasPhone: boolean;
  hasAbha: boolean;
  showError: boolean;
}

/**
 * DPDP Act 2023 consent, in the patient's language: one required purpose (treatment) and optional,
 * separately chosen purposes. Nothing is pre-ticked.
 */
export const ConsentCard: React.FC<ConsentCardProps> = ({ consent, setConsent, language, hasPhone, hasAbha, showError }) => {
  const tx = kioskText(language);
  const [open, setOpen] = useState(false);
  const toggle = (k: keyof KioskConsent['purposes']) => {
    try { sovereignSound.playMechanicalSnap(); } catch {}
    setConsent({ ...consent, language, purposes: { ...consent.purposes, [k]: !consent.purposes[k] } });
  };

  const box = ({ k, label, sub, disabled, strong }: { k: keyof KioskConsent['purposes']; label: KioskTextKey; sub?: string; disabled?: boolean; strong?: boolean }) => (
    <button
      key={k}
      type="button"
      role="checkbox"
      aria-checked={consent.purposes[k]}
      disabled={disabled}
      onClick={() => toggle(k)}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors disabled:opacity-50 ${
        consent.purposes[k] ? 'border-primary bg-primary/5' : strong && showError ? 'border-rose-500 bg-rose-500/5' : 'border-border/80 bg-background hover:bg-muted/40'
      }`}
    >
      <span className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${consent.purposes[k] ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50'}`}>
        {consent.purposes[k] && <Check size={15} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${strong ? 'font-bold' : 'font-semibold'} text-foreground`}>{tx(label)}</span>
        {sub && <span className="block text-xs text-muted-foreground mt-0.5">{sub}</span>}
      </span>
    </button>
  );

  return (
    <section className="physical-card p-4 sm:p-5 rounded-2xl mb-5" aria-labelledby="consent-title">
      <h3 id="consent-title" className="text-base font-heading font-extrabold text-foreground flex items-center gap-2 mb-3">
        <ShieldCheck size={18} className="text-primary" /> {tx('consentTitle')}
      </h3>
      {box({ k: 'care', label: 'consentCare', sub: tx('consentCareSub'), strong: true })}
      <p className={`min-h-[18px] mt-1 mb-2 text-xs font-semibold ${showError && !consent.purposes.care ? 'text-rose-600' : 'text-transparent'}`} role={showError && !consent.purposes.care ? 'alert' : undefined}>
        {showError && !consent.purposes.care ? tx('consentNeeded') : '·'}
      </p>
      <div className="text-[11px] font-bold text-muted-foreground mb-1.5">{tx('consentOptional')}</div>
      <div className="space-y-2">
        {box({ k: 'sms', label: 'consentSms', sub: hasPhone ? undefined : tx('consentSmsNeedsPhone'), disabled: !hasPhone })}
        {hasAbha && box({ k: 'abha_link', label: 'consentAbha' })}
        {box({ k: 'research', label: 'consentResearch' })}
      </div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="mt-3 text-xs font-semibold text-primary inline-flex items-center gap-1">
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} /> {tx('consentMore')}
      </button>
      {open && <p className="mt-2 text-xs leading-relaxed text-foreground/80 bg-muted/40 border border-border/60 rounded-xl p-3">{tx('consentNotice')}</p>}
    </section>
  );
};
