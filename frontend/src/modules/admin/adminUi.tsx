import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

/** Shared building blocks for the admin console panels. */

export const Panel: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, actions, children }) => (
  <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs min-w-0">
    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
    {children}
  </section>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'danger' | 'warn' | 'ok' }> = ({ label, value, hint, tone = 'default' }) => {
  const toneCls = {
    default: 'text-foreground',
    danger: 'text-rose-600 dark:text-rose-400',
    warn: 'text-amber-600 dark:text-amber-400',
    ok: 'text-emerald-600 dark:text-emerald-400'
  }[tone];
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-3.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`text-2xl font-extrabold mt-0.5 tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
};

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'default' | 'danger' | 'quietDanger'; busy?: boolean }> = ({ tone = 'default', busy, children, className = '', ...rest }) => {
  const cls = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary',
    default: 'bg-background text-foreground hover:bg-muted border-border',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600',
    /** For a destructive action repeated on every row: visible, but not a wall of red. */
    quietDanger: 'bg-background text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 border-border'
  }[tone];
  return (
    <button type="button" {...rest} disabled={rest.disabled || busy} className={`h-9 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${cls} ${className}`}>
      {busy && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode; error?: string | null; hint?: string }> = ({ label, children, error, hint }) => (
  <label className="block">
    <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    <div className="mt-1">{children}</div>
    <div className="min-h-[16px] text-[11px] mt-0.5">
      {error ? <span className="text-rose-600 font-semibold">{error}</span> : hint ? <span className="text-muted-foreground">{hint}</span> : null}
    </div>
  </label>
);

export const inputCls = 'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

export const ErrorNote: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs font-semibold text-rose-700 dark:text-rose-200 flex items-center gap-2" role="alert">
      <AlertCircle size={14} className="shrink-0" /> {message}
    </div>
  ) : null;

export const Loading: React.FC = () => (
  <div className="py-10 flex items-center justify-center text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin mr-2" /> Loading…</div>
);

export const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtMins = (m?: number | null) => (m === null || m === undefined || !Number.isFinite(m) ? '—' : m < 1 ? '<1 min' : `${Math.round(m)} min`);
