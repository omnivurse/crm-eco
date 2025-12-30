import { cn } from '@crm-eco/ui';
import {
  getUrgencyLabelCRM,
  getUrgencyBadgeClass,
  getUrgencyDotClass,
  type UrgencyLight,
} from '@crm-eco/lib';

interface UrgencyBadgeProps {
  urgency: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export function UrgencyBadge({ urgency, className, showLabel = true }: UrgencyBadgeProps) {
  const level = (urgency as UrgencyLight) || null;
  const label = getUrgencyLabelCRM(level);
  const badgeClass = getUrgencyBadgeClass(level);
  
  return (
    <span 
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        badgeClass,
        className
      )}
    >
      {showLabel ? label : (level ? level.charAt(0).toUpperCase() + level.slice(1) : 'None')}
    </span>
  );
}

// Compact version for tight spaces
export function UrgencyDot({ urgency, className }: { urgency: string | null | undefined; className?: string }) {
  const level = (urgency as UrgencyLight) || null;
  const dotClass = getUrgencyDotClass(level);
  const label = getUrgencyLabelCRM(level);
  
  return (
    <span 
      className={cn(
        'inline-block w-3 h-3 rounded-full',
        dotClass,
        className
      )}
      title={label}
    />
  );
}

// Get days remaining text
export function getUrgencyText(slaTargetDate: string | null | undefined): string {
  if (!slaTargetDate) return 'No SLA set';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(slaTargetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return '1 day remaining';
  } else {
    return `${diffDays} days remaining`;
  }
}
