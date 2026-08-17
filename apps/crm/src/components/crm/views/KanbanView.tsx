'use client';

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
  type KeyboardEvent,
} from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  GripVertical,
  User,
  DollarSign,
  Mail,
  Phone,
  Inbox,
  Plus,
  Calendar,
  MoreHorizontal,
  Eye,
  Trash2,
  Trophy,
  XCircle,
  AlertTriangle,
  Sparkles,
  History,
  Pencil,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import type { CrmRecord, CrmField, CrmDealStage } from '@/lib/crm/types';
import { StageHistoryDrawer } from './StageHistoryDrawer';

interface KanbanViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  onRowClick?: (recordId: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  /**
   * Optional authoritative deal-stage catalog. When provided AND the user is
   * grouping by `stage`, the kanban renders real pipeline columns with
   * probability / WIP limits / won-lost styling instead of inferring columns
   * from record values.
   */
  stages?: CrmDealStage[];
}

interface KanbanColumn {
  key: string;
  label: string;
  color: string;
  /** Win probability 0-100, sourced from `crm_deal_stages.probability`. */
  probability?: number;
  isWon?: boolean;
  isLost?: boolean;
  wipLimit?: number | null;
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatMoney(n: number): string {
  return USD.format(n);
}

const COLUMN_COLORS = [
  '#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#10B981',
  '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F97316',
];

function getGroupableFields(fields: CrmField[]): CrmField[] {
  return fields.filter(f =>
    f.type === 'select' || f.key === 'status' || f.key === 'lead_status' || f.key === 'contact_status'
  );
}

function getFieldValue(record: CrmRecord, fieldKey: string): string {
  if (fieldKey === 'status' || fieldKey === 'lead_status' || fieldKey === 'contact_status') {
    const val = record.status ?? record.data?.[fieldKey] ?? record.data?.status;
    return val ? String(val) : '';
  }
  if (fieldKey === 'stage') {
    return record.stage || '';
  }
  if (fieldKey === 'owner_id') {
    return record.owner_id || 'unassigned';
  }
  const val = record.data?.[fieldKey];
  return val ? String(val) : '';
}

function getDisplayName(record: CrmRecord): string {
  if (record.title && record.title !== 'Untitled') return record.title;
  const firstName = record.data?.first_name || '';
  const lastName = record.data?.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || record.data?.account_name as string || record.data?.name as string || record.title || 'Untitled';
}

/**
 * QuickEditChip — inline click-to-edit control used inside kanban cards.
 *
 * Designed for the two highest-value deal fields (amount + expected-close
 * date) where reps need rapid edits without opening the record detail. We
 * intentionally skip the full `InlineFieldCell` plumbing here because:
 *
 *   - Each kanban card is a distinct record, so a shared
 *     `RecordFieldSaveProvider` would be awkward.
 *   - We don't need the full optimistic-concurrency / presence lock
 *     machinery on a surface where a rep is just re-pricing a deal.
 *
 * The chip is keyboard-accessible (Enter commits, Escape aborts) and the
 * caller receives an `onCommit` callback that should PATCH the API and
 * update the record in local state.
 */
function QuickEditChip({
  icon,
  display,
  value,
  inputType,
  placeholder,
  onCommit,
  ariaLabel,
}: {
  icon: React.ReactNode;
  display: string;
  /** Current raw value to seed the input (string for both number/date). */
  value: string;
  inputType: 'number' | 'date';
  placeholder?: string;
  onCommit: (next: string) => Promise<void>;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }
  }, [editing]);

  const commit = useCallback(async () => {
    if (busy) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onCommit(draft);
      setEditing(false);
    } catch {
      // Parent shows the toast; revert the draft so the chip doesn't lie.
      setDraft(value);
    } finally {
      setBusy(false);
    }
  }, [busy, draft, value, onCommit]);

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDraft(value);
        setEditing(false);
      }
    },
    [commit, value],
  );

  if (editing) {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {icon}
        <input
          ref={inputRef}
          type={inputType}
          value={draft}
          disabled={busy}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={handleKey}
          aria-label={ariaLabel}
          className="w-full h-6 px-1.5 text-xs rounded border border-teal-400 dark:border-teal-500/60 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className="group/chip flex items-center gap-1.5 min-w-0 text-left rounded px-0.5 -mx-0.5 hover:bg-teal-500/5 dark:hover:bg-teal-500/10 focus:outline-none focus:ring-1 focus:ring-teal-400/50"
      aria-label={`${ariaLabel}. Click to edit.`}
    >
      {icon}
      <span className="truncate">{display}</span>
      <Pencil className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover/chip:opacity-100 transition-opacity" />
    </button>
  );
}

// Sortable Kanban Card
const KanbanCard = memo(function KanbanCard({
  record,
  isDragOverlay,
  onRowClick,
  onDelete,
  columnProbability,
  onQuickEdit,
  onOpenHistory,
  showHistory,
}: {
  record: CrmRecord;
  isDragOverlay?: boolean;
  onRowClick?: (id: string) => void;
  onDelete?: () => void;
  /** If > 0 and the card shows an amount, we also render `amount × p%` weighted. */
  columnProbability?: number;
  /** Commit a single field update. Resolves on success, rejects on failure
   *  so inline chips can revert their draft. */
  onQuickEdit?: (
    id: string,
    updates: { amount?: number | null; expected_close_date?: string | null },
  ) => Promise<void>;
  /** Open the StageHistoryDrawer for this record. */
  onOpenHistory?: (id: string, title: string) => void;
  /** Whether the history option should appear in the card's menu. Enabled
   *  by the parent only when the kanban has a real deal-stage catalog. */
  showHistory?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: record.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = getDisplayName(record);
  const email = (record.email || record.data?.email) as string | undefined;
  const phone = (record.phone || record.data?.phone) as string | undefined;
  const amount = Number(record.data?.amount) || 0;
  const expectedClose = record.data?.expected_close_date as string | undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-white/10 transition-all group cursor-pointer',
        'hover:border-teal-500/30 hover:shadow-md',
        isDragging && 'opacity-40',
        isDragOverlay && 'shadow-xl border-teal-500/50 rotate-2 scale-105'
      )}
      onClick={() => onRowClick?.(record.id)}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={`/crm/r/${record.id}`}
            className="text-sm font-medium text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors line-clamp-2"
            onClick={(e) => e.stopPropagation()}
          >
            {displayName}
          </Link>

          <div className="mt-2 space-y-1.5">
            {onQuickEdit ? (
              <div className="flex items-baseline gap-1.5 flex-wrap text-sm font-bold text-slate-900 dark:text-white">
                <QuickEditChip
                  icon={
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  }
                  display={amount > 0 ? formatMoney(amount) : 'Set amount'}
                  value={amount > 0 ? String(amount) : ''}
                  inputType="number"
                  placeholder="0"
                  ariaLabel="Deal amount"
                  onCommit={async (next) => {
                    const parsed = next === '' ? null : Number(next);
                    if (parsed !== null && Number.isNaN(parsed)) {
                      throw new Error('Invalid number');
                    }
                    await onQuickEdit(record.id, { amount: parsed });
                  }}
                />
                {columnProbability !== undefined &&
                columnProbability > 0 &&
                columnProbability < 100 &&
                amount > 0 ? (
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    · {formatMoney((amount * columnProbability) / 100)} weighted
                  </span>
                ) : null}
              </div>
            ) : (
              amount > 0 && (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 self-center" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatMoney(amount)}
                  </span>
                  {columnProbability !== undefined &&
                  columnProbability > 0 &&
                  columnProbability < 100 ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      · {formatMoney((amount * columnProbability) / 100)} weighted
                    </span>
                  ) : null}
                </div>
              )
            )}

            {email && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{email}</span>
              </div>
            )}

            {onQuickEdit ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <QuickEditChip
                  icon={<Calendar className="w-3 h-3 flex-shrink-0" />}
                  display={
                    expectedClose
                      ? new Date(expectedClose).toLocaleDateString()
                      : 'Set close date'
                  }
                  value={expectedClose ? expectedClose.slice(0, 10) : ''}
                  inputType="date"
                  ariaLabel="Expected close date"
                  onCommit={async (next) => {
                    await onQuickEdit(record.id, {
                      expected_close_date: next || null,
                    });
                  }}
                />
              </div>
            ) : (
              expectedClose && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span suppressHydrationWarning>{new Date(expectedClose).toLocaleDateString()}</span>
                </div>
              )
            )}
          </div>

          {record.owner_id && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <User className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              </div>
              <span className="text-[11px] text-slate-500">Assigned</span>
            </div>
          )}
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
              <DropdownMenuItem onClick={() => onRowClick?.(record.id)} className="cursor-pointer text-sm">
                <Eye className="w-3.5 h-3.5 mr-2" />
                View
              </DropdownMenuItem>
              {showHistory ? (
                <DropdownMenuItem
                  onClick={() => onOpenHistory?.(record.id, displayName)}
                  className="cursor-pointer text-sm"
                >
                  <History className="w-3.5 h-3.5 mr-2" />
                  Stage history
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
              <DropdownMenuItem onClick={() => onDelete?.()} className="text-red-600 dark:text-red-400 cursor-pointer text-sm">
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});

// Column component
const Column = memo(function Column({
  column,
  records,
  onRowClick,
  onDelete,
  onQuickEdit,
  onOpenHistory,
  showHistory,
}: {
  column: KanbanColumn;
  records: CrmRecord[];
  onRowClick?: (id: string) => void;
  onDelete?: (id: string) => void;
  onQuickEdit?: (
    id: string,
    updates: { amount?: number | null; expected_close_date?: string | null },
  ) => Promise<void>;
  onOpenHistory?: (id: string, title: string) => void;
  showHistory?: boolean;
}) {
  const totalAmount = records.reduce(
    (sum, r) => sum + (Number(r.data?.amount) || 0),
    0,
  );
  const weighted =
    column.probability !== undefined && column.probability > 0
      ? (totalAmount * column.probability) / 100
      : null;
  const wipExceeded =
    column.wipLimit != null && records.length > column.wipLimit;

  // Body tints for terminal stages so sales reps can scan the board fast.
  const bodyTint = column.isWon
    ? 'bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-500/20'
    : column.isLost
      ? 'bg-rose-50/60 dark:bg-rose-500/10 border-rose-200/70 dark:border-rose-500/20'
      : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-white/5';

  return (
    <div className="flex flex-col w-[300px] min-w-[300px] flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: column.color }}
        />
        {column.isWon ? (
          <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        ) : column.isLost ? (
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
        ) : null}
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {column.label || 'No Value'}
        </h3>
        <Badge
          variant="secondary"
          className={cn(
            'text-[11px] px-1.5 py-0 h-5 text-slate-600 dark:text-slate-400',
            wipExceeded
              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
              : 'bg-slate-100 dark:bg-slate-800',
          )}
          title={
            wipExceeded
              ? `Exceeds WIP limit of ${column.wipLimit}`
              : undefined
          }
        >
          {column.wipLimit != null
            ? `${records.length}/${column.wipLimit}`
            : records.length}
          {wipExceeded ? (
            <AlertTriangle className="w-3 h-3 ml-1 -mr-0.5" />
          ) : null}
        </Badge>
        {column.probability !== undefined &&
        column.probability > 0 &&
        column.probability < 100 ? (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-auto">
            {column.probability}%
          </span>
        ) : null}
      </div>

      {/* Column subtotals */}
      {totalAmount > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {formatMoney(totalAmount)}
          </span>
          {weighted !== null ? (
            <span>· {formatMoney(weighted)} weighted</span>
          ) : null}
        </div>
      )}

      {/* Column Body */}
      <SortableContext
        id={column.key}
        items={records.map((r) => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={cn(
            'flex-1 space-y-2 min-h-[100px] p-2 rounded-xl border border-dashed',
            bodyTint,
          )}
        >
          {records.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-slate-400 dark:text-slate-600">
              No records
            </div>
          ) : (
            records.map((record) => (
              <KanbanCard
                key={record.id}
                record={record}
                onRowClick={onRowClick}
                onDelete={() => onDelete?.(record.id)}
                columnProbability={column.probability}
                onQuickEdit={onQuickEdit}
                onOpenHistory={onOpenHistory}
                showHistory={showHistory}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
});

export const KanbanView = memo(function KanbanView({
  records: initialRecords,
  fields,
  moduleKey,
  onRowClick,
  onBulkDelete,
  stages,
}: KanbanViewProps) {
  const router = useRouter();

  // Determine groupable fields with a default
  const groupableFields = useMemo(() => {
    const selectFields = getGroupableFields(fields);
    const systemFields: CrmField[] = [];
    const hasStages = (stages?.length ?? 0) > 0;
    if (hasStages && !selectFields.find((f) => f.key === 'stage')) {
      systemFields.push({
        id: '_stage',
        org_id: '',
        module_id: '',
        key: 'stage',
        label: 'Stage',
        type: 'select',
        required: false,
        is_system: true,
        is_indexed: false,
        is_title_field: false,
        is_pinned: false,
        options: [],
        validation: {},
        default_value: null,
        tooltip: null,
        display_order: 0,
        section: '',
        width: 'full',
        created_at: '',
        updated_at: '',
      });
    }
    if (!selectFields.find((f) => f.key === 'status')) {
      systemFields.push({
        id: '_status',
        org_id: '',
        module_id: '',
        key: 'status',
        label: 'Status',
        type: 'select',
        required: false,
        is_system: true,
        is_indexed: false,
        is_title_field: false,
        is_pinned: false,
        options: [],
        validation: {},
        default_value: null,
        tooltip: null,
        display_order: 0,
        section: '',
        width: 'full',
        created_at: '',
        updated_at: '',
      });
    }
    return [...systemFields, ...selectFields];
  }, [fields, stages]);

  // Default grouping: stage when available (deals), otherwise status.
  const [groupByField, setGroupByField] = useState<string>(
    (stages?.length ?? 0) > 0 ? 'stage' : groupableFields[0]?.key || 'status',
  );
  const [records, setRecords] = useState(initialRecords);
  const [activeDragRecord, setActiveDragRecord] = useState<CrmRecord | null>(null);

  // Stage history drawer — only rendered when we have a real stage catalog,
  // since without `crm_deal_stages` the `from_stage`/`to_stage` text would
  // be opaque to the user.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const handleOpenHistory = useCallback((id: string, title: string) => {
    setHistoryRecord({ id, title });
    setHistoryOpen(true);
  }, []);

  // Keep local cards in sync when parent re-fetches (e.g., after pagination
  // or a filter change). Without this, parent updates wouldn't reach us
  // once we've mutated `records` via a quick edit.
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  /**
   * Commit a quick edit from a kanban card. All updates here live inside
   * `crm_records.data` (JSONB), so a single PATCH with `{ data: {...} }`
   * is sufficient. We optimistically update local state first and revert
   * on failure so the chip snaps back cleanly.
   */
  const handleQuickEdit = useCallback(
    async (
      id: string,
      updates: {
        amount?: number | null;
        expected_close_date?: string | null;
      },
    ) => {
      const prev = records.find((r) => r.id === id);
      if (!prev) return;

      setRecords((current) =>
        current.map((r) =>
          r.id === id ? { ...r, data: { ...r.data, ...updates } } : r,
        ),
      );

      try {
        const res = await fetch(`/api/crm/records/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ data: updates }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        toast.success(toastCopy.saved('Changes'));
      } catch (err) {
        setRecords((current) =>
          current.map((r) => (r.id === id ? prev : r)),
        );
        toast.error(toastCopy.failed('save your changes', err), {
          description: 'Your edit was reverted. Try again.',
        });
        throw err;
      }
    },
    [records],
  );

  // Build columns from unique values. When grouping by `stage` and we have an
  // authoritative stage catalog, we use it — this gives us real ordering,
  // probability, color, WIP limits, and won/lost semantics.
  const columns = useMemo((): KanbanColumn[] => {
    if (groupByField === 'stage' && stages && stages.length > 0) {
      const cols: KanbanColumn[] = stages
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((s) => ({
          key: s.key,
          label: s.name,
          color: s.color || '#6366f1',
          probability: s.probability,
          isWon: s.is_won,
          isLost: s.is_lost,
          wipLimit: s.wip_limit ?? null,
        }));
      const hasUnassigned = records.some((r) => !getFieldValue(r, 'stage'));
      if (hasUnassigned) {
        cols.push({ key: '__none__', label: 'No stage', color: '#94A3B8' });
      }
      return cols;
    }

    const field = fields.find((f) => f.key === groupByField);
    const uniqueValues = new Set<string>();
    if (field?.options) {
      const opts = Array.isArray(field.options) ? field.options : [];
      opts.forEach((o) => uniqueValues.add(o));
    }
    records.forEach((r) => {
      const val = getFieldValue(r, groupByField);
      if (val) uniqueValues.add(val);
    });

    const cols: KanbanColumn[] = [];
    let idx = 0;
    uniqueValues.forEach((val) => {
      cols.push({
        key: val,
        label: val,
        color: COLUMN_COLORS[idx % COLUMN_COLORS.length],
      });
      idx++;
    });

    const hasUnassigned = records.some((r) => !getFieldValue(r, groupByField));
    if (hasUnassigned) {
      cols.push({ key: '__none__', label: 'No Value', color: '#94A3B8' });
    }

    return cols;
  }, [records, fields, groupByField, stages]);

  // Group records by column
  const recordsByColumn = useMemo(() => {
    const grouped: Record<string, CrmRecord[]> = {};
    columns.forEach(c => { grouped[c.key] = []; });

    records.forEach(r => {
      const val = getFieldValue(r, groupByField);
      const colKey = val || '__none__';
      if (grouped[colKey]) {
        grouped[colKey].push(r);
      } else if (grouped['__none__']) {
        grouped['__none__'].push(r);
      }
    });

    return grouped;
  }, [records, columns, groupByField]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const record = records.find(r => r.id === event.active.id);
    if (record) setActiveDragRecord(record);
  }, [records]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if over a column
    const overColumn = columns.find(c => c.key === overId);
    if (overColumn) {
      const record = records.find(r => r.id === activeId);
      if (record) {
        const currentVal = getFieldValue(record, groupByField);
        const currentCol = currentVal || '__none__';
        if (currentCol !== overColumn.key) {
          setRecords(prev => prev.map(r => {
            if (r.id !== activeId) return r;
            const newVal = overColumn.key === '__none__' ? '' : overColumn.key;
            if (groupByField === 'status' || groupByField === 'lead_status' || groupByField === 'contact_status') {
              return { ...r, status: newVal };
            }
            if (groupByField === 'stage') {
              return { ...r, stage: newVal };
            }
            return { ...r, data: { ...r.data, [groupByField]: newVal } };
          }));
        }
      }
    }
  }, [columns, records, groupByField]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragRecord(null);

    if (!over) {
      setRecords(initialRecords);
      return;
    }

    const activeId = active.id as string;
    const record = initialRecords.find(r => r.id === activeId);
    if (!record) return;

    const overColumn = columns.find(c => c.key === (over.id as string));
    const newVal = overColumn ? (overColumn.key === '__none__' ? '' : overColumn.key) : getFieldValue(record, groupByField);
    const oldVal = getFieldValue(record, groupByField);

    if (newVal !== oldVal) {
      try {
        const isStatusField = ['status', 'lead_status', 'contact_status'].includes(groupByField);
        const isSystemField = isStatusField || groupByField === 'stage';

        // Status: hit dedicated endpoint so column + JSONB stay in sync.
        // Stage/other system fields: top-level PATCH. Custom fields: JSONB only.
        let response: Response;
        if (isStatusField) {
          response = await fetch(`/api/crm/records/${activeId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newVal }),
          });
        } else {
          // DATA SAFETY: send ONLY the changed key. `record.data` may carry
          // read-time enrichment (twin JSONB blank-filled by getRecords) —
          // spreading it into the PATCH would persist twin data into this
          // row. The server merges JSONB (record-patch-service.ts).
          const updates: Record<string, unknown> = isSystemField
            ? { [groupByField]: newVal }
            : { data: { [groupByField]: newVal } };
          response = await fetch(`/api/crm/records/${activeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
        }

        if (!response.ok) throw new Error('Failed to update');
        toast.success(`Moved to "${newVal || 'No Value'}"`);
      } catch {
        toast.error(toastCopy.failed('move the record', undefined, 'It was put back — try again'));
        setRecords(initialRecords);
      }
    }
  }, [initialRecords, columns, groupByField]);

  const handleDragCancel = useCallback(() => {
    setActiveDragRecord(null);
    setRecords(initialRecords);
  }, [initialRecords]);

  const handleRowClick = useCallback((id: string) => {
    if (onRowClick) {
      onRowClick(id);
    } else {
      router.push(`/crm/r/${id}`);
    }
  }, [onRowClick, router]);

  /**
   * Pipeline summary shown as a sticky footer beneath the board. Only
   * meaningful when we're grouping by an authoritative `stage` catalog and
   * records carry a numeric `amount`; otherwise it stays hidden.
   */
  const pipelineSummary = useMemo(() => {
    if (groupByField !== 'stage' || !stages || stages.length === 0) {
      return null;
    }
    const stageByKey = new Map<string, CrmDealStage>(
      stages.map((s) => [s.key, s]),
    );
    let totalPipeline = 0;
    let weightedPipeline = 0;
    let wonTotal = 0;
    let lostTotal = 0;
    let openCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    for (const r of records) {
      const amount = Number(r.data?.amount) || 0;
      const stageKey = getFieldValue(r, 'stage');
      const stage = stageByKey.get(stageKey);
      if (stage?.is_won) {
        wonTotal += amount;
        wonCount += 1;
      } else if (stage?.is_lost) {
        lostTotal += amount;
        lostCount += 1;
      } else {
        totalPipeline += amount;
        weightedPipeline += (amount * (stage?.probability ?? 0)) / 100;
        openCount += 1;
      }
    }
    return {
      totalPipeline,
      weightedPipeline,
      wonTotal,
      lostTotal,
      openCount,
      wonCount,
      lostCount,
    };
  }, [groupByField, stages, records]);

  if (initialRecords.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
          <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No records to display</p>
        <p className="text-sm text-slate-500 mb-4">Create records to see them on the board.</p>
        <Button asChild>
          <Link href={`/crm/modules/${moduleKey}/new`}>
            <Plus className="w-4 h-4 mr-2" />
            Create Record
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Group-by Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Group by</span>
        <Select value={groupByField} onValueChange={setGroupByField}>
          <SelectTrigger className="h-9 w-[180px] text-sm rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupableFields.map(f => (
              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {columns.length} columns &middot; {records.length} records
        </span>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <div className="flex gap-4 min-w-max">
            {columns.map((column) => (
              <Column
                key={column.key}
                column={column}
                records={recordsByColumn[column.key] || []}
                onRowClick={handleRowClick}
                onDelete={(id) => onBulkDelete?.([id])}
                onQuickEdit={handleQuickEdit}
                onOpenHistory={handleOpenHistory}
                showHistory={(stages?.length ?? 0) > 0}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeDragRecord ? (
            <div className="w-[280px]">
              <KanbanCard
                record={activeDragRecord}
                isDragOverlay
                onRowClick={handleRowClick}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <StageHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        recordId={historyRecord?.id ?? null}
        recordTitle={historyRecord?.title}
        stages={stages}
      />

      {pipelineSummary ? (
        <div className="sticky bottom-2 z-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                Pipeline
              </span>
            </div>
            <PipelineStat
              label="Open"
              value={formatMoney(pipelineSummary.totalPipeline)}
              sub={`${pipelineSummary.openCount} deals`}
            />
            <PipelineStat
              label="Weighted"
              value={formatMoney(pipelineSummary.weightedPipeline)}
              sub="open × probability"
              accent="text-teal-600 dark:text-teal-400"
            />
            <PipelineStat
              label="Won"
              value={formatMoney(pipelineSummary.wonTotal)}
              sub={`${pipelineSummary.wonCount} deals`}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <PipelineStat
              label="Lost"
              value={formatMoney(pipelineSummary.lostTotal)}
              sub={`${pipelineSummary.lostCount} deals`}
              accent="text-rose-600 dark:text-rose-400"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});

function PipelineStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-bold text-slate-900 dark:text-white',
          accent,
        )}
      >
        {value}
      </span>
      {sub ? (
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {sub}
        </span>
      ) : null}
    </div>
  );
}
