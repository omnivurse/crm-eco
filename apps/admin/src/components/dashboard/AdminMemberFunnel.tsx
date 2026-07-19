import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react/dist/ssr';
import type { AdminConsoleStats } from '@/lib/admin-console-queries';

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  href: string;
  color: string;
}

interface AdminMemberFunnelProps {
  stats: AdminConsoleStats;
}

/**
 * AdminMemberFunnel -- Horizontal lifecycle visualization.
 * Shows Leads -> Draft -> In Progress -> Submitted -> Active with counts.
 */
export function AdminMemberFunnel({ stats }: AdminMemberFunnelProps) {
  const { pipelineCounts, memberStats } = stats;

  const stages: FunnelStage[] = [
    {
      key: 'leads',
      label: 'Leads',
      count: pipelineCounts.leads,
      href: '/members?status=lead',
      color: 'bg-slate-500 hover:bg-slate-400',
    },
    {
      key: 'draft',
      label: 'Draft',
      count: pipelineCounts.draft,
      href: '/enrollments?status=draft',
      color: 'bg-slate-600 hover:bg-slate-500',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      count: pipelineCounts.inProgress,
      href: '/enrollments?status=in_progress',
      color: 'bg-blue-500/80 hover:bg-blue-500',
    },
    {
      key: 'submitted',
      label: 'Submitted',
      count: pipelineCounts.submitted,
      href: '/enrollments?status=submitted',
      color: 'bg-amber-500/80 hover:bg-amber-500',
    },
    {
      key: 'active',
      label: 'Active',
      count: memberStats.active,
      href: '/members?status=active',
      color: 'bg-emerald-500/80 hover:bg-emerald-500',
    },
  ];

  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="adm-bezel h-full">
      <div className="adm-bezel-inner p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--adm-ink)]">
            Member Lifecycle
          </h3>
          <span className="text-xs text-[var(--adm-muted)]">
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
        <div className="mt-3 flex items-center justify-between">
          {stages.map((stage, idx) => (
            <div key={stage.key} className="flex items-center">
              <span className="text-[10px] font-medium text-[var(--adm-muted)]">
                {stage.label}
              </span>
              {idx < stages.length - 1 && (
                <CaretRight weight="light" className="mx-1 h-3 w-3 text-[var(--adm-muted)]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
