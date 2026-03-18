'use client';

/**
 * Shared CRM lane-aware badge components.
 * Used by both CRM app and Admin portal for consistent business-lane display.
 *
 * Business rules:
 *   Advisor = HealthShare lane
 *   Agent = Traditional Insurance lane
 */

import { Badge } from './badge';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ */
/*  Market Type (Business Lane)                                        */
/* ------------------------------------------------------------------ */

const MARKET_TYPE_CONFIG: Record<string, {
  label: string;
  short: string;
  ownerLabel: string;
  color: string;
}> = {
  healthshare: {
    label: 'HealthShare',
    short: 'HS',
    ownerLabel: 'Advisor',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
  },
  traditional_insurance: {
    label: 'Traditional Insurance',
    short: 'Ins',
    ownerLabel: 'Agent',
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  },
  unknown: {
    label: 'Needs Classification',
    short: '?',
    ownerLabel: 'Owner',
    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  },
};

interface MarketTypeBadgeProps {
  marketType: string | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

export function MarketTypeBadge({ marketType, size = 'sm', className }: MarketTypeBadgeProps) {
  const config = MARKET_TYPE_CONFIG[marketType || 'unknown'] || MARKET_TYPE_CONFIG.unknown;
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
      {config.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Normalization Status                                               */
/* ------------------------------------------------------------------ */

const NORMALIZATION_CONFIG: Record<string, { label: string; color: string }> = {
  normalized: { label: 'Verified', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  needs_review: { label: 'Needs Review', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  unresolved: { label: 'Unresolved', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
};

interface NormalizationBadgeProps {
  status: string | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

export function NormalizationStatusBadge({ status, size = 'sm', className }: NormalizationBadgeProps) {
  if (!status || status === 'normalized') return null;
  const config = NORMALIZATION_CONFIG[status] || NORMALIZATION_CONFIG.unresolved;
  return (
    <Badge variant="outline" className={cn('font-medium whitespace-nowrap', config.color, size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5', className)}>
      {config.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function getOwnerLabel(marketType: string | null | undefined): string {
  return MARKET_TYPE_CONFIG[marketType || 'unknown']?.ownerLabel || 'Owner';
}

export function getMarketTypeLabel(marketType: string | null | undefined): string {
  return MARKET_TYPE_CONFIG[marketType || 'unknown']?.label || 'Unknown';
}

export function getOwnerName(record: {
  market_type?: string | null;
  normalized_advisor_name?: string | null;
  normalized_agent_name?: string | null;
}): string | null {
  const market = record.market_type || 'unknown';
  if (market === 'healthshare') return record.normalized_advisor_name || null;
  if (market === 'traditional_insurance') return record.normalized_agent_name || null;
  return record.normalized_advisor_name || record.normalized_agent_name || null;
}

export { MARKET_TYPE_CONFIG, NORMALIZATION_CONFIG };
