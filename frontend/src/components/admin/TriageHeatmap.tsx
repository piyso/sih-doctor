import React from 'react';
import { Activity, AlertOctagon, Clock, Users, ShieldCheck, TrendingUp, Info } from 'lucide-react';

export const TriageHeatmap: React.FC = () => {
  const departmentStats = [
    { name: 'कायचिकित्सा (Kayachikitsa - Internal Medicine)', count: 284, load: '84%', color: '#38bdf8' },
    { name: 'पंचकर्म (Panchakarma - Detox Therapies)', count: 192, load: '72%', color: '#34d399' },
    { name: 'शल्य तंत्र (Shalya Tantra - Surgery & Anorectal)', count: 148, load: '65%', color: '#fbbf24' },
    { name: 'कौमारभृत्य (Kaumarbhritya - Pediatrics)', count: 112, load: '55%', color: '#c084fc' },
    { name: 'प्रसूति एवं स्त्री रोग (Prasuti Tantra - OBGYN)', count: 165, load: '68%', color: '#f472b6' },
    { name: 'आपातकालीन वार्ड (Emergency Resuscitation Bay)', count: 24, load: '48%', color: '#fb7185' }
  ];

  return (
    <div className="main-wrapper space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold font-heading text-foreground tracking-tight m-0">
            OPD Census &amp; Heatmap
          </h2>
          <span className="text-muted-foreground/50">•</span>
          <span className="text-xs font-mono text-muted-foreground">Live Hospital Telemetry</span>
        </div>
      </div>

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Registered OPD */}
        <div className="p-4.5 rounded-2xl bg-card border border-border/80 shadow-2xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">TODAY&apos;S OPD</span>
            <Users className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground tabular-nums">5,420</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+18.4% efficiency</span>
          </div>
        </div>

        {/* Card 2: Emergency Red Flags */}
        <div className="p-4.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 shadow-2xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold tracking-wide uppercase">RED FLAGS DIVERTED</span>
            <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-rose-600 dark:text-rose-400 tabular-nums">142</div>
          <div className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
            &lt;45s emergency triage
          </div>
        </div>

        {/* Card 3: Consult Time */}
        <div className="p-4.5 rounded-2xl bg-card border border-border/80 shadow-2xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">CONSULT TIME SAVINGS</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-emerald-600 dark:text-emerald-400 tabular-nums">76.7%</div>
          <div className="text-xs text-muted-foreground mt-1">
            Saved 11.5m per patient
          </div>
        </div>

        {/* Card 4: Air-Gap Uptime */}
        <div className="p-4.5 rounded-2xl bg-card border border-border/80 shadow-2xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">AIR-GAP UPTIME</span>
            <ShieldCheck className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground tabular-nums">100.0%</div>
          <div className="text-xs text-muted-foreground mt-1">
            Zero cloud egress verified
          </div>
        </div>
      </div>

      {/* Grid: Triage Distribution & Department Loads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Triage Priority Breakdown */}
        <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-2xs">
          <h3 className="text-base font-bold font-heading text-foreground mb-4.5 tracking-tight">
            Clinical Triage Distribution
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Routine / Mild Conditions</span>
                <span className="text-foreground font-bold tabular-nums">4,010 (74.0%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="w-[74%] h-full rounded-full bg-emerald-500" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                <span className="text-amber-600 dark:text-amber-400 font-semibold">High Priority / Elevated BP</span>
                <span className="text-foreground font-bold tabular-nums">1,268 (23.4%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="w-[23.4%] h-full rounded-full bg-amber-500" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                <span className="text-rose-600 dark:text-rose-400 font-semibold">Emergency Red Flags</span>
                <span className="text-foreground font-bold tabular-nums">142 (2.6%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="w-[2.6%] h-full rounded-full bg-rose-500" />
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-800 dark:text-sky-200 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold text-sky-950 dark:text-sky-100">Triage Impact:</strong> Emergency patients are automatically diverted to resuscitation bays in &lt; 45 seconds of MediKiosk intake without joining the general OPD queue.
            </div>
          </div>
        </div>

        {/* Department Census Load */}
        <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-2xs">
          <h3 className="text-base font-bold font-heading text-foreground mb-4.5 tracking-tight">
            Departmental Census &amp; Doctor Workload
          </h3>

          <div className="space-y-2">
            {departmentStats.map((dept, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-muted/40 border border-border/70"
              >
                <div>
                  <div className="text-xs sm:text-sm font-bold text-foreground">{dept.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{dept.count} patients today</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border/60 tabular-nums">
                    {dept.load}
                  </span>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Capacity</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Room 01: Mandatory 45-Second Bedside Nurse Resuscitation Gate & Anti-Malingering Deterrent */}
      <div className="p-5 sm:p-6 rounded-2xl bg-card border border-rose-300 dark:border-rose-900/60 shadow-2xs">
        <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-heading text-foreground m-0">
                  Room 01: Mandatory 45-Second Bedside Nurse Resuscitation Gate
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold">
                  ANTI-MALINGERING
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every STAT diversion undergoes mandatory bedside nurse verification. Prevents queue malingering while guaranteeing 0-delay AMI resuscitation.
              </p>
            </div>
          </div>
        </div>

        {/* 3-Lead ECG Rhythm Strip Simulation & Nurse Gate Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ECG Rhythm Strip */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 relative overflow-hidden">
            <div className="flex justify-between text-[11px] text-sky-600 dark:text-sky-400 mb-2 font-mono font-semibold">
              <span>LEAD II TELEMETRY · 25mm/sec · 10mm/mV</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">HR: 112 BPM (ST-ELEVATION)</span>
            </div>
            {/* SVG ECG Waveform */}
            <svg width="100%" height="70" viewBox="0 0 500 70" preserveAspectRatio="none" className="w-full">
              <path
                d="M0,35 L40,35 L50,28 L60,35 L80,35 L85,42 L95,8 L105,62 L115,35 L130,35 L145,22 L160,35 L200,35 L240,35 L250,28 L260,35 L280,35 L285,42 L295,8 L305,62 L315,35 L330,35 L345,22 L360,35 L400,35 L440,35 L450,28 L460,35 L480,35 L485,42 L495,8 L500,35"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
              />
            </svg>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1 font-sans">
              <span>SpO2: <strong className="text-sky-600 dark:text-sky-400">93% (Hypoxia)</strong></span>
              <span>NIBP: <strong className="text-rose-600 dark:text-rose-400">160/100 mmHg</strong></span>
              <span>Nurse Gate: <strong className="text-emerald-600 dark:text-emerald-400">Verified in 28s</strong></span>
            </div>
          </div>

          {/* Anti-Malingering Deterrent Policy */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <div className="text-[11px] font-mono font-bold text-amber-950 dark:text-amber-100 uppercase tracking-wider mb-1.5">
              Dual-Channel Clinical Protection Guard:
            </div>
            <div>
              <strong>1. Genuine AMI Cases:</strong> Immediate transfer to ICCU Catheterization Lab (&lt; 15 mins door-to-balloon time).
            </div>
            <div className="mt-1">
              <strong>2. False Claim Malingerers:</strong> If patient falsely reports 10/10 chest pain to jump the 40-minute general line, bedside nurse confirms stable vitals (SpO2 &gt; 98%, HR normal, no ST deviation).
            </div>
            <div className="mt-1.5 text-rose-700 dark:text-rose-400 font-semibold">
              ➔ Result: Automatic +25 minute queue downgrade penalty to deter queue gaming.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
