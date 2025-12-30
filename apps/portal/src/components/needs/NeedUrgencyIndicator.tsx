interface NeedUrgencyIndicatorProps {
  urgency: 'green' | 'orange' | 'red' | null | undefined;
  showLabel?: boolean;
}

const urgencyConfig: Record<string, {
  label: string;
  dotClass: string;
  textClass: string;
}> = {
  green: {
    label: 'On Track',
    dotClass: 'bg-green-500',
    textClass: 'text-green-700',
  },
  orange: {
    label: 'Approaching Deadline',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
  },
  red: {
    label: 'Needs Attention',
    dotClass: 'bg-red-500',
    textClass: 'text-red-700',
  },
};

export function NeedUrgencyIndicator({ urgency, showLabel = true }: NeedUrgencyIndicatorProps) {
  if (!urgency) {
    return null;
  }

  const config = urgencyConfig[urgency];
  if (!config) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      {showLabel && (
        <span className={`text-xs ${config.textClass}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}

