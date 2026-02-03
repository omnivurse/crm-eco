import { Card, CardContent } from '@crm-eco/ui';
import { Clock, CheckCircle, DollarSign } from 'lucide-react';

interface NeedsSummaryStripProps {
  openCount: number;
  approvedCount: number;
  paidCount: number;
}

export function NeedsSummaryStrip({ openCount, approvedCount, paidCount }: NeedsSummaryStripProps) {
  const stats = [
    {
      label: 'Open Needs',
      value: openCount,
      icon: <Clock className="w-5 h-5 text-blue-600" />,
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-900',
    },
    {
      label: 'Approved',
      value: approvedCount,
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      bgClass: 'bg-green-50',
      textClass: 'text-green-900',
    },
    {
      label: 'Paid / Shared',
      value: paidCount,
      icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className={stat.bgClass}>
          <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {stat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xl sm:text-2xl font-bold ${stat.textClass}`}>
                  {stat.value}
                </p>
                <p className="text-sm text-slate-600 truncate">
                  {stat.label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

