import { Target } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { SalesCommandTiles } from '../SalesCommandTiles';
import type { WidgetSize } from '@/lib/dashboard/types';
import type { ModuleStats } from '@/lib/crm/types';

interface SalesCommandTilesData {
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

interface SalesCommandTilesWidgetProps {
  data: SalesCommandTilesData | null;
  size: WidgetSize;
}

export default function SalesCommandTilesWidget({
  data,
}: SalesCommandTilesWidgetProps) {
  if (!data) return null;

  return (
    <WidgetCard
      title="Sales Overview"
      subtitle="Pipeline, leads, activity & relationships"
      icon={<Target className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500"
    >
      <SalesCommandTiles
        moduleStats={data.moduleStats}
        heroStats={data.heroStats}
        reportSummary={data.reportSummary}
      />
    </WidgetCard>
  );
}
