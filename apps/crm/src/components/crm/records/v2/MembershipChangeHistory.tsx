'use client';

/**
 * MembershipChangeHistory — A card showing plan change history for
 * healthshare/insurance records. Changes are stored as an array in the
 * record's JSONB `data.membership_changes`.
 *
 * Each entry records: change type (upgrade/downgrade/lateral/cancellation),
 * effective date, from/to plan, IUA, monthly amounts, and free-text notes.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightCircle,
  XCircle,
  PlusCircle,
  ClipboardList,
  CalendarDays,
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronsUpDown,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { format, parseISO } from 'date-fns';
import { useRecordFieldSaveOptional } from '@/hooks/useRecordFieldSave';
import {
  buildPlanChangeFollowUpTask,
  shouldCreatePlanChangeFollowUp,
} from '@/lib/crm/plan-change-follow-up';
import { persistPlanChangeWithFollowUp } from '@/lib/crm/plan-change-follow-up-flow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MembershipChangeType =
  | 'upgrade'
  | 'downgrade'
  | 'lateral'
  | 'enrollment'
  | 'cancellation';

export interface MembershipChange {
  id: string;
  date: string; // ISO date
  type: MembershipChangeType;
  from_plan?: string;
  to_plan?: string;
  from_iua?: string;
  to_iua?: string;
  from_monthly?: string;
  to_monthly?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  /** Linked follow-up task created for a future/today effective date. */
  follow_up_task_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANGE_TYPE_META: Record<
  MembershipChangeType,
  { label: string; icon: typeof ArrowUpCircle; color: string; bg: string }
> = {
  upgrade: {
    label: 'Upgrade',
    icon: ArrowUpCircle,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  downgrade: {
    label: 'Downgrade',
    icon: ArrowDownCircle,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  lateral: {
    label: 'Lateral Move',
    icon: ArrowRightCircle,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
  },
  enrollment: {
    label: 'Original Enrollment',
    icon: PlusCircle,
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
  },
  cancellation: {
    label: 'Cancellation',
    icon: XCircle,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
};

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function formatCurrency(v?: string): string {
  if (!v) return '';
  const num = Number(v.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return v;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// ---------------------------------------------------------------------------
// Single change entry
// ---------------------------------------------------------------------------

function ChangeEntry({
  change,
  onEdit,
  onDelete,
  readOnly,
}: {
  change: MembershipChange;
  onEdit?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const meta = CHANGE_TYPE_META[change.type] ?? CHANGE_TYPE_META.lateral;
  const Icon = meta.icon;

  const hasTransition =
    change.from_plan || change.to_plan || change.from_iua || change.to_iua ||
    change.from_monthly || change.to_monthly;

  return (
    <div className="relative flex gap-3 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center mt-0.5">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            meta.bg,
          )}
        >
          <Icon className={cn('w-4 h-4', meta.color)} />
        </div>
        {/* connector line will be added via sibling styling */}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-semibold uppercase tracking-wide border',
              meta.color,
              meta.bg,
              meta.color.replace('text-', 'border-').replace('500', '500/30'),
            )}
          >
            {meta.label}
          </Badge>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {formatDate(change.date)}
          </span>
          {change.follow_up_task_id && (
            <span
              className="text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1"
              title="Follow-up reminder linked"
            >
              <Bell className="w-3 h-3" />
              Reminder set
            </span>
          )}

          {!readOnly && (
            <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Edit change"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500"
                  aria-label="Delete change"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {hasTransition && (
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
            {(change.from_plan || change.to_plan) && (
              <p className="flex items-center gap-1.5 flex-wrap">
                {change.from_plan && (
                  <span className="font-medium">{change.from_plan}</span>
                )}
                {change.from_plan && change.to_plan && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
                {change.to_plan && (
                  <span className="font-semibold text-slate-900 dark:text-white">{change.to_plan}</span>
                )}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 dark:text-slate-400">
              {(change.from_iua || change.to_iua) && (
                <span>
                  IUA:{' '}
                  {change.from_iua && (
                    <span className="line-through mr-1 text-slate-400">{formatCurrency(change.from_iua)}</span>
                  )}
                  {change.to_iua && (
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatCurrency(change.to_iua)}
                    </span>
                  )}
                </span>
              )}
              {(change.from_monthly || change.to_monthly) && (
                <span>
                  Monthly:{' '}
                  {change.from_monthly && (
                    <span className="line-through mr-1 text-slate-400">{formatCurrency(change.from_monthly)}</span>
                  )}
                  {change.to_monthly && (
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatCurrency(change.to_monthly)}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {change.notes && (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 italic">
            {change.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit dialog
// ---------------------------------------------------------------------------

interface ChangeFormState {
  type: MembershipChangeType;
  date: string;
  from_plan: string;
  to_plan: string;
  from_iua: string;
  to_iua: string;
  from_monthly: string;
  to_monthly: string;
  notes: string;
}

const EMPTY_FORM: ChangeFormState = {
  type: 'upgrade',
  date: new Date().toISOString().slice(0, 10),
  from_plan: '',
  to_plan: '',
  from_iua: '',
  to_iua: '',
  from_monthly: '',
  to_monthly: '',
  notes: '',
};

function ChangeFormDialog({
  open,
  onClose,
  onSave,
  initial,
  currentData,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (change: MembershipChange, opts: { createFollowUp: boolean }) => void | Promise<void>;
  initial?: MembershipChange | null;
  /** Current record data to auto-populate "from" fields */
  currentData?: Record<string, unknown> | null;
}) {
  const [form, setForm] = useState<ChangeFormState>(() => {
    if (initial) {
      return {
        type: initial.type,
        date: initial.date,
        from_plan: initial.from_plan ?? '',
        to_plan: initial.to_plan ?? '',
        from_iua: initial.from_iua ?? '',
        to_iua: initial.to_iua ?? '',
        from_monthly: initial.from_monthly ?? '',
        to_monthly: initial.to_monthly ?? '',
        notes: initial.notes ?? '',
      };
    }
    // Auto-populate "from" values from current record data
    const d = currentData ?? {};
    return {
      ...EMPTY_FORM,
      type: 'downgrade',
      from_plan:
        (d.product as string) ||
        (d.plan_name as string) ||
        (d.health_insurance_carrier as string) ||
        (d.life_carrier as string) ||
        (d.other_carrier as string) ||
        '',
      from_iua:
        (d.iua_amount as string) ||
        (d.iua as string) ||
        (d.individual_unshared_amount as string) ||
        '',
      from_monthly:
        (d.monthly_premium as string) ||
        (d.monthly_contribution as string) ||
        (d.monthly_amount as string) ||
        '',
    };
  });

  const [createFollowUp, setCreateFollowUp] = useState(
    () =>
      shouldCreatePlanChangeFollowUp(
        initial?.date ?? new Date().toISOString().slice(0, 10),
        undefined,
        initial?.follow_up_task_id,
      ),
  );
  const [saving, setSaving] = useState(false);

  const followUpEligible = shouldCreatePlanChangeFollowUp(
    form.date,
    undefined,
    initial?.follow_up_task_id,
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const change: MembershipChange = {
        id: initial?.id ?? generateId(),
        date: form.date,
        type: form.type,
        ...(form.from_plan && { from_plan: form.from_plan }),
        ...(form.to_plan && { to_plan: form.to_plan }),
        ...(form.from_iua && { from_iua: form.from_iua }),
        ...(form.to_iua && { to_iua: form.to_iua }),
        ...(form.from_monthly && { from_monthly: form.from_monthly }),
        ...(form.to_monthly && { to_monthly: form.to_monthly }),
        ...(form.notes && { notes: form.notes }),
        created_at: initial?.created_at ?? new Date().toISOString(),
        created_by: initial?.created_by,
        ...(initial?.follow_up_task_id && {
          follow_up_task_id: initial.follow_up_task_id,
        }),
      };
      await onSave(change, {
        createFollowUp: createFollowUp && followUpEligible,
      });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof ChangeFormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            {initial ? 'Edit Plan Change' : 'Log a Plan Change'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Row 1: Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                Change Type
              </label>
              <Select
                value={form.type}
                onValueChange={(v) => set('type', v)}
              >
                <SelectTrigger className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                  {(Object.entries(CHANGE_TYPE_META) as [MembershipChangeType, typeof CHANGE_TYPE_META.upgrade][]).map(
                    ([k, meta]) => (
                      <SelectItem key={k} value={k} className="text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-2">
                          <meta.icon className={cn('w-3.5 h-3.5', meta.color)} />
                          {meta.label}
                        </span>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                Effective Date
              </label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => {
                  const next = e.target.value;
                  set('date', next);
                  setCreateFollowUp(
                    shouldCreatePlanChangeFollowUp(
                      next,
                      undefined,
                      initial?.follow_up_task_id,
                    ),
                  );
                }}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Plan transition */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
              Plan
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input
                value={form.from_plan}
                onChange={(e) => set('from_plan', e.target.value)}
                placeholder="From plan"
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Input
                value={form.to_plan}
                onChange={(e) => set('to_plan', e.target.value)}
                placeholder="To plan"
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* IUA transition */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
              IUA (Individual Unshared Amount)
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input
                value={form.from_iua}
                onChange={(e) => set('from_iua', e.target.value)}
                placeholder="From IUA"
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Input
                value={form.to_iua}
                onChange={(e) => set('to_iua', e.target.value)}
                placeholder="To IUA"
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Monthly transition */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
              Monthly Amount
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input
                value={form.from_monthly}
                onChange={(e) => set('from_monthly', e.target.value)}
                placeholder="From monthly"
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Input
                value={form.to_monthly}
                onChange={(e) => set('to_monthly', e.target.value)}
                placeholder="To monthly"
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
              Notes
            </label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder='e.g. "Member requested Secure HSA → Care+ for Sept 1"'
              rows={2}
              className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {followUpEligible ? (
            <label className="flex items-start gap-2.5 rounded-lg border border-teal-200 dark:border-teal-500/30 bg-teal-50/80 dark:bg-teal-500/10 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={createFollowUp}
                onChange={(e) => setCreateFollowUp(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-200">
                <span className="font-semibold flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Create follow-up reminder on effective date
                </span>
                <span className="block mt-0.5 text-slate-500 dark:text-slate-400">
                  High-priority task so Product / IUA / monthly get updated when the change takes effect.
                  Leave current product unchanged until then.
                </span>
              </span>
            </label>
          ) : initial?.follow_up_task_id ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-teal-500" />
              A follow-up reminder is already linked to this change.
            </p>
          ) : null}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!form.date || saving}
            className="bg-teal-500 hover:bg-teal-400 text-white"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {initial ? 'Save Changes' : 'Add Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export interface MembershipChangeHistoryProps {
  /** Current JSONB `data` from the record */
  data: Record<string, unknown> | null;
  /** Contact/member record id — required to attach follow-up tasks */
  recordId: string;
  /** Display name for the follow-up task title */
  recordTitle: string;
  readOnly?: boolean;
  className?: string;
}

export const MembershipChangeHistory = memo(function MembershipChangeHistory({
  data,
  recordId,
  recordTitle,
  readOnly,
  className,
}: MembershipChangeHistoryProps) {
  const saveCtx = useRecordFieldSaveOptional();

  const changes = useMemo<MembershipChange[]>(() => {
    const raw = (data?.membership_changes ?? []) as MembershipChange[];
    if (!Array.isArray(raw)) return [];
    // Sort newest first
    return [...raw].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return db - da;
    });
  }, [data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipChange | null>(null);
  const [collapsed, setCollapsed] = useState(changes.length > 4);

  // Persist changes array back to the record
  const persistChanges = useCallback(
    async (next: MembershipChange[]) => {
      if (!saveCtx) {
        return {
          status: 'error' as const,
          error: 'Plan-change saving is unavailable',
        };
      }
      return saveCtx.save('membership_changes', next, {
        // This array is read-modify-write. Retrying a stale snapshot after a
        // 409 would overwrite another agent's concurrently-added change.
        retryOnConflict: false,
      });
    },
    [saveCtx],
  );

  const handleSave = useCallback(
    async (change: MembershipChange, opts: { createFollowUp: boolean }) => {
      const existing = (data?.membership_changes ?? []) as MembershipChange[];
      const currentChanges = Array.isArray(existing) ? existing : [];
      const result = await persistPlanChangeWithFollowUp({
        currentChanges,
        change,
        persistChanges,
        createFollowUp:
          opts.createFollowUp && recordId
            ? async () => {
                const payload = buildPlanChangeFollowUpTask({
                  recordId,
                  recordTitle: recordTitle || 'Member',
                  changeId: change.id,
                  type: change.type,
                  effectiveDate: change.date,
                  fromPlan: change.from_plan,
                  toPlan: change.to_plan,
                  notes: change.notes,
                });
                const res = await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(
                    (err as { error?: string }).error || 'Failed to create follow-up'
                  );
                }
                return (await res.json()) as { id?: string };
              }
            : undefined,
      });

      switch (result.status) {
        case 'history-error':
          toast.error('Plan change was not saved', {
            description: result.error,
          });
          return;
        case 'history-queued':
          toast.warning('Plan change queued for sync', {
            description:
              'The follow-up reminder was not created. Reopen this change after syncing to add it safely.',
          });
          break;
        case 'saved-task-error':
          console.error('[MembershipChangeHistory] follow-up create failed:', result.error);
          toast.error('Plan change saved, but follow-up reminder failed', {
            description: result.error,
          });
          break;
        case 'saved-with-follow-up-unlinked':
          console.error('[MembershipChangeHistory] follow-up link failed:', result.error);
          toast.warning('Plan change and reminder saved separately', {
            description:
              'The reminder exists, but its linked badge could not be saved. Check the Activities tab before retrying.',
          });
          break;
        case 'saved-with-follow-up-link-queued':
          toast.success('Plan change logged', {
            description: `Follow-up reminder set for ${formatDate(change.date)}; its link is queued for sync.`,
          });
          break;
        case 'saved-with-follow-up':
          toast.success('Plan change logged', {
            description: `Follow-up reminder set for ${formatDate(change.date)}. Leave current product as-is until then.`,
          });
          break;
        case 'saved':
          toast.success('Plan change logged');
          break;
      }

      setDialogOpen(false);
      setEditing(null);
    },
    [data, persistChanges, recordId, recordTitle],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const existing = (data?.membership_changes ?? []) as MembershipChange[];
      const arr = Array.isArray(existing) ? existing.filter((c) => c.id !== id) : [];
      await persistChanges(arr);
    },
    [data, persistChanges],
  );

  const visibleChanges = collapsed ? changes.slice(0, 3) : changes;

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-teal-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Membership Change History
          </h3>
          {changes.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
            >
              {changes.length}
            </Badge>
          )}
        </div>
        {!readOnly && saveCtx && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="h-7 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            Log Change
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {changes.length === 0 ? (
          <div className="text-center py-6">
            <ChevronsUpDown className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No plan changes recorded yet.
            </p>
            {!readOnly && saveCtx && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Click &quot;Log Change&quot; to record an upgrade, downgrade, or plan switch.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div className="relative">
              {/* Vertical connector line */}
              {visibleChanges.length > 1 && (
                <div className="absolute left-[15px] top-8 bottom-5 w-px bg-slate-200 dark:bg-white/10" />
              )}
              {visibleChanges.map((change) => (
                <ChangeEntry
                  key={change.id}
                  change={change}
                  readOnly={readOnly}
                  onEdit={
                    !readOnly && saveCtx
                      ? () => {
                          setEditing(change);
                          setDialogOpen(true);
                        }
                      : undefined
                  }
                  onDelete={
                    !readOnly && saveCtx ? () => handleDelete(change.id) : undefined
                  }
                />
              ))}
            </div>

            {changes.length > 3 && (
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="w-full text-center text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 py-1"
              >
                {collapsed
                  ? `Show ${changes.length - 3} more change${changes.length - 3 > 1 ? 's' : ''}`
                  : 'Show less'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Dialog — remount on open so form state resets */}
      {dialogOpen && (
        <ChangeFormDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
          initial={editing}
          currentData={data}
        />
      )}
    </div>
  );
});
