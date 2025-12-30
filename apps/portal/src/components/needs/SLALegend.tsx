import { getUrgencyLabel, getUrgencyDotClass } from '@crm-eco/lib';
import { Info } from 'lucide-react';

/**
 * SLA Legend component for the Member Portal
 * Explains the meaning of the urgency indicators
 */
export function SLALegend() {
  const indicators = [
    { urgency: 'green' as const, description: 'within expected timeline' },
    { urgency: 'orange' as const, description: 'approaching target date' },
    { urgency: 'red' as const, description: 'past target date' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-slate-50 rounded-lg text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <Info className="w-4 h-4" />
        <span>Timeline indicators:</span>
      </div>
      {indicators.map(({ urgency, description }) => (
        <div key={urgency} className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${getUrgencyDotClass(urgency)}`} />
          <span className="text-slate-700">
            <span className="font-medium">{getUrgencyLabel(urgency)}</span>
            <span className="text-slate-500"> – {description}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

