'use client';

import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { Heart, Shield, HelpCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Market Type (Business Lane)                                        */
/* ------------------------------------------------------------------ */

const MARKET_TYPE_CONFIG: Record<string, {
  label: string;
  short: string;
  ownerLabel: string;
  icon: typeof Heart;
  color: string;
}> = {
  healthshare: {
    label: 'HealthShare',
    short: 'HS',
    ownerLabel: 'Advisor',
    icon: Heart,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
  },
  traditional_insurance: {
    label: 'Traditional Insurance',
    short: 'Ins',
    ownerLabel: 'Agent',
    icon: Shield,
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  },
  unknown: {
    label: 'Needs Classification',
    short: '?',
    ownerLabel: 'Owner',
    icon: HelpCircle,
    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  },
};

interface MarketTypeBadgeProps {
  marketType: string | null | undefined;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  short?: boolean;
  className?: string;
}

export function MarketTypeBadge({ marketType, size = 'sm', showIcon = false, short = false, className }: MarketTypeBadgeProps) {
  const config = MARKET_TYPE_CONFIG[marketType || 'unknown'] || MARKET_TYPE_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium whitespace-nowrap',
        config.color,
        size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5',
        className,
      )}
    >
      {showIcon && <Icon className="w-3 h-3 mr-1 flex-shrink-0" />}
      {short ? config.short : config.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Normalization Status                                               */
/* ------------------------------------------------------------------ */

const NORMALIZATION_CONFIG: Record<string, {
  label: string;
  icon: typeof CheckCircle;
  color: string;
}> = {
  normalized: {
    label: 'Verified',
    icon: CheckCircle,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  needs_review: {
    label: 'Needs Review',
    icon: AlertTriangle,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  unresolved: {
    label: 'Unresolved',
    icon: Clock,
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  },
};

interface NormalizationBadgeProps {
  status: string | null | undefined;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function NormalizationBadge({ status, size = 'sm', showIcon = true, className }: NormalizationBadgeProps) {
  if (!status || status === 'normalized') return null; // Only show for non-normalized
  const config = NORMALIZATION_CONFIG[status] || NORMALIZATION_CONFIG.unresolved;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium whitespace-nowrap',
        config.color,
        size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5',
        className,
      )}
    >
      {showIcon && <Icon className="w-3 h-3 mr-1 flex-shrink-0" />}
      {config.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Lane-Aware Ownership Display                                       */
/* ------------------------------------------------------------------ */

interface OwnershipDisplayProps {
  record: {
    market_type?: string | null;
    normalized_advisor_name?: string | null;
    normalized_agent_name?: string | null;
    data?: Record<string, unknown>;
  };
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function OwnershipDisplay({ record, size = 'sm', showLabel = true, className }: OwnershipDisplayProps) {
  const market = record.market_type || 'unknown';
  const config = MARKET_TYPE_CONFIG[market] || MARKET_TYPE_CONFIG.unknown;

  let ownerName: string | null = null;

  if (market === 'healthshare') {
    ownerName = record.normalized_advisor_name || null;
  } else if (market === 'traditional_insurance') {
    ownerName = record.normalized_agent_name || null;
  } else {
    // Unknown: show best available
    ownerName = record.normalized_advisor_name || record.normalized_agent_name || null;
  }

  if (!ownerName) return <span className="text-slate-400 dark:text-slate-600 text-sm">Unassigned</span>;

  return (
    <span className={cn('text-slate-700 dark:text-slate-300 truncate', size === 'sm' ? 'text-sm' : 'text-base', className)}>
      {showLabel && (
        <span className="text-slate-400 dark:text-slate-500 mr-1">{config.ownerLabel}:</span>
      )}
      {ownerName}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Normalization Review Banner (for detail pages)                     */
/* ------------------------------------------------------------------ */

interface NormalizationBannerProps {
  status: string | null | undefined;
  notes: string | null | undefined;
  className?: string;
}

export function NormalizationBanner({ status, notes, className }: NormalizationBannerProps) {
  if (!status || status === 'normalized') return null;

  const isUnresolved = status === 'unresolved';

  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 flex items-start gap-3',
      isUnresolved
        ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
        : 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20',
      className,
    )}>
      <AlertTriangle className={cn(
        'w-4 h-4 mt-0.5 flex-shrink-0',
        isUnresolved ? 'text-red-500' : 'text-amber-500',
      )} />
      <div className="min-w-0">
        <p className={cn(
          'text-sm font-medium',
          isUnresolved ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400',
        )}>
          {isUnresolved ? 'This record needs classification' : 'This record needs review'}
        </p>
        {notes && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{notes}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: get lane-specific owner label                              */
/* ------------------------------------------------------------------ */

export function getOwnerLabel(marketType: string | null | undefined): string {
  return MARKET_TYPE_CONFIG[marketType || 'unknown']?.ownerLabel || 'Owner';
}

export function getMarketTypeLabel(marketType: string | null | undefined): string {
  return MARKET_TYPE_CONFIG[marketType || 'unknown']?.label || 'Unknown';
}

export { MARKET_TYPE_CONFIG, NORMALIZATION_CONFIG };
