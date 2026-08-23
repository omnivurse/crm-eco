'use client';

/**
 * Record-scoped task list for the V2 Related List rail (Open / Closed Activities).
 */

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';

interface CrmTaskRow {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  activity_type?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
}

export interface RecordTasksPanelProps {
  recordId: string;
  mode: 'open' | 'closed';
  className?: string;
}

const OPEN_STATUSES = ['open', 'in_progress'];

export function RecordTasksPanel({ recordId, mode, className }: RecordTasksPanelProps) {
  const [tasks, setTasks] = useState<CrmTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = mode === 'open' ? OPEN_STATUSES.join(',') : 'completed';
      const res = await fetch(
        `/api/crm/tasks?recordId=${encodeURIComponent(recordId)}&status=${encodeURIComponent(status)}`,
        { credentials: 'same-origin' },
      );
      if (!res.ok) throw new Error('Failed to load activities');
      const data = (await res.json()) as CrmTaskRow[];
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [recordId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const completeTask = async (taskId: string) => {
    setCompletingId(taskId);
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Failed to complete');
      toast.success(toastCopy.updated('Activity'), { description: 'Marked complete' });
      await load();
    } catch (err) {
      toast.error(toastCopy.failed('complete the activity', err, 'Try again'));
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/30 py-10 px-6 text-center',
          className,
        )}
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {mode === 'open' ? 'No open activities' : 'No completed activities'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          {mode === 'open'
            ? 'Use Add Task in the header or Quick Actions to create a call, meeting, or follow-up.'
            : 'Completed tasks and logged emails will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {tasks.map((task) => (
        <li
          key={task.id}
          className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {task.title}
              </p>
              {task.description ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {task.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {task.activity_type ? (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {task.activity_type}
                  </Badge>
                ) : null}
                {task.due_at ? (
                  <span className="text-[10px] text-slate-500">
                    Due {format(new Date(task.due_at), 'MMM d, yyyy')}
                  </span>
                ) : null}
                {task.completed_at ? (
                  <span className="text-[10px] text-slate-500">
                    Done {format(new Date(task.completed_at), 'MMM d, yyyy')}
                  </span>
                ) : null}
              </div>
            </div>
            {mode === 'open' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 h-8"
                disabled={completingId === task.id}
                onClick={() => void completeTask(task.id)}
              >
                {completingId === task.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
