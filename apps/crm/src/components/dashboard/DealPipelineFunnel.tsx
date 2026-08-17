import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ModuleStats } from '@/lib/crm/types';

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  href: string;
  color: string;
}

interface DealPipelineFunnelProps {
  moduleStats: ModuleStats[];
  reportSummary: {
    totalLeads: number;
    totalDeals: number;
    totalContacts: number;
    dealsClosedThisWeek: number;
    conversionRate: number;
  } | null;
}

/**
 * DealPipelineFunnel -- CRM deal pipeline visualization.
 * Shows the sales journey from Leads through to closed Deals.
 */
export function DealPipelineFunnel({ moduleStats, reportSummary }: DealPipelineFunnelProps) {
  const leads = moduleStats.find((s) => s.moduleKey === 'leads');
  const prospects = moduleStats.find((s) => s.moduleKey === 'prospects');
  const contacts = moduleStats.find((s) => s.moduleKey === 'contacts');
  const deals = moduleStats.find((s) => s.moduleKey === 'deals');
  const accounts = moduleStats.find((s) => s.moduleKey === 'accounts');

  const stages: FunnelStage[] = [
    {
      key: 'leads',
      label: 'Leads',
      count: leads?.totalRecords ?? 0,
      href: '/crm/modules/leads',
      color: 'bg-slate-700 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500',
    },
    {
      key: 'prospects',
      label: 'Prospects',
      count: prospects?.totalRecords ?? 0,
      href: '/crm/modules/leads',
      color: 'bg-primary/80 hover:bg-primary dark:bg-primary/80 dark:hover:bg-primary',
    },
    {
      key: 'contacts',
      label: 'Contacts',
      count: contacts?.totalRecords ?? 0,
      href: '/crm/modules/contacts',
      color: 'bg-violet-600/80 hover:bg-violet-600 dark:bg-violet-700/80 dark:hover:bg-violet-600',
    },
    {
      key: 'deals',
      label: 'Deals',
      count: deals?.totalRecords ?? 0,
      href: '/crm/modules/deals',
      color: 'bg-amber-600/80 hover:bg-amber-600 dark:bg-amber-700/80 dark:hover:bg-amber-600',
    },
    {
      key: 'accounts',
      label: 'Accounts',
      count: accounts?.totalRecords ?? 0,
      href: '/crm/modules/accounts',
      color: 'bg-emerald-600/80 hover:bg-emerald-600 dark:bg-emerald-700/80 dark:hover:bg-emerald-600',
    },
  ];

  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);
  const conversionRate = reportSummary?.conversionRate ?? 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Sales Pipeline
        </h3>
        <div className="flex items-center gap-3">
          {conversionRate > 0 && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {conversionRate}% conversion
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {totalCount.toLocaleString()} total
          </span>
        </div>
      </div>

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
