import * as React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon: LucideIcon;
  description?: string;
  subValue?: string;
  badgeText?: string;
  onClick?: () => void;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  subValue,
  badgeText,
  onClick,
  className,
}: StatsCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'border border-border/70 bg-card p-5 rounded-2xl transition-all duration-300 hover:border-foreground/40 shadow-sm relative overflow-hidden group font-sans flex flex-col justify-between h-full card-hover-lift cursor-default',
        className
      )}
    >
      <div>
        {/* Header with Title and Framed Icon */}
        <div className="flex items-center justify-between gap-2 pb-2">
          <span className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <div className="h-8 w-8 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition-colors">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        {/* Main Value Display */}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {value}
          </div>
          {badgeText && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/80 border border-border/60 text-muted-foreground font-semibold">
              {badgeText}
            </span>
          )}
        </div>

        {/* Subvalue or Description */}
        {subValue && (
          <p className="text-xs font-mono text-muted-foreground mt-1 tracking-tight">
            {subValue}
          </p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed font-sans">
            {description}
          </p>
        )}
      </div>

      {change && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs font-mono">
          {change.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
          {change.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-rose-500" />}
          <span className={cn(
            change.trend === 'up' && 'text-emerald-500 font-semibold',
            change.trend === 'down' && 'text-rose-500 font-semibold',
            change.trend === 'neutral' && 'text-muted-foreground'
          )}>
            {change.value}%
          </span>
        </div>
      )}
    </div>
  );
}
