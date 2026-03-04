import { Shield } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import type { WidgetSize } from '@/lib/dashboard/types';

interface NetworkCoverage {
  id: string;
  network_name: string;
  network_type: string;
  network_coverage_zips: Array<{
    coverage_score: number;
    provider_count: number;
  }>;
}

interface NetworkCoverageHealthWidgetProps {
  data: NetworkCoverage[] | null;
  size: WidgetSize;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

function getBarColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 70) return 'bg-blue-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function NetworkCoverageHealthWidget({
  data,
  size,
}: NetworkCoverageHealthWidgetProps) {
  const networks = data || [];
  const maxRows = size === 'medium' ? 5 : 8;

  return (
    <WidgetCard
      title="Network Coverage Health"
      subtitle="Coverage scores by network"
      icon={<Shield className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500"
      badge={`${networks.length} networks`}
    >
      {networks.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No network data available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {networks.slice(0, maxRows).map((network) => {
            const zips = network.network_coverage_zips || [];
            const avgScore =
              zips.length > 0
                ? zips.reduce((sum, z) => sum + z.coverage_score, 0) / zips.length
                : 0;
            const totalProviders = zips.reduce(
              (sum, z) => sum + z.provider_count,
              0
            );
            const grade = getGrade(avgScore);

            return (
              <div
                key={network.id}
                className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${GRADE_COLORS[grade]}`}
                  >
                    {grade}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {network.network_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {network.network_type.toUpperCase()} &middot;{' '}
                      {totalProviders} providers
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {avgScore.toFixed(0)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(avgScore)}`}
                    style={{ width: `${Math.min(avgScore, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
