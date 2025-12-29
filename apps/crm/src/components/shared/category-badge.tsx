import { Badge } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui';

const categoryColors: Record<string, string> = {
  need: 'bg-purple-100 text-purple-700',
  enrollment: 'bg-blue-100 text-blue-700',
  billing: 'bg-green-100 text-green-700',
  service: 'bg-cyan-100 text-cyan-700',
  other: 'bg-slate-100 text-slate-600',
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const colorClass = categoryColors[category] || categoryColors.other;
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(colorClass, 'capitalize', className)}
    >
      {category}
    </Badge>
  );
}

