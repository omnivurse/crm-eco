import { LayoutGrid } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { DashboardStats } from '../DashboardStats';
import type { WidgetSize } from '@/lib/dashboard/types';
import type { ModuleStats } from '@/lib/crm/types';

interface ModuleStatsWidgetProps {
  data: ModuleStats[] | null;
  size: WidgetSize;
}

export default function ModuleStatsWidget({
  data,
}: ModuleStatsWidgetProps) {
  return (
    <WidgetCard
      title="Module Stats"
      subtitle="Record counts across your CRM"
      icon={<LayoutGrid className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"
    >
      <DashboardStats stats={data || []} />
    </WidgetCard>
  );
}
