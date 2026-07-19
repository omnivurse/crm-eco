import { Card, CardContent } from '@crm-eco/ui';
import { Clock, CheckCircle, CurrencyDollar } from '@phosphor-icons/react/dist/ssr';

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
      icon: <Clock weight="light" className="w-5 h-5 text-[var(--mp-teal)]" aria-hidden />,
      bgClass: 'bg-[var(--mp-mist)]',
      textClass: 'text-[var(--mp-ink)]',
    },
    {
      label: 'Approved',
      value: approvedCount,
      icon: <CheckCircle weight="light" className="w-5 h-5 text-green-600" aria-hidden />,
      bgClass: 'bg-green-50',
      textClass: 'text-green-900',
    },
    {
      label: 'Paid / Shared',
      value: paidCount,
      icon: <CurrencyDollar weight="light" className="w-5 h-5 text-emerald-600" aria-hidden />,
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
