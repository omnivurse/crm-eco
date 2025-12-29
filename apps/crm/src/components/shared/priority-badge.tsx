import { Badge } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui';

type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

const priorityColors: Record<PriorityLevel, string> = {
  low: 'bg-slate-50 text-slate-500 border-slate-200',
  normal: 'bg-slate-100 text-slate-600 border-slate-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const level = priority as PriorityLevel;
  const colorClass = priorityColors[level] || priorityColors.normal;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(colorClass, 'capitalize', className)}
    >
      {priority}
    </Badge>
  );
}

