'use client';

/**
 * CalendarView — monthly grid of CRM records keyed off a date-typed field
 * (expected_close_date on deals, follow_up_date on leads, etc) with an
 * overlay of open tasks (`crm_tasks.due_at`) so reps can see both deal
 * milestones and pending activities in one place.
 *
 * Highlights:
 *   - Month navigation with prev/next and "Today" shortcuts.
 *   - HTML5 drag-and-drop: drop a record chip on another day to PATCH
 *     the underlying date field; drop a task chip to PATCH `crm_tasks.due_at`.
 *   - Pluggable "date field" selector when the module exposes multiple
 *     date/datetime fields.
 *   - Chip color follows the deal-stage catalog (when provided) or the
 *     record's status; tasks get a neutral slate tint with a clock icon.
 *
 * We deliberately build the grid by hand rather than pulling a calendar
 * library — the interactions we care about (drag-reschedule + dense
 * chip rendering) are tricky to customize in most libs and the grid
 * math is only ~30 lines.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import { Button } from '@crm-eco/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRecord, CrmField, CrmDealStage } from '@/lib/crm/types';
import { cachedFetch } from '@/lib/offline/cached-fetch';

export interface CalendarViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  onRowClick?: (recordId: string) => void;
  stages?: CrmDealStage[];
}

interface TaskItem {
  id: string;
  title: string;
  due_at: string | null;
  status: string;
  record_id: string | null;
  activity_type: string | null;
  priority: string | null;
}

interface DragPayload {
  kind: 'record' | 'task';
  id: string;
  field?: string;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Return YYYY-MM-DD in the user's local timezone. */
function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Build a 6-row × 7-col calendar grid spanning the given month. */
function buildGridDays(anchor: Date): Date[] {
  const start = startOfMonth(anchor);
  const gridStart = addDays(start, -start.getDay()); // back up to Sunday
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/**
 * Pick a reasonable date field default for the current module. The order
 * below matches the one users expect in practice: close dates first for
 * deals, then follow-ups for sales work, then generic due dates.
 */
function pickDefaultDateField(
  fields: CrmField[],
  moduleKey: string,
): string | null {
  const dateFields = fields.filter(
    (f) => f.type === 'date' || f.type === 'datetime',
  );
  if (dateFields.length === 0) return null;
  const byKey = (k: string) => dateFields.find((f) => f.key === k);
  if (moduleKey === 'deals') {
    return (
      byKey('expected_close_date')?.key ||
      byKey('close_date')?.key ||
      dateFields[0].key
    );
  }
  return (
    byKey('follow_up_date')?.key ||
    byKey('due_date')?.key ||
    byKey('next_action_date')?.key ||
    dateFields[0].key
  );
}

function getRecordDate(record: CrmRecord, fieldKey: string): string | null {
  const raw = record.data?.[fieldKey];
  if (typeof raw !== 'string' || raw.length === 0) return null;
  // ISO datetime strings start with YYYY-MM-DD — slice to 10 chars so the
  // chip lands on the correct day regardless of timezone offset.
  return raw.slice(0, 10);
}

function getRecordTitle(record: CrmRecord): string {
  if (record.title && record.title !== 'Untitled') return record.title;
  const first = record.data?.first_name || '';
  const last = record.data?.last_name || '';
  const full = [first, last].filter(Boolean).join(' ');
  return full || (record.data?.account_name as string) || 'Untitled';
}

/** Resolve chip tint for a record. Stages win over status when available. */
function getRecordAccent(
  record: CrmRecord,
  stages?: CrmDealStage[],
): { bg: string; border: string; dot: string } {
  if (stages && record.stage) {
    const match = stages.find((s) => s.key === record.stage);
    if (match?.is_won)
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        border: 'border-emerald-200 dark:border-emerald-500/30',
        dot: 'bg-emerald-500',
      };
    if (match?.is_lost)
      return {
        bg: 'bg-rose-50 dark:bg-rose-500/10',
        border: 'border-rose-200 dark:border-rose-500/30',
        dot: 'bg-rose-500',
      };
  }
  const status = String(record.status || '').toLowerCase();
  if (/(won|closed|complete)/.test(status))
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/30',
      dot: 'bg-emerald-500',
    };
  if (/(lost|cancel|reject)/.test(status))
    return {
      bg: 'bg-rose-50 dark:bg-rose-500/10',
      border: 'border-rose-200 dark:border-rose-500/30',
      dot: 'bg-rose-500',
    };
  return {
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    border: 'border-sky-200 dark:border-sky-500/30',
    dot: 'bg-sky-500',
  };
}

export const CalendarView = memo(function CalendarView({
  records: initialRecords,
  fields,
  moduleKey,
  onRowClick,
  stages,
}: CalendarViewProps) {
  const router = useRouter();

  const dateFieldChoices = useMemo(
    () => fields.filter((f) => f.type === 'date' || f.type === 'datetime'),
    [fields],
  );

  const [dateField, setDateField] = useState<string | null>(() =>
    pickDefaultDateField(fields, moduleKey),
  );
  const [anchor, setAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [records, setRecords] = useState(initialRecords);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Keep local state in sync when the parent re-fetches records (filters,
  // search, pagination). Without this, drag-reschedule would mask upstream
  // updates.
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  const gridDays = useMemo(() => buildGridDays(anchor), [anchor]);
  const monthStart = gridDays[0];
  const monthEnd = gridDays[gridDays.length - 1];
  const todayKey = toDayKey(new Date());

  // Fetch open tasks for the visible range. We scope by date and by
  // "active" statuses so completed tasks don't clutter the grid.
  useEffect(() => {
    let cancelled = false;
    setTasksLoading(true);
    const params = new URLSearchParams({
      start: new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        monthStart.getDate(),
      ).toISOString(),
      end: new Date(
        monthEnd.getFullYear(),
        monthEnd.getMonth(),
        monthEnd.getDate(),
        23,
        59,
        59,
      ).toISOString(),
      status: 'open,in_progress',
    });
    (async () => {
      try {
        // SWR via the offline cache: resolve immediately from IDB if
        // we already rendered this month on a previous visit, then
        // swap in the fresh payload when the network response lands.
        // Offline users see last-known tasks instead of an empty grid.
        const { value } = await cachedFetch<TaskItem[]>({
          key: `crm:tasks:calendar:${params.toString()}`,
          url: `/api/crm/tasks?${params.toString()}`,
          ttlMs: 1000 * 60 * 5,
          onFresh: (next) => {
            if (!cancelled) setTasks(next ?? []);
          },
        });
        if (!cancelled) setTasks(value ?? []);
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthStart, monthEnd]);

  // Group records and tasks by day key for O(1) cell lookups.
  const recordsByDay = useMemo(() => {
    const map = new Map<string, CrmRecord[]>();
    if (!dateField) return map;
    for (const r of records) {
      const day = getRecordDate(r, dateField);
      if (!day) continue;
      const bucket = map.get(day) ?? [];
      bucket.push(r);
      map.set(day, bucket);
    }
    return map;
  }, [records, dateField]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const day = toDayKey(new Date(t.due_at));
      const bucket = map.get(day) ?? [];
      bucket.push(t);
      map.set(day, bucket);
    }
    return map;
  }, [tasks]);

  // --- Drag & drop ---
  const draggingRef = useRef<DragPayload | null>(null);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLAnchorElement | HTMLDivElement>, payload: DragPayload) => {
      draggingRef.current = payload;
      e.dataTransfer.effectAllowed = 'move';
      // DataTransfer payload is only needed for spec compliance; we
      // reference the ref for the real state.
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const rescheduleRecord = useCallback(
    async (recordId: string, dayKey: string) => {
      if (!dateField) return;
      const prev = records.find((r) => r.id === recordId);
      if (!prev) return;
      const currentDay = getRecordDate(prev, dateField);
      if (currentDay === dayKey) return;

      setRecords((curr) =>
        curr.map((r) =>
          r.id === recordId
            ? { ...r, data: { ...r.data, [dateField]: dayKey } }
            : r,
        ),
      );
      try {
        const res = await fetch(`/api/crm/records/${recordId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ data: { [dateField]: dayKey } }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(toastCopy.updated('Date'));
      } catch (err) {
        setRecords((curr) =>
          curr.map((r) => (r.id === recordId ? prev : r)),
        );
        toast.error(toastCopy.failed('reschedule the record', err, 'It was put back — try again'));
      }
    },
    [dateField, records],
  );

  const rescheduleTask = useCallback(
    async (taskId: string, dayKey: string) => {
      const prev = tasks.find((t) => t.id === taskId);
      if (!prev) return;
      // Preserve the time-of-day component if the task already had one;
      // otherwise default to 09:00 local so the task shows up in most
      // "today" lists without being a midnight oddity.
      const previousTime = prev.due_at ? new Date(prev.due_at) : null;
      const [y, m, d] = dayKey.split('-').map(Number);
      const nextDate = new Date(
        y,
        m - 1,
        d,
        previousTime?.getHours() ?? 9,
        previousTime?.getMinutes() ?? 0,
        0,
        0,
      );
      const nextIso = nextDate.toISOString();
      if (prev.due_at === nextIso) return;

      setTasks((curr) =>
        curr.map((t) => (t.id === taskId ? { ...t, due_at: nextIso } : t)),
      );
      try {
        const res = await fetch(`/api/crm/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ due_at: nextIso }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(toastCopy.updated('Task'), { description: 'Rescheduled' });
      } catch (err) {
        setTasks((curr) =>
          curr.map((t) => (t.id === taskId ? prev : t)),
        );
        toast.error(toastCopy.failed('reschedule the task', err, 'It was put back — try again'));
      }
    },
    [tasks],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, dayKey: string) => {
      e.preventDefault();
      const payload = draggingRef.current;
      draggingRef.current = null;
      if (!payload) return;
      if (payload.kind === 'record') {
        void rescheduleRecord(payload.id, dayKey);
      } else {
        void rescheduleTask(payload.id, dayKey);
      }
    },
    [rescheduleRecord, rescheduleTask],
  );

  const handleRecordClick = useCallback(
    (id: string) => {
      if (onRowClick) onRowClick(id);
      else router.push(`/crm/r/${id}`);
    },
    [onRowClick, router],
  );

  const monthLabel = anchor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  if (!dateField) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
          <CalendarDays className="w-10 h-10 text-slate-400 dark:text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">
          No date fields on this module
        </p>
        <p className="text-sm text-slate-500">
          Add a date or datetime field to plot records on the calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setAnchor((a) => addMonths(a, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[150px] text-center text-sm font-semibold text-slate-900 dark:text-white">
            {monthLabel}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setAnchor((a) => addMonths(a, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setAnchor(startOfMonth(new Date()))}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Plot by
          </span>
          <Select
            value={dateField}
            onValueChange={(v) => setDateField(v)}
          >
            <SelectTrigger className="h-8 w-[200px] text-sm rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateFieldChoices.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tasksLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : null}
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-1 text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 grid-rows-6 gap-px rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-200 dark:bg-white/10">
        {gridDays.map((day) => {
          const key = toDayKey(day);
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const dayRecords = recordsByDay.get(key) ?? [];
          const dayTasks = tasksByDay.get(key) ?? [];
          const totalItems = dayRecords.length + dayTasks.length;
          const visibleRecords = dayRecords.slice(0, 3);
          const visibleTasks = dayTasks.slice(0, 2);
          const overflow = totalItems - visibleRecords.length - visibleTasks.length;

          return (
            <div
              key={key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, key)}
              className={cn(
                'min-h-[120px] p-1.5 flex flex-col gap-1 transition-colors',
                inMonth
                  ? 'bg-white dark:bg-slate-900'
                  : 'bg-slate-50 dark:bg-slate-900/60',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full text-xs font-medium',
                    isToday
                      ? 'bg-teal-500 text-white w-5 h-5'
                      : inMonth
                        ? 'text-slate-700 dark:text-slate-300 w-5 h-5'
                        : 'text-slate-400 dark:text-slate-600 w-5 h-5',
                  )}
                >
                  {day.getDate()}
                </span>
                {totalItems > 0 ? (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {totalItems}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                {visibleRecords.map((r) => {
                  const accent = getRecordAccent(r, stages);
                  return (
                    <Link
                      key={r.id}
                      href={`/crm/r/${r.id}`}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, {
                          kind: 'record',
                          id: r.id,
                          field: dateField,
                        })
                      }
                      onClick={(e) => {
                        if (onRowClick) {
                          e.preventDefault();
                          handleRecordClick(r.id);
                        }
                      }}
                      className={cn(
                        'group flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium leading-tight cursor-grab active:cursor-grabbing',
                        accent.bg,
                        accent.border,
                        'text-slate-800 dark:text-slate-100 hover:ring-1 hover:ring-teal-400/60',
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          accent.dot,
                        )}
                      />
                      <span className="truncate">{getRecordTitle(r)}</span>
                    </Link>
                  );
                })}
                {visibleTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(e, { kind: 'task', id: t.id })
                    }
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/60 text-[11px] leading-tight text-slate-700 dark:text-slate-200 cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-teal-400/60"
                    title={t.title}
                  >
                    <Clock className="w-3 h-3 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
                {overflow > 0 ? (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 px-1.5">
                    +{overflow} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend / empty hint */}
      {records.length === 0 && tasks.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
          <Inbox className="w-3.5 h-3.5" />
          No records or tasks in this range. Try a different month or loosen your filters.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 px-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500" /> Records
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Open tasks
          </span>
          <span className="ml-auto">Drag a chip to another day to reschedule.</span>
        </div>
      )}
    </div>
  );
});
