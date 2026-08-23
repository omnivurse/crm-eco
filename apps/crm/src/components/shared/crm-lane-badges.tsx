'use client';

import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { Heart, Shield, HelpCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { resolveOwnershipName } from '@/lib/crm/ownership-name';

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
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
  },
  traditional_insurance: {
    label: 'Traditional Insurance',
    short: 'Ins',
    ownerLabel: 'Agent',
    icon: Shield,
    color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
  },
  unknown: {
    label: 'Needs Classification',
    short: '?',
    ownerLabel: 'Owner',
    icon: HelpCircle,
    color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
  },
};

interface MarketTypeBadgeProps {
  marketType: string | null | undefined;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  short?: boolean;
  /**
   * Render nothing for an unclassified lane (RP-4 / D6b). The amber
   * "Needs Classification" badge is admin signal; rep-facing surfaces (the
   * record header meta row) pass `hideUnknown` and keep the rail/sheet rows.
   */
  hideUnknown?: boolean;
  className?: string;
}

export function MarketTypeBadge({
  marketType,
  size = 'sm',
  showIcon = false,
  short = false,
  hideUnknown = false,
  className,
}: MarketTypeBadgeProps) {
  const key = marketType && MARKET_TYPE_CONFIG[marketType] ? marketType : 'unknown';
  if (hideUnknown && key === 'unknown') return null;
  const config = MARKET_TYPE_CONFIG[key];
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
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  },
  needs_review: {
    label: 'Needs Review',
    icon: AlertTriangle,
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
  },
  unresolved: {
    label: 'Unresolved',
    icon: Clock,
    color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
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
    data?: Record<string, unknown> | null;
  };
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function OwnershipDisplay({ record, size = 'sm', showLabel = true, className }: OwnershipDisplayProps) {
  const market = record.market_type || 'unknown';
  const config = MARKET_TYPE_CONFIG[market] || MARKET_TYPE_CONFIG.unknown;

  // Lane-aware normalized name first, then `data.producer` / advisor /
  // agent / lead_owner fallbacks so "who enrolled" shows for native and
  // enrollment-created contacts that never went through normalization.
  const { name: ownerName } = resolveOwnershipName(record);

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
