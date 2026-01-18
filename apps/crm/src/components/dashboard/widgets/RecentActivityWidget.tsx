'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { ActivityItem, EmptyState } from './shared';
import type { CrmAuditLog } from '@/lib/crm/types';
import type { WidgetSize } from '@/lib/dashboard/types';

interface RecentActivityWidgetProps {
  data: CrmAuditLog[] | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 4,
  medium: 6,
  large: 8,
  full: 10,
};

export default function RecentActivityWidget({
  data: activity,
  size,
}: RecentActivityWidgetProps) {
  const activities = activity || [];
  const displayCount = sizeToDisplayCount[size] || 6;

  return (
    <WidgetCard
      title="Recent Activity"
      subtitle="Latest actions"
      icon={<Activity className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]"
      headerAction={
        <Link
          href="/crm/activities"
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
        >
          View all
        </Link>
      }
    >
      {activities.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />}
          title="No activity yet"
          subtitle="Actions will appear here"
        />
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {activities.slice(0, displayCount).map((item) => (
            <ActivityItem key={item.id} activity={item} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
