import { cn } from '@crm-eco/ui';

type UrgencyLevel = 'green' | 'orange' | 'red';

const urgencyConfig: Record<UrgencyLevel, { bg: string; text: string; label: string }> = {
  green: { bg: 'bg-emerald-500', text: 'text-white', label: 'On Track' },
  orange: { bg: 'bg-amber-500', text: 'text-white', label: 'Near Deadline' },
  red: { bg: 'bg-red-500', text: 'text-white', label: 'Must Complete' },
};

interface UrgencyBadgeProps {
  urgency: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export function UrgencyBadge({ urgency, className, showLabel = true }: UrgencyBadgeProps) {
  const level = (urgency as UrgencyLevel) || 'green';
  const config = urgencyConfig[level] || urgencyConfig.green;
  
  return (
    <span 
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {showLabel ? config.label : level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

// Compact version for tight spaces
export function UrgencyDot({ urgency, className }: { urgency: string | null | undefined; className?: string }) {
  const level = (urgency as UrgencyLevel) || 'green';
  const config = urgencyConfig[level] || urgencyConfig.green;
  
  return (
    <span 
      className={cn(
        'inline-block w-3 h-3 rounded-full',
        config.bg,
        className
      )}
      title={config.label}
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


