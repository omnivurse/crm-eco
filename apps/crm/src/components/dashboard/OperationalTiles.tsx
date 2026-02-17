import {
  FileText,
  DollarSign,
  HeartPulse,
  Settings,
} from 'lucide-react';
import type { CommandConsoleStats } from '@/lib/crm/queries';

interface MetricRow {
  label: string;
  value: string | number;
  /** Optional: override text color for emphasis */
  highlight?: boolean;
}

interface TileConfig {
  title: string;
  icon: typeof FileText;
  accent: string;
  metrics: MetricRow[];
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function OperationalTile({ tile }: { tile: TileConfig }) {
  const Icon = tile.icon;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 border-l-4 ${tile.accent} p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]`}>
      {/* Tile header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-slate-100">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {tile.title}
        </h3>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {tile.metrics.map((metric) => (
          <div key={metric.label} className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">{metric.label}</span>
            <span
              className={`text-lg font-bold tabular-nums ${
                metric.highlight ? 'text-slate-900' : 'text-slate-700'
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

interface OperationalTilesProps {
  stats: CommandConsoleStats;
}

/**
 * OperationalTiles -- 4-column grid of domain-specific metric groups.
 * Replaces the generic Tasks/Overdue/New/At Risk KPI cards.
 */
export function OperationalTiles({ stats }: OperationalTilesProps) {
  const { enrollmentStats, billingStats, operationsStats } = stats;

  const tiles: TileConfig[] = [
    {
      title: 'Enrollment Activity',
      icon: FileText,
      accent: 'border-l-teal-500',
      metrics: [
        { label: 'Started Today', value: enrollmentStats.startedToday, highlight: enrollmentStats.startedToday > 0 },
        { label: 'Submitted Today', value: enrollmentStats.submittedToday },
        { label: 'Activated Today', value: enrollmentStats.activatedToday },
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
      title: 'Member Health',
      icon: HeartPulse,
      accent: 'border-l-amber-500',
      metrics: [
        { label: 'Pending Underwriting', value: enrollmentStats.pendingUnderwriting },
        { label: 'Docs Required', value: enrollmentStats.docsRequired, highlight: enrollmentStats.docsRequired > 0 },
        { label: 'Activation Delayed', value: enrollmentStats.activationDelayed },
      ],
    },
    {
      title: 'Operations',
      icon: Settings,
      accent: 'border-l-red-500',
      metrics: [
        { label: 'Overdue Tasks', value: operationsStats.overdueTasks, highlight: operationsStats.overdueTasks > 0 },
        { label: 'At-Risk Deals', value: operationsStats.atRiskDeals },
        { label: 'Pending ACH', value: billingStats.pendingAch },
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
