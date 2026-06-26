import { 
  getUrgencyLabel, 
  getUrgencyDotClass, 
  getUrgencyTextClass,
  type UrgencyLight 
} from '@crm-eco/lib';

interface NeedUrgencyIndicatorProps {
  urgency: UrgencyLight | null | undefined;
  showLabel?: boolean;
}

export function NeedUrgencyIndicator({ urgency, showLabel = true }: NeedUrgencyIndicatorProps) {
  if (!urgency) {
    return null;
  }

  const dotClass = getUrgencyDotClass(urgency);
  const textClass = getUrgencyTextClass(urgency);
  const label = getUrgencyLabel(urgency);

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      {showLabel && (
        <span className={`text-xs ${textClass}`}>
          {label}
        </span>
      )}
    </div>
  );
}
