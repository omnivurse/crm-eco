import { BarChart3 } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { DealPipelineFunnel } from '../DealPipelineFunnel';
import type { WidgetSize } from '@/lib/dashboard/types';
import type { ModuleStats } from '@/lib/crm/types';

interface PipelineFunnelData {
  moduleStats: ModuleStats[];
  reportSummary: {
    totalLeads: number;
    totalDeals: number;
    totalContacts: number;
    dealsClosedThisWeek: number;
    conversionRate: number;
  } | null;
}

interface PipelineFunnelWidgetProps {
  data: PipelineFunnelData | null;
  size: WidgetSize;
}

export default function PipelineFunnelWidget({
  data,
}: PipelineFunnelWidgetProps) {
  if (!data) return null;

  return (
    <WidgetCard
      title="Sales Pipeline"
      subtitle="Lead to deal conversion funnel"
      icon={<BarChart3 className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500"
    >
      <DealPipelineFunnel
        moduleStats={data.moduleStats}
        reportSummary={data.reportSummary}
      />
    </WidgetCard>
  );
}
