import * as React from 'react';
import { cn } from '../lib/utils';

type AccentColor = 'teal' | 'emerald' | 'gold' | 'navy' | 'rose' | 'amber' | 'blue' | 'purple';

const accentStyles: Record<AccentColor, { gradient: string; iconBg: string; iconColor: string; borderColor: string }> = {
  teal: {
    gradient: 'from-[#047474] to-[#069B9A]',
    iconBg: 'bg-[#e1f3f3]',
    iconColor: 'text-[#047474]',
    borderColor: 'border-l-[#047474]',
  },
  emerald: {
    gradient: 'from-[#027343] to-[#358f69]',
    iconBg: 'bg-[#e0f1ea]',
    iconColor: 'text-[#027343]',
    borderColor: 'border-l-[#027343]',
  },
  gold: {
    gradient: 'from-[#cda01b] to-[#E9B61F]',
    iconBg: 'bg-[#fcf6e4]',
    iconColor: 'text-[#907113]',
    borderColor: 'border-l-[#E9B61F]',
  },
  navy: {
    gradient: 'from-[#003560] to-[#335d80]',
    iconBg: 'bg-[#e0e7ec]',
    iconColor: 'text-[#003560]',
    borderColor: 'border-l-[#003560]',
  },
  rose: {
    gradient: 'from-rose-600 to-rose-500',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    borderColor: 'border-l-rose-500',
  },
  amber: {
    gradient: 'from-amber-600 to-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    borderColor: 'border-l-amber-500',
  },
  blue: {
    gradient: 'from-blue-600 to-blue-500',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    borderColor: 'border-l-blue-500',
  },
  purple: {
    gradient: 'from-purple-600 to-purple-500',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
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
        'relative bg-white rounded-2xl border border-slate-200 overflow-hidden',
        'shadow-[0_1px_2px_rgba(2,6,23,0.06),0_8px_24px_rgba(2,6,23,0.08)]',
        'hover:shadow-[0_4px_12px_rgba(2,6,23,0.08),0_12px_32px_rgba(2,6,23,0.12)]',
        'transition-all duration-300 hover:-translate-y-0.5',
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
          <p className="text-sm font-medium text-slate-500 tracking-wide">{title}</p>
          <div className={cn('p-2.5 rounded-xl', styles.iconBg)}>
            <div className={cn('w-5 h-5', styles.iconColor)}>
              {icon}
            </div>
          </div>
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-[#003560] tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            )}
          </div>
          
          {trend && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
              trend.value >= 0 ? 'bg-[#e0f1ea] text-[#027343]' : 'bg-rose-50 text-rose-600'
            )}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-slate-400 font-normal ml-0.5">{trend.label}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { StatCardProps, AccentColor };
