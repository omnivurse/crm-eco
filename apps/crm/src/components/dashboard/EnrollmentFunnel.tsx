import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { CommandConsoleStats } from '@/lib/crm/queries';

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  href: string;
  color: string;
}

interface EnrollmentFunnelProps {
  stats: CommandConsoleStats;
}

/**
 * EnrollmentFunnel -- Horizontal pipeline visualization.
 * Shows Leads -> Draft -> In Progress -> Submitted -> Approved with counts.
 */
export function EnrollmentFunnel({ stats }: EnrollmentFunnelProps) {
  const { pipelineCounts } = stats;

  const stages: FunnelStage[] = [
    {
      key: 'leads',
      label: 'Leads',
      count: pipelineCounts.leads,
      href: '/crm/modules/leads',
      color: 'bg-slate-700 hover:bg-slate-600',
    },
    {
      key: 'draft',
      label: 'Draft',
      count: pipelineCounts.draft,
      href: '/crm/modules/contacts',
      color: 'bg-slate-600 hover:bg-slate-500',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      count: pipelineCounts.inProgress,
      href: '/crm/modules/contacts',
      color: 'bg-primary/80 hover:bg-primary',
    },
    {
      key: 'submitted',
      label: 'Submitted',
      count: pipelineCounts.submitted,
      href: '/crm/modules/contacts',
      color: 'bg-amber-600/80 hover:bg-amber-600',
    },
    {
      key: 'approved',
      label: 'Activated',
      count: pipelineCounts.approved,
      href: '/crm/modules/contacts',
      color: 'bg-emerald-600/80 hover:bg-emerald-600',
    },
  ];

  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Member Lifecycle
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {totalCount.toLocaleString()} total
        </span>
      </div>

      {/* Funnel bar */}
      <div className="flex items-stretch gap-1 rounded-lg overflow-hidden h-14">
        {stages.map((stage, idx) => {
          const widthPercent = totalCount > 0
            ? Math.max((stage.count / totalCount) * 100, 8)
            : 20;

          return (
            <Link
              key={stage.key}
              href={stage.href}
              className={`
                relative flex flex-col items-center justify-center
                ${stage.color} transition-colors duration-200
                ${idx === 0 ? 'rounded-l-lg' : ''}
                ${idx === stages.length - 1 ? 'rounded-r-lg' : ''}
              `}
              style={{ width: `${widthPercent}%`, minWidth: '60px' }}
            >
              <span className="text-lg font-bold text-white tabular-nums leading-none">
                {stage.count}
              </span>
              <span className="text-[10px] font-medium text-white/70 mt-0.5">
                {stage.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Stage labels with chevrons */}
      <div className="flex items-center justify-between mt-3">
        {stages.map((stage, idx) => (
          <div key={stage.key} className="flex items-center">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {stage.label}
            </span>
            {idx < stages.length - 1 && (
              <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-600 mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
