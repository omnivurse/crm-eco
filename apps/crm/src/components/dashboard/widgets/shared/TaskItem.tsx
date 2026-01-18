'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmTask } from '@/lib/crm/types';

interface TaskItemProps {
  task: CrmTask;
}

export function TaskItem({ task }: TaskItemProps) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date();

  return (
    <Link
      href={`/crm/tasks?id=${task.id}`}
      className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200"
    >
      <div
        className={cn(
          'w-2.5 h-2.5 rounded-full shrink-0',
          isOverdue ? 'bg-red-500 animate-pulse' : 'bg-teal-500'
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {task.title}
        </p>
        {task.due_at && (
          <p
            className={cn(
              'text-xs mt-0.5',
              isOverdue
                ? 'text-red-500 font-medium'
                : 'text-slate-400 dark:text-slate-500'
            )}
          >
            {isOverdue
              ? 'Overdue'
              : new Date(task.due_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
