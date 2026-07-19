'use client';

import { ArrowUpRight, Minus, TrendDown, TrendUp } from '@phosphor-icons/react';
import Link from 'next/link';
import { cn } from '@crm-eco/ui';

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  pulse?: boolean;
  size?: 'default' | 'large';
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  href,
  trend,
  pulse = false,
  size = 'default',
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return <TrendUp weight="light" className="w-3 h-3" />;
      case 'down':
        return <TrendDown weight="light" className="w-3 h-3" />;
      default:
        return <Minus weight="light" className="w-3 h-3" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    switch (trend.direction) {
      case 'up':
        return 'text-emerald-600 bg-emerald-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const content = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-white border border-slate-200/60',
        'shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]',
        'hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]',
        'transition-all duration-500 hover:-translate-y-1',
        pulse && 'ring-2 ring-amber-400/50 animate-pulse'
      )}
    >
      {/* Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200" />

      <div className={cn('relative', size === 'large' ? 'p-8' : 'p-6')}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <p
              className={cn(
                'font-bold text-slate-900 tracking-tight',
                size === 'large' ? 'text-4xl' : 'text-3xl'
              )}
            >
              {value}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-100">
            <div className="text-slate-600">{icon}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                  getTrendColor()
                )}
              >
                {getTrendIcon()}
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
            )}
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            {trend?.label && (
              <p className="text-xs text-slate-400">{trend.label}</p>
            )}
          </div>
          {href && (
            <ArrowUpRight weight="light" className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Commission-specific variant
export interface CommissionCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
}

export function CommissionCard({
  title,
  value,
  subtitle,
  icon,
  href,
}: CommissionCardProps) {
  return (
    <Link href={href}>
      <div className="adm-bezel">
        <div className="group adm-bezel-inner relative p-6">
          <div className="mb-4 flex items-start justify-between">
            <p className="text-sm font-semibold tracking-wide text-[var(--adm-muted)]">
              {title}
            </p>
            <div className="rounded-xl bg-[rgba(11,109,133,0.06)] p-3 dark:bg-white/5">
              <div className="text-[var(--adm-teal)]">{icon}</div>
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold tracking-tight text-[var(--adm-ink)]">
                {value}
              </p>
              <p className="mt-2 text-xs text-[var(--adm-muted)]">{subtitle}</p>
            </div>
            <div className="rounded-full bg-[rgba(11,109,133,0.06)] p-2 transition-colors group-hover:bg-[rgba(11,109,133,0.12)] dark:bg-white/5 dark:group-hover:bg-white/10">
              <ArrowUpRight weight="light" className="h-4 w-4 text-[var(--adm-muted)] transition-colors group-hover:text-[var(--adm-teal)]" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
