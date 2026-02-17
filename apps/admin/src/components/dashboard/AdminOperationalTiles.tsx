import {
  Users,
  DollarSign,
  Award,
  Cpu,
} from 'lucide-react';
import type { AdminConsoleStats } from '@/lib/admin-console-queries';

interface MetricRow {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface TileConfig {
  title: string;
  icon: typeof Users;
  accent: string;
  metrics: MetricRow[];
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function OperationalTile({ tile }: { tile: TileConfig }) {
  const Icon = tile.icon;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 border-l-4 ${tile.accent} p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]`}>
      {/* Tile header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </div>
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {tile.title}
        </h3>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {tile.metrics.map((metric) => (
          <div key={metric.label} className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</span>
            <span
              className={`text-lg font-bold tabular-nums ${
                metric.highlight ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminOperationalTilesProps {
  stats: AdminConsoleStats;
}

/**
 * AdminOperationalTiles -- 4-column grid of admin-specific metric groups.
 * Membership, Revenue, Commissions, System.
 */
export function AdminOperationalTiles({ stats }: AdminOperationalTilesProps) {
  const { memberStats, billingStats, commissionStats, systemStats } = stats;

  const tiles: TileConfig[] = [
    {
      title: 'Membership',
      icon: Users,
      accent: 'border-l-teal-500',
      metrics: [
        { label: 'Total Members', value: memberStats.total, highlight: true },
        { label: 'Active Members', value: memberStats.active },
        { label: 'New This Month', value: memberStats.newThisMonth },
      ],
    },
    {
      title: 'Revenue',
      icon: DollarSign,
      accent: 'border-l-emerald-500',
      metrics: [
        { label: 'Collected Today', value: formatCurrency(billingStats.collectedToday), highlight: billingStats.collectedToday > 0 },
        { label: 'Monthly Recurring', value: formatCurrency(billingStats.mrr) },
        { label: 'Failed Payments', value: billingStats.failedToday, highlight: billingStats.failedToday > 0 },
      ],
    },
    {
      title: 'Commissions',
      icon: Award,
      accent: 'border-l-amber-500',
      metrics: [
        { label: 'Pending Amount', value: formatCurrency(commissionStats.pendingAmount), highlight: commissionStats.pendingAmount > 0 },
        { label: 'Paid This Month', value: formatCurrency(commissionStats.paidThisMonth) },
        { label: 'Pending Payouts', value: commissionStats.pendingPayouts },
      ],
    },
    {
      title: 'System',
      icon: Cpu,
      accent: 'border-l-red-500',
      metrics: [
        { label: 'Failed Jobs (24h)', value: systemStats.failedJobs24h, highlight: systemStats.failedJobs24h > 0 },
        { label: 'Running Jobs', value: systemStats.runningJobs },
        { label: 'Pending Jobs', value: systemStats.pendingJobs },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((tile) => (
        <OperationalTile key={tile.title} tile={tile} />
      ))}
    </div>
  );
}
