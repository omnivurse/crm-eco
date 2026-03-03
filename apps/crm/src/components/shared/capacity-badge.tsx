'use client';

import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { Shield } from 'lucide-react';

const CAPACITY_CONFIG: Record<string, { label: string; color: string; short: string }> = {
  health_insurance: {
    label: 'Health Insurance',
    short: 'Insurance',
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  },
  health_share: {
    label: 'Health Share',
    short: 'Health Share',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
  },
};

interface CapacityBadgeProps {
  capacity: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  short?: boolean;
  className?: string;
}

export function CapacityBadge({ capacity, size = 'sm', showIcon = false, short = false, className }: CapacityBadgeProps) {
  const config = CAPACITY_CONFIG[capacity];
  if (!config) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        config.color,
        size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5',
        className,
      )}
    >
      {showIcon && <Shield className="w-3 h-3 mr-1" />}
      {short ? config.short : config.label}
    </Badge>
  );
}

interface CapacityBadgesProps {
  capacities: string[];
  size?: 'sm' | 'md';
  showIcon?: boolean;
  short?: boolean;
  className?: string;
}

export function CapacityBadges({ capacities, size = 'sm', showIcon = false, short = false, className }: CapacityBadgesProps) {
  if (!capacities || capacities.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {capacities.map((cap) => (
        <CapacityBadge key={cap} capacity={cap} size={size} showIcon={showIcon} short={short} />
      ))}
    </div>
  );
}

export function getCapacityLabel(productType: string | null): string {
  if (!productType) return 'All Types';
  return CAPACITY_CONFIG[productType]?.label || productType;
}

export { CAPACITY_CONFIG };
