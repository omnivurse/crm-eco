'use client';

import Link from 'next/link';
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@crm-eco/ui';

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
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
  gradient,
  href,
  trend,
  pulse = false,
  size = 'default',
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-3 h-3" />;
      case 'down':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
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
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

      {/* Glow effect on hover */}
      <div
        className={`absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient} blur-xl`}
      />

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
          <div
            className={`p-3 rounded-xl ${gradient.replace('bg-gradient-to-r', 'bg-gradient-to-br')} bg-opacity-10 backdrop-blur-sm`}
          >
            <div className="text-white">{icon}</div>
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
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
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
  gradient: string;
  href: string;
  iconBg: string;
}

export function CommissionCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  href,
  iconBg,
}: CommissionCardProps) {
  return (
    <Link href={href}>
      <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transition-all duration-500 hover:-translate-y-1">
        {/* Gradient accent */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${gradient}`} />

        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.02]">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern
                id="grid"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-semibold text-slate-600 tracking-wide">
              {title}
            </p>
            <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p
                className={`text-4xl font-bold tracking-tight bg-clip-text text-transparent ${gradient}`}
              >
                {value}
              </p>
              <p className="text-xs text-slate-400 mt-2">{subtitle}</p>
            </div>
            <div className="p-2 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
