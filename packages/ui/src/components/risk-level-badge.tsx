'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { AlertTriangle, AlertCircle, Info, Shield } from 'lucide-react';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_CONFIG: Record<
  RiskLevel,
  {
    icon: React.ReactNode;
    className: string;
    label: string;
  }
> = {
  low: {
    icon: <Info className="w-3 h-3" />,
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    label: 'Low',
  },
  medium: {
    icon: <Shield className="w-3 h-3" />,
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    label: 'Medium',
  },
  high: {
    icon: <AlertTriangle className="w-3 h-3" />,
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
    label: 'High',
  },
  critical: {
    icon: <AlertCircle className="w-3 h-3" />,
    className:
      'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-500/30',
    label: 'Critical',
  },
};

export interface RiskLevelBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function RiskLevelBadge({
  level,
  showIcon = true,
  showLabel = true,
  size = 'default',
  className,
}: RiskLevelBadgeProps) {
  const config = RISK_CONFIG[level];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        config.className,
        className
      )}
    >
      {showIcon && config.icon}
      {showLabel && config.label}
    </span>
  );
}

/**
 * Get risk level color for charts/indicators
 */
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return '#ef4444'; // red-500
    case 'high':
      return '#f97316'; // orange-500
    case 'medium':
      return '#f59e0b'; // amber-500
    case 'low':
      return '#64748b'; // slate-500
    default:
      return '#64748b';
  }
}

/**
 * Risk level dot indicator (compact version)
 */
export function RiskLevelDot({
  level,
  className,
}: {
  level: RiskLevel;
  className?: string;
}) {
  const colorClass = {
    low: 'bg-slate-400',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  }[level];

  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full', colorClass, className)}
      title={`${level.charAt(0).toUpperCase() + level.slice(1)} Risk`}
    />
  );
}
