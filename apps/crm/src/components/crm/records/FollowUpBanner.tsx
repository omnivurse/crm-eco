'use client';

/**
 * Banner shown on a record detail page when one or more open follow-up
 * reminders exist for that record.  Displays the due date, the note, and
 * quick actions (Mark Complete, Snooze 1 week).
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { addWeeks, format, formatDistanceToNow, isPast } from 'date-fns';
import { Bell, BellOff, Check, Clock, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';

interface FollowUpTask {
  id: string;
  title: string;
  due_at: string | null;
  follow_up_note: string | null;
  repeat_interval_days: number | null;
  priority: string;
  status: string;
}

interface FollowUpBannerProps {
  recordId: string;
  className?: string;
  /** Bump this number to force a refetch (e.g. after creating a new reminder). */
  refreshKey?: number;
}

export const FollowUpBanner = memo(function FollowUpBanner({
  recordId,
  className,
  refreshKey = 0,
}: FollowUpBannerProps) {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tasks?record_id=${recordId}&activity_type=follow_up&status=open`,
      );
      if (!res.ok) {
        setTasks([]);
        return;
      }
      const data = await res.json();
      setTasks(
        (data || []).filter(
          (t: FollowUpTask) => t.status === 'open' || t.status === 'in_progress',
        ),
      );
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks, refreshKey]);

  const completeTask = useCallback(
    async (taskId: string) => {
      setActing(taskId);
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            completed_at: new Date().toISOString(),
          }),
        });
        if (!res.ok) throw new Error('Failed');
        toast.success(toastCopy.updated('Follow-up'));
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } catch {
        toast.error(toastCopy.failed('complete the follow-up', undefined, 'Try again'));
      } finally {
        setActing(null);
      }
    },
    [],
  );

  const snoozeTask = useCallback(
    async (taskId: string) => {
      setActing(taskId);
      const newDue = addWeeks(new Date(), 1).toISOString();
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ due_at: newDue }),
        });
        if (!res.ok) throw new Error('Failed');
        toast.success('Snoozed for 1 week');
        void fetchTasks();
      } catch {
        toast.error(toastCopy.failed('snooze the follow-up', undefined, 'Try again'));
      } finally {
        setActing(null);
      }
    },
    [fetchTasks],
  );

  if (loading || tasks.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {tasks.map((task) => {
        const overdue = task.due_at ? isPast(new Date(task.due_at)) : false;
        const isActing = acting === task.id;

        return (
          <div
            key={task.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
              overdue
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30'
                : 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30',
            )}
          >
            <Bell
              className={cn(
                'w-4 h-4 shrink-0',
                overdue ? 'text-amber-500' : 'text-teal-500',
              )}
            />

            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  'font-medium',
                  overdue
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-teal-800 dark:text-teal-300',
                )}
              >
                {overdue ? 'Overdue follow-up' : 'Follow-up reminder'}
              </span>
              {task.due_at && (
                <span className="ml-2 text-slate-600 dark:text-slate-400">
                  {overdue
                    ? `was due ${formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}`
                    : `due ${format(new Date(task.due_at), 'MMM d, yyyy')}`}
                </span>
              )}
              {task.follow_up_note && (
                <span className="ml-2 text-slate-500 dark:text-slate-400 italic">
                  &mdash; {task.follow_up_note}
                </span>
              )}
              {task.repeat_interval_days && task.repeat_interval_days > 0 && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-400">
                  <RotateCw className="w-3 h-3" />
                  every {task.repeat_interval_days}d
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                disabled={isActing}
                onClick={() => snoozeTask(task.id)}
                className="h-7 px-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                {isActing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Snooze 1 wk
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isActing}
                onClick={() => completeTask(task.id)}
                className="h-7 px-2 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              >
                {isActing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
});
