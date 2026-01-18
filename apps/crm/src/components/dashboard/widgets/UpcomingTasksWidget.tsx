'use client';

import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { TaskItem, EmptyState } from './shared';
import type { CrmTask } from '@/lib/crm/types';
import type { WidgetSize } from '@/lib/dashboard/types';

interface UpcomingTasksWidgetProps {
  data: CrmTask[] | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 3,
  medium: 5,
  large: 8,
  full: 10,
};

export default function UpcomingTasksWidget({
  data: upcomingTasks,
  size,
}: UpcomingTasksWidgetProps) {
  const tasks = upcomingTasks || [];
  const displayCount = sizeToDisplayCount[size] || 5;

  return (
    <WidgetCard
      title="Upcoming Tasks"
      subtitle="Next 7 days"
      icon={<Calendar className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500"
      badge={
        tasks.length > 0
          ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`
          : undefined
      }
      badgeColor="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
      footer={
        tasks.length > displayCount ? (
          <Link
            href="/crm/tasks"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View all tasks
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {tasks.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />}
          title="No upcoming tasks"
          subtitle="Tasks for the next 7 days will appear here"
        />
      ) : (
        <div className="space-y-1">
          {tasks.slice(0, displayCount).map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
