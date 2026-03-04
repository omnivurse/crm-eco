import { Building2 } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';

interface ProviderStat {
  network_tier: string;
}

interface NetworkProviderStatsWidgetProps {
  data: ProviderStat[] | null;
  size: WidgetSize;
}

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  in_network_preferred: {
    label: 'Preferred',
    color: 'bg-emerald-500',
  },
  in_network: {
    label: 'In-Network',
    color: 'bg-blue-500',
  },
  out_of_network: {
    label: 'Out-of-Network',
    color: 'bg-slate-400',
  },
};

export default function NetworkProviderStatsWidget({
  data,
}: NetworkProviderStatsWidgetProps) {
  const providers = data || [];
  const total = providers.length;

  const tierCounts: Record<string, number> = {};
  for (const p of providers) {
    tierCounts[p.network_tier] = (tierCounts[p.network_tier] || 0) + 1;
  }

  return (
    <WidgetCard
      title="Network Provider Stats"
      subtitle="Providers by tier"
      icon={<Building2 className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"
      badge={`${total} total`}
    >
      {total === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No provider data available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total stat */}
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {total.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Total Network Providers
            </p>
          </div>

          {/* Tier breakdown */}
          <div className="space-y-3">
            {Object.entries(TIER_CONFIG).map(([tier, config]) => {
              const count = tierCounts[tier] || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {config.label}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${config.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
