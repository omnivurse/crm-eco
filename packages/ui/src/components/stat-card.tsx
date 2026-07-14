import * as React from 'react';
import { cn } from '../lib/utils';

type AccentColor = 'teal' | 'emerald' | 'gold' | 'navy' | 'rose' | 'amber' | 'blue' | 'purple';

const accentStyles: Record<AccentColor, { gradient: string; iconBg: string; iconColor: string; borderColor: string }> = {
  teal: {
    gradient: 'from-[#0891b2] to-[#06b6d4]',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-700 dark:text-cyan-300',
    borderColor: 'border-l-cyan-600',
  },
  emerald: {
    gradient: 'from-[#059669] to-[#10b981]',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-l-emerald-600',
  },
  gold: {
    gradient: 'from-[#d97706] to-[#f59e0b]',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-800 dark:text-amber-300',
    borderColor: 'border-l-amber-500',
  },
  navy: {
    gradient: 'from-[#0f172a] to-[#334155]',
    iconBg: 'bg-slate-500/10',
    iconColor: 'text-slate-800 dark:text-slate-200',
    borderColor: 'border-l-slate-700',
  },
  rose: {
    gradient: 'from-rose-600 to-rose-500',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600 dark:text-rose-300',
    borderColor: 'border-l-rose-500',
  },
  amber: {
    gradient: 'from-amber-600 to-amber-500',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-300',
    borderColor: 'border-l-amber-500',
  },
  blue: {
    gradient: 'from-blue-600 to-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-300',
    borderColor: 'border-l-blue-500',
  },
  purple: {
    gradient: 'from-purple-600 to-purple-500',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600 dark:text-purple-300',
    borderColor: 'border-l-purple-500',
  },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: AccentColor;
  trend?: {
    value: number;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent = 'teal',
  trend,
  className,
  onClick,
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        'relative bg-card text-card-foreground rounded-2xl border border-border overflow-hidden',
        'shadow-card hover:shadow-popover transition-shadow duration-200',
        'border-l-4',
        styles.borderColor,
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Gradient top accent stripe */}
      <div className={cn('h-1 bg-gradient-to-r', styles.gradient)} />

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground tracking-wide">{title}</p>
          <div className={cn('p-2.5 rounded-xl', styles.iconBg)}>
            <div className={cn('w-5 h-5', styles.iconColor)}>
              {icon}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-foreground tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>

          {trend && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
              trend.value >= 0
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
            )}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-muted-foreground font-normal ml-0.5">{trend.label}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { StatCardProps, AccentColor };
