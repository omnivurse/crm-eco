import {
  Users,
  CurrencyDollar,
  Trophy,
  Cpu,
} from '@phosphor-icons/react/dist/ssr';
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
    <div className="adm-bezel">
      <div className="adm-bezel-inner p-4">
        {/* Tile header */}
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-[rgba(11,109,133,0.06)] p-1.5 dark:bg-white/5">
            <Icon weight="light" className="h-4 w-4" style={{ color: tile.accent }} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--adm-muted)]">
            {tile.title}
          </h3>
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          {tile.metrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline justify-between">
              <span className="text-xs text-[var(--adm-muted)]">{metric.label}</span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  metric.highlight ? 'text-[var(--adm-ink)]' : 'text-[var(--adm-muted)]'
                }`}
              >
                {metric.value}
              </span>
            </div>
          ))}
        </div>
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
      accent: 'var(--adm-teal)',
      metrics: [
        { label: 'Total Members', value: memberStats.total, highlight: true },
        { label: 'Active Members', value: memberStats.active },
        { label: 'New This Month', value: memberStats.newThisMonth },
      ],
    },
    {
      title: 'Revenue',
      icon: CurrencyDollar,
      accent: 'var(--adm-emerald)',
      metrics: [
        { label: 'Collected Today', value: formatCurrency(billingStats.collectedToday), highlight: billingStats.collectedToday > 0 },
        { label: 'Monthly Recurring', value: formatCurrency(billingStats.mrr) },
        { label: 'Failed Payments', value: billingStats.failedToday, highlight: billingStats.failedToday > 0 },
      ],
    },
    {
      title: 'Commissions',
      icon: Trophy,
      accent: 'var(--adm-amber)',
      metrics: [
        { label: 'Pending Amount', value: formatCurrency(commissionStats.pendingAmount), highlight: commissionStats.pendingAmount > 0 },
        { label: 'Paid This Month', value: formatCurrency(commissionStats.paidThisMonth) },
        { label: 'Pending Payouts', value: commissionStats.pendingPayouts },
      ],
    },
    {
      title: 'System',
      icon: Cpu,
      accent: 'var(--adm-rose)',
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
