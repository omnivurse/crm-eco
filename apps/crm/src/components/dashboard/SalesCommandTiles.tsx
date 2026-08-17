import Link from 'next/link';
import {
  Target,
  UserPlus,
  Activity,
  Users,
} from 'lucide-react';
import type { ModuleStats } from '@/lib/crm/types';

interface MetricRow {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface TileConfig {
  title: string;
  icon: typeof Target;
  accent: string;
  metrics: MetricRow[];
  href: string;
}

function SalesTile({ tile }: { tile: TileConfig }) {
  const Icon = tile.icon;

  return (
    <Link
      href={tile.href}
      aria-label={tile.title}
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 border-l-4 ${tile.accent} p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] hover:border-teal-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 block`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </div>
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {tile.title}
        </h3>
      </div>

      <div className="space-y-3">
        {tile.metrics.map((metric) => (
          <div key={metric.label} className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</span>
            <span
              className={`text-lg font-bold tabular-nums ${
                metric.highlight
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}

interface SalesCommandTilesProps {
  moduleStats: ModuleStats[];
  heroStats: {
    todaysTaskCount: number;
    overdueCount: number;
    atRiskCount: number;
    newThisWeek: number;
  };
  reportSummary: {
    dealsClosedThisWeek: number;
    conversionRate: number;
  } | null;
}

/**
 * SalesCommandTiles -- 4-column CRM-focused metric grid.
 * Shows Deals Pipeline, Lead Flow, My Activity, and Relationships.
 */
export function SalesCommandTiles({ moduleStats, heroStats, reportSummary }: SalesCommandTilesProps) {
  const deals = moduleStats.find((s) => s.moduleKey === 'deals');
  const leads = moduleStats.find((s) => s.moduleKey === 'leads');
  const contacts = moduleStats.find((s) => s.moduleKey === 'contacts');
  const accounts = moduleStats.find((s) => s.moduleKey === 'accounts');

  const tiles: TileConfig[] = [
    {
      title: 'Deals Pipeline',
      icon: Target,
      accent: 'border-l-teal-500',
      href: '/crm/pipeline',
      metrics: [
        { label: 'Open Deals', value: deals?.totalRecords ?? 0, highlight: true },
        { label: 'Closed This Week', value: reportSummary?.dealsClosedThisWeek ?? 0 },
        { label: 'At-Risk Deals', value: heroStats.atRiskCount, highlight: heroStats.atRiskCount > 0 },
      ],
    },
    {
      title: 'Lead Flow',
      icon: UserPlus,
      accent: 'border-l-blue-500',
      href: '/crm/modules/leads',
      metrics: [
        { label: 'Active Leads', value: leads?.totalRecords ?? 0, highlight: true },
        { label: 'New This Week', value: leads?.createdThisWeek ?? 0 },
        { label: 'Conversion Rate', value: `${reportSummary?.conversionRate ?? 0}%` },
      ],
    },
    {
      title: 'My Activity',
      icon: Activity,
      accent: 'border-l-violet-500',
      href: '/crm/activities',
      metrics: [
        { label: 'Tasks Today', value: heroStats.todaysTaskCount, highlight: heroStats.todaysTaskCount > 0 },
        { label: 'Overdue', value: heroStats.overdueCount, highlight: heroStats.overdueCount > 0 },
        { label: 'New This Week', value: heroStats.newThisWeek },
      ],
    },
    {
      title: 'Relationships',
      icon: Users,
      accent: 'border-l-emerald-500',
      href: '/crm/modules/contacts',
      metrics: [
        { label: 'Contacts', value: contacts?.totalRecords ?? 0, highlight: true },
        { label: 'Accounts', value: accounts?.totalRecords ?? 0 },
        { label: 'New This Week', value: (contacts?.createdThisWeek ?? 0) + (accounts?.createdThisWeek ?? 0) },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((tile) => (
        <SalesTile key={tile.title} tile={tile} />
      ))}
    </div>
  );
}
