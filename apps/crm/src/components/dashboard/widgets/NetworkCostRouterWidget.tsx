import { DollarSign, TrendingDown } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';

interface CheapestProvider {
  provider_name: string;
  city: string;
  state: string;
  network_tier: string;
  cash_price: number;
  effective_price: number;
  savings_vs_cash: number;
  distance_miles: number | null;
}

interface NetworkCostRouterWidgetProps {
  data: CheapestProvider[] | null;
  size: WidgetSize;
}

export default function NetworkCostRouterWidget({
  data,
  size,
}: NetworkCostRouterWidgetProps) {
  const providers = data || [];
  const maxRows = size === 'medium' ? 3 : 5;

  return (
    <WidgetCard
      title="Cost-Optimized Routing"
      subtitle="Cheapest in-network options"
      icon={<DollarSign className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-green-500 via-emerald-500 to-green-500"
      badge={providers.length > 0 ? `${providers.length} options` : undefined}
    >
      {providers.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No pricing data available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.slice(0, maxRows).map((provider, index) => (
            <div
              key={`${provider.provider_name}-${index}`}
              className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {provider.provider_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {provider.city}, {provider.state}
                    {provider.distance_miles != null && (
                      <> &middot; {provider.distance_miles} mi</>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${provider.effective_price.toFixed(2)}
                  </p>
                  {provider.savings_vs_cash > 0 && (
                    <div className="flex items-center gap-0.5 justify-end">
                      <TrendingDown className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        ${provider.savings_vs_cash.toFixed(0)} saved
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    provider.network_tier === 'in_network_preferred'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}
                >
                  {provider.network_tier === 'in_network_preferred'
                    ? 'Preferred'
                    : 'In-Network'}
                </span>
                <span className="text-[10px] text-slate-400 line-through">
                  ${provider.cash_price.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
