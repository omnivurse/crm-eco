'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sun, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { TaskItem, EmptyState } from './shared';
import type { CrmTask } from '@/lib/crm/types';
import type { WidgetSize } from '@/lib/dashboard/types';

interface TodaysTasksWidgetProps {
  data: CrmTask[] | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 3,
  medium: 5,
  large: 8,
  full: 10,
};

export default function TodaysTasksWidget({
  data: todaysTasks,
  size,
}: TodaysTasksWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const tasks = todaysTasks || [];
  const overdueTasks = tasks.filter(
    (t) => t.due_at && new Date(t.due_at) < new Date()
  );
  const displayCount = sizeToDisplayCount[size] || 5;

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayString = mounted
    ? new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : 'Today';

  return (
    <WidgetCard
      title="Today's Tasks"
      subtitle={todayString}
      icon={<Sun className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500"
      badge={
        tasks.length > 0
          ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`
          : undefined
      }
      badgeColor="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
      footer={
        tasks.length > displayCount ? (
          <Link
            href="/crm/tasks"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View all {tasks.length} tasks
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {tasks.length === 0 ? (
        <EmptyState
          icon={
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          }
          title="All clear!"
          subtitle="No tasks scheduled for today"
        />
      ) : (
        <div className="space-y-1">
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 mb-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {overdueTasks.length} overdue task
                {overdueTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {tasks.slice(0, displayCount).map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
