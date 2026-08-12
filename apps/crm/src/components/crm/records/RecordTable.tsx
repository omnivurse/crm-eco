'use client';

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCrmDensity } from '@/lib/crm/density';
import { CRM_STATUS_PICKER_CORE } from '@/lib/crm/status-allowlist';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { cn } from '@crm-eco/ui/lib/utils';
import { FieldRenderer } from './FieldRenderer';
import { RecordQueuedBadge } from '@/components/crm/offline/RecordQueuedBadge';
import { toDatetimeLocalValue } from '@/lib/crm/datetime-local';
import { ResizeHandle } from './ResizeHandle';
import { useColumnResize } from '@/hooks/useColumnResize';
import { prefetchRecordForDrawer } from '@/lib/prefetch';
import type { CrmRecord, CrmField, CrmView } from '@/lib/crm/types';
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  User,
  Inbox,
  FileText,
  Plus,
  Phone,
  Mail,
  CheckSquare,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { MarketTypeBadge, NormalizationBadge, OwnershipDisplay } from '@/components/shared/crm-lane-badges';
import { NeedsAttentionChip } from './NeedsAttentionChip';
import { mergeCrmRecordRowIntoFormDefaults } from '@/lib/crm/record-form-defaults';
import {
  formatCurrencyInputValue,
  fieldUsesDecimalMoney,
  isValidCurrencyTyping,
  parseCurrencyInput,
  CURRENCY_INPUT_STEP,
} from '@/lib/crm/currency-input';

// Layout effect on the client (matches @tanstack/react-virtual's own
// useIsomorphicLayoutEffect), plain effect on the server to avoid the SSR
// warning — used to re-lay the virtual rows before paint when density changes.
const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

interface RecordTableProps {
  records: CrmRecord[];
  fields: CrmField[];
  view?: CrmView;
  displayColumns?: string[];
  moduleKey: string;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkUpdate?: (ids: string[], updates: Record<string, unknown>) => void;
  currentSort?: { field: string; direction: 'asc' | 'desc' };
  isLoading?: boolean;
  onRowClick?: (recordId: string) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  enableInlineEdit?: boolean;
  onRecordUpdate?: (recordId: string, updates: Record<string, unknown>) => Promise<void>;
}

interface EditingCell {
  recordId: string;
  field: string;
  value: unknown;
}

// Inline editor component for different field types
function InlineEditor({
  field,
  value,
  onSave,
  onCancel,
  options,
}: {
  field: CrmField | null;
  value: unknown;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  options?: string[];
}) {
  const [editValue, setEditValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let toSave: unknown = editValue;
      if (field != null && fieldUsesDecimalMoney(field)) {
        toSave = parseCurrencyInput(String(editValue ?? ''));
      }
      await onSave(toSave);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSave();
    }
  };

  const fieldType = field?.type || 'text';

  // Select field (status is a special system field that behaves like select)
  if (fieldType === 'select' || (fieldType as string) === 'status' || options) {
    const selectOptions = options || (field?.options as unknown as { choices?: string[] })?.choices || field?.options || [];
    return (
      <div className="flex items-center gap-1">
        <Select
          value={String(editValue)}
          onValueChange={(v) => {
            setEditValue(v);
            onSave(v);
          }}
        >
          <SelectTrigger className="h-8 text-sm w-full min-w-[120px]">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {selectOptions.filter(Boolean).map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-7 w-7 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  // Number / currency fields
  if (fieldType === 'number' || fieldType === 'currency') {
    const usesDecimalMoney =
      field != null && fieldUsesDecimalMoney({ type: fieldType, key: field.key });
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={usesDecimalMoney ? 'text' : 'number'}
          inputMode={usesDecimalMoney ? 'decimal' : undefined}
          step={usesDecimalMoney ? CURRENCY_INPUT_STEP : '1'}
          value={String(editValue ?? '')}
          onChange={(e) => {
            const raw = e.target.value;
            if (usesDecimalMoney) {
              if (raw !== '' && !isValidCurrencyTyping(raw)) return;
              setEditValue(raw);
              return;
            }
            setEditValue(raw);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 text-sm w-full"
          disabled={saving}
        />
        {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>
    );
  }

  // Date field
  if (fieldType === 'date') {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="date"
          value={String(editValue).split('T')[0] || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 text-sm w-full"
          disabled={saving}
        />
        {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>
    );
  }

  if (fieldType === 'datetime') {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="datetime-local"
          value={toDatetimeLocalValue(editValue)}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 text-sm w-full"
          disabled={saving}
        />
        {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>
    );
  }

  // Boolean/Checkbox field
  if (fieldType === 'boolean' || (fieldType as string) === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={Boolean(editValue)}
          onCheckedChange={(checked) => {
            setEditValue(checked);
            onSave(checked);
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-7 w-7"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  // Default text field
  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type={fieldType === 'email' ? 'email' : fieldType === 'phone' ? 'tel' : 'text'}
        value={String(editValue)}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className="h-8 text-sm w-full"
        disabled={saving}
      />
      {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Active': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  'In-Active': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
  'Inactive': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
  'Prospect': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  'New': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  'Contacted': { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30' },
  'Hot Prospect - ready to move': { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30' },
  'Qualified': { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/30' },
  'Working': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  'Converted': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  'Lost': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
  'Closed Won': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  'Closed Lost': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
};

/**
 * Mobile-friendly card component for displaying records on small screens.
 * Shows key information in a touch-friendly format.
 */
interface RecordCardProps {
  record: CrmRecord;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  moduleKey: string;
  onCall?: () => void;
  onEmail?: () => void;
  onAddTask?: () => void;
  onDelete?: () => void;
}

const RecordCard = memo(function RecordCard({
  record,
  isSelected,
  onSelect,
  onClick,
  moduleKey,
  onCall,
  onEmail,
  onAddTask,
  onDelete,
}: RecordCardProps) {
  // Build display name: prefer DB-generated title, then common data fields
  const firstName = record.data?.first_name || '';
  const lastName = record.data?.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const displayName = (record.title && record.title !== 'Untitled' ? record.title : '') || fullName || record.data?.account_name as string || record.data?.name as string || record.title || 'Untitled';

  // Get status
  const rawStatus = record.status ?? record.data?.status ?? record.data?.lead_status ?? record.data?.contact_status;
  const status = rawStatus ? String(rawStatus) : '';
  const statusStyle = STATUS_STYLES[status] || { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' };

  // Get email and phone (check system columns first, then data JSONB)
  const email = (record.email || record.data?.email) as string | undefined;
  const phone = (record.phone || record.data?.phone) as string | undefined;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 p-4 transition-all',
        'active:scale-[0.98]',
        isSelected && 'ring-2 ring-teal-500 border-teal-500'
      )}
      onClick={onClick}
    >
      {/* Header Row */}
      <div className="flex items-start gap-3 mb-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect()}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
        />
        <div className="flex-1 min-w-0">
          <Link
            href={`/crm/r/${record.id}`}
            className="font-semibold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors block truncate"
            title={displayName}
            onClick={(e) => e.stopPropagation()}
          >
            {displayName}
          </Link>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {status && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                statusStyle.bg, statusStyle.text, statusStyle.border
              )}>
                {status}
              </span>
            )}
            <MarketTypeBadge marketType={(record as any).market_type} size="sm" />
            <NormalizationBadge status={(record as any).normalization_status} size="sm" />
            <NeedsAttentionChip record={record} moduleKey={moduleKey} compact />
            <RecordQueuedBadge recordId={record.id} />
          </div>
        </div>
        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white flex-shrink-0"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAddTask?.();
              }}
              className="text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              Add Task
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className="text-red-600 dark:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 text-sm">
        {email && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <a
              href={`mailto:${email}`}
              className="truncate hover:text-teal-600 dark:hover:text-teal-400"
              onClick={(e) => e.stopPropagation()}
            >
              {email}
            </a>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Phone className="w-4 h-4 flex-shrink-0" />
            <a
              href={`tel:${phone}`}
              className="hover:text-teal-600 dark:hover:text-teal-400"
              onClick={(e) => e.stopPropagation()}
            >
              {phone}
            </a>
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
        {phone && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `tel:${phone}`;
            }}
            className="flex-1 h-9 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/30 dark:hover:bg-emerald-500/10"
          >
            <Phone className="w-4 h-4 mr-1" />
            Call
          </Button>
        )}
        {email && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `mailto:${email}`;
            }}
            className="flex-1 h-9 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500/30 dark:hover:bg-blue-500/10"
          >
            <Mail className="w-4 h-4 mr-1" />
            Email
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAddTask?.();
          }}
          className="h-9 px-3 text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-500/30 dark:hover:bg-violet-500/10"
        >
          <CheckSquare className="w-4 h-4" />
        </Button>
      </div>

      {/* Date footer */}
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3" suppressHydrationWarning>
        Created {new Date(record.created_at).toLocaleDateString()}
      </p>
    </div>
  );
});

export const RecordTable = memo(function RecordTable({
  records,
  fields,
  view,
  displayColumns: explicitColumns,
  moduleKey,
  onSort,
  onBulkDelete,
  onBulkUpdate,
  currentSort,
  isLoading,
  onRowClick,
  selectedIds: externalSelectedIds,
  onSelectionChange,
  enableInlineEdit = false,
  onRecordUpdate,
}: RecordTableProps) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const [isScrolled, setIsScrolled] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskRecordId, setTaskRecordId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Prefetch record data on row hover for instant drawer opens
  const handleRowMouseEnter = useCallback((recordId: string) => {
    // Clear any pending prefetch
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
    // Delay prefetch by 150ms to avoid prefetching on quick mouse movements
    prefetchTimerRef.current = setTimeout(() => {
      prefetchRecordForDrawer(recordId);
    }, 150);
  }, []);

  const handleRowMouseLeave = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  // Status options — shared allowlist subset (see status-allowlist.ts)
  const STATUS_OPTIONS = [...CRM_STATUS_PICKER_CORE];

  // Handle inline edit save
  const handleInlineEditSave = useCallback(async (value: unknown) => {
    if (!editingCell || !onRecordUpdate) return;

    try {
      const record = records.find(r => r.id === editingCell.recordId);
      if (!record) return;

      const fieldMeta = fields.find((f) => f.key === editingCell.field);
      let storeValue = value;
      if (
        fieldMeta?.type === 'datetime' &&
        typeof value === 'string' &&
        value
      ) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) storeValue = d.toISOString();
      }

      const isStatusField = ['status', 'lead_status', 'contact_status'].includes(
        editingCell.field,
      );
      // Status aliases must update the indexed column + JSONB together.
      // Prefer the dedicated status endpoint when available via onRecordUpdate
      // callers that pass through PATCH — send top-level `status` so the server
      // applies status-sync (see executeCrmRecordPatch / status route).
      if (isStatusField) {
        await onRecordUpdate(editingCell.recordId, { status: storeValue });
      } else {
        const isSystemField = ['title', 'owner_id'].includes(editingCell.field);
        const updates: Record<string, unknown> = isSystemField
          ? { [editingCell.field]: storeValue }
          : { data: { ...record.data, [editingCell.field]: storeValue } };
        await onRecordUpdate(editingCell.recordId, updates);
      }
      toast.success('Updated successfully');
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Failed to update');
    } finally {
      setEditingCell(null);
    }
  }, [editingCell, onRecordUpdate, records, fields]);

  // Cancel inline edit
  const handleInlineEditCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Start editing a cell
  const startEditing = useCallback((recordId: string, field: string, value: unknown) => {
    if (!enableInlineEdit || !onRecordUpdate) return;
    setEditingCell({ recordId, field, value });
  }, [enableInlineEdit, onRecordUpdate]);

  // Use external selection state if provided, otherwise use internal
  const selectedIds = externalSelectedIds ?? internalSelectedIds;
  const setSelectedIds = onSelectionChange ?? setInternalSelectedIds;

  // Track scroll for sticky header shadow
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolled(container.scrollTop > 0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Virtualization row height — density-aware. Mirrors the global display
  // density (html[data-density] via useCrmDensity): compact packs more rows on
  // screen, comfortable gives them room; default stays 44 so the default view is
  // unchanged. This value sizes the virtual rows (estimateSize + each row's
  // explicit height below), and the cell padding uses --crm-cell-py so content
  // fits the shorter/taller rows.
  const { density } = useCrmDensity();
  const ROW_HEIGHT = density === 'compact' ? 38 : density === 'comfortable' ? 52 : 44;
  const rowVirtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });
  // When density flips ROW_HEIGHT, re-lay the virtual rows. Run it in a LAYOUT
  // effect (before paint) so the new cell padding never sits in the old row box
  // for a frame; skip the initial mount (height unchanged — avoids a redundant
  // re-render); and re-anchor the scroll on the row the user is viewing, since
  // measure() does no scroll compensation and the rows are exact-fit — otherwise
  // a mid-scroll density toggle would snap the list to a different record set.
  const prevRowHeightRef = useRef(ROW_HEIGHT);
  useIsomorphicLayoutEffect(() => {
    const prevRowHeight = prevRowHeightRef.current;
    if (prevRowHeight === ROW_HEIGHT) return;
    const scrollEl = tableContainerRef.current;
    const anchorIndex = scrollEl ? Math.round(scrollEl.scrollTop / prevRowHeight) : 0;
    prevRowHeightRef.current = ROW_HEIGHT;
    rowVirtualizer.measure();
    if (anchorIndex > 0) rowVirtualizer.scrollToIndex(anchorIndex, { align: 'start' });
  }, [ROW_HEIGHT, rowVirtualizer]);

  // Fill-to-viewport table height. A fixed `--crm-view-offset` guess under-counts
  // the multi-row toolbar (+ SavedViews/QuickFilter/FilterChips) and the
  // recently-viewed rail, so the table runs past the fold and the shell's <main>
  // scrolls *as well as* the table — the "double scrollbar". Instead, measure the
  // container's live top edge and cap its height to reach the shell's bottom
  // padding: the table fills exactly the space left below whatever chrome sits
  // above it (max rows) and <main> never needs to scroll (single scrollbar). It
  // self-corrects via ResizeObserver when anything above reflows (rail appears,
  // chips wrap, mass-actions bar shows) and re-runs when density flips the chrome.
  const [measuredMaxH, setMeasuredMaxH] = useState<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = tableContainerRef.current;
    if (!el || typeof window === 'undefined') return;
    const BOTTOM_GAP = 56; // shell bottom padding (pb-10) + <main> padding + breathing room
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      const next = Math.max(240, Math.round(window.innerHeight - top - BOTTOM_GAP));
      setMeasuredMaxH((prev) => (prev === next ? prev : next));
    };
    measure();
    window.addEventListener('resize', measure);
    // `top` depends only on chrome above the table, not the table's own height,
    // so observing body layout converges without a feedback loop.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [density]);

  // Power-user keyboard navigation state (declared here with the other hooks so
  // it precedes any early return). The handler + active-descendant id live down
  // near the render where `handleRowClick` is in scope.
  const [activeRowIndex, setActiveRowIndex] = useState(-1);
  // Keep the active row in range if the record set shrinks (filter / sort).
  useEffect(() => {
    setActiveRowIndex((i) => (i >= records.length ? -1 : i));
  }, [records.length]);

  // Create field lookup map
  const fieldMap = useMemo(() => {
    return fields.reduce((acc, field) => {
      acc[field.key] = field;
      return acc;
    }, {} as Record<string, CrmField>);
  }, [fields]);

  // Get visible columns from view or explicit columns
  // Allow any column that exists in the fieldMap (custom fields) or common system fields
  const SYSTEM_COLUMNS = ['title', 'status', 'owner_id', 'created_at', 'updated_at', 'email', 'phone', 'first_name', 'last_name', 'middle_name', 'preferred_name', 'lead_status', 'contact_status', 'salutation', 'contact_name'];
  const visibleColumns = useMemo(() => {
    const columns = explicitColumns || view?.columns || fields.map(f => f.key);
    // Allow columns that exist in fieldMap or are known system columns
    return columns.filter((col) => fieldMap[col] || SYSTEM_COLUMNS.includes(col));
  }, [explicitColumns, view?.columns, fieldMap]);

  // Column width mapping for enterprise-grade horizontal table layout
  const getColumnWidth = useCallback((col: string): number => {
    switch (col) {
      case 'email': return 240;
      case 'phone': return 160;
      case 'first_name':
      case 'last_name':
      case 'contact_name':
      case 'title': return 180;
      case 'middle_name':
      case 'preferred_name':
      case 'salutation': return 120;
      case 'status':
      case 'lead_status':
      case 'contact_status': return 140;
      case 'owner_id': return 160;
      case 'created_at':
      case 'updated_at': return 160;
      default: return 180;
    }
  }, []);

  // Resizable columns -- drag header edges to adjust, double-click to reset
  const { columnWidths, isResizing, onResizeStart, resetColumnWidth } = useColumnResize({
    columns: visibleColumns,
    getDefaultWidth: getColumnWidth,
    storageKey: moduleKey,
  });

  /** Resolved width for a column: user-adjusted or default */
  const getColWidth = useCallback(
    (col: string) => columnWidths[col] ?? getColumnWidth(col),
    [columnWidths, getColumnWidth],
  );

  // Sticky left offset for the first data column (checkbox col = 48px)
  const stickyFirstColLeft = 48;

  // Total min-width for the table to enable horizontal scrolling
  const totalMinWidth = useMemo(() => {
    const checkboxCol = 48;  // w-12
    const actionsCol = 112;  // w-28
    const dataColsWidth = visibleColumns.reduce((sum, col) => sum + getColWidth(col), 0);
    return checkboxCol + dataColsWidth + actionsCol;
  }, [visibleColumns, getColWidth]);

  const allSelected = records.length > 0 && selectedIds.size === records.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < records.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSort = (field: string) => {
    if (!onSort) return;

    const newDirection =
      currentSort?.field === field && currentSort?.direction === 'asc' ? 'desc' : 'asc';
    onSort(field, newDirection);
  };

  // Task Dialog Handlers
  const openTaskDialog = useCallback((recordId: string) => {
    setTaskRecordId(recordId);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    setTaskPriority('medium');
    setTaskDialogOpen(true);
  }, []);

  const closeTaskDialog = useCallback(() => {
    setTaskDialogOpen(false);
    setTaskRecordId(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    setTaskPriority('medium');
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!taskRecordId || !taskTitle.trim()) {
      toast.error('Task title is required');
      return;
    }

    setIsCreatingTask(true);
    try {
      const response = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: taskRecordId,
          title: taskTitle.trim(),
          description: taskDescription.trim() || null,
          due_at: taskDueDate || null,
          priority: taskPriority,
          activity_type: 'task',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create task');
      }

      toast.success('Task created successfully');
      closeTaskDialog();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  }, [taskRecordId, taskTitle, taskDescription, taskDueDate, taskPriority, closeTaskDialog]);

  const getSortIcon = (field: string) => {
    if (currentSort?.field !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    }
    return currentSort.direction === 'asc' ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const getColumnLabel = (col: string): string => {
    if (col === 'title') return 'Name';
    if (col === 'first_name') return 'First Name';
    if (col === 'last_name') return 'Last Name';
    if (col === 'middle_name') return 'Middle Name';
    if (col === 'preferred_name') return 'Preferred Name';
    if (col === 'salutation') return 'Salutation';
    if (col === 'contact_name') return 'Contact Name';
    if (col === 'record_id') return 'Record Id';
    if (col === 'status') return 'Status';
    if (col === 'lead_status') return 'Status';
    if (col === 'contact_status') return 'Status';
    if (col === 'owner_id') return 'Owner';
    if (col === 'market_type') return 'Market Type';
    if (col === 'normalized_advisor_name') return 'Advisor';
    if (col === 'normalized_agent_name') return 'Agent';
    if (col === 'normalization_status') return 'Data Quality';
    if (col === 'created_at') return 'Created';
    if (col === 'updated_at') return 'Updated';
    return fieldMap[col]?.label || col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Per-row projected JSONB (legacy Zoho → canonical HS keys) so list columns
  // like sharing_member_id show stored truth before/without DB backfill.
  const projectedDataByRecordId = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const record of records) {
      map.set(
        record.id,
        mergeCrmRecordRowIntoFormDefaults(
          record as unknown as Record<string, unknown> & {
            data?: Record<string, unknown> | null;
            email?: string | null;
            phone?: string | null;
            status?: string | null;
          },
          { moduleKey },
        ),
      );
    }
    return map;
  }, [records, moduleKey]);

  const getProjectedData = (record: CrmRecord): Record<string, unknown> =>
    projectedDataByRecordId.get(record.id) ??
    ((record.data as Record<string, unknown> | undefined) ?? {});

  const renderCellValue = (record: CrmRecord, col: string): React.ReactNode => {
    const projected = getProjectedData(record);
    // Check if this cell is being edited
    const isEditing = editingCell?.recordId === record.id && editingCell?.field === col;

    if (isEditing) {
      const field = fieldMap[col] || null;
      const isStatusField = col === 'status' || col === 'lead_status' || col === 'contact_status';

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <InlineEditor
            field={field}
            value={editingCell.value}
            onSave={handleInlineEditSave}
            onCancel={handleInlineEditCancel}
            options={isStatusField ? STATUS_OPTIONS : undefined}
          />
        </div>
      );
    }

    // Build display name: prefer `preferred_name` over `first_name` so list/drawer
    // surfaces what the contact actually goes by. Legal first_name is preserved
    // on the record for enrollment / carrier compliance.
    if (col === 'title') {
      const preferredName = (record.data?.preferred_name as string) || '';
      const firstName = (record.data?.first_name as string) || '';
      const lastName = (record.data?.last_name as string) || '';
      const displayFirst = preferredName || firstName;
      const displayName = [displayFirst, lastName].filter(Boolean).join(' ') || record.title || 'Untitled';

      return (
        <Link
          href={`/crm/r/${record.id}`}
          className="font-medium text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate block"
          title={displayName}
          onClick={(e) => e.stopPropagation()}
        >
          {displayName}
        </Link>
      );
    }

    // Handle text fields that come from record.data (with system column fallback for email/phone)
    if (col === 'first_name' || col === 'last_name' || col === 'email' || col === 'phone' ||
      col === 'middle_name' || col === 'preferred_name' || col === 'salutation' || col === 'contact_name') {
      const value = (col === 'email')
        ? ((record.email || record.data?.email) as string | undefined)
        : (col === 'phone')
        ? ((record.phone || record.data?.phone) as string | undefined)
        : (record.data?.[col] as string | undefined);

      const content = !value ? (
        <span className="text-slate-400 dark:text-slate-600">—</span>
      ) : col === 'email' ? (
        <a
          href={`mailto:${value}`}
          className="text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate block"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span className="text-slate-700 dark:text-slate-300 truncate">{value}</span>
      );

      if (enableInlineEdit && onRecordUpdate) {
        return (
          <div
            className="group/cell cursor-text hover:bg-slate-100 dark:hover:bg-slate-800 -mx-2 px-2 py-1 rounded transition-colors"
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing(record.id, col, value || '');
            }}
            title="Double-click to edit"
          >
            {content}
            <Pencil className="w-3 h-3 ml-1 inline-block opacity-0 group-hover/cell:opacity-50 text-slate-400" />
          </div>
        );
      }

      return content;
    }

    if (col === 'status' || col === 'lead_status' || col === 'contact_status') {
      // Get status value, handling null, undefined, and boolean false properly
      const rawStatus = record.status ?? record.data?.[col] ?? record.data?.status;
      const status = (rawStatus === null || rawStatus === undefined || rawStatus === false || rawStatus === '')
        ? ''
        : String(rawStatus);
      if (!status) return <span className="text-slate-400 dark:text-slate-600">—</span>;

      const content = <StatusBadge status={status} />;

      if (enableInlineEdit && onRecordUpdate) {
        return (
          <div
            className="group/cell cursor-pointer inline-block"
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing(record.id, col, status);
            }}
            title="Double-click to edit"
          >
            {content}
          </div>
        );
      }

      return content;
    }

    if (col === 'owner_id') {
      return record.owner_id ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <User className="w-3 h-3" />
          </div>
          Assigned
        </span>
      ) : (
        <span className="text-slate-400 dark:text-slate-600">Unassigned</span>
      );
    }

    // ── Canonical Phase 2 fields ──
    if (col === 'market_type') {
      return <MarketTypeBadge marketType={(record as any).market_type} showIcon />;
    }

    if (col === 'normalized_advisor_name' || col === 'normalized_agent_name') {
      const value = (record as any)[col];
      if (!value) return <span className="text-slate-400 dark:text-slate-600">—</span>;
      return <span className="text-slate-700 dark:text-slate-300 truncate text-sm">{value}</span>;
    }

    if (col === 'normalization_status') {
      const status = (record as any).normalization_status;
      if (!status || status === 'normalized') {
        return <span className="text-emerald-600 dark:text-emerald-400 text-xs">Verified</span>;
      }
      return <NormalizationBadge status={status} />;
    }

    if (col === 'created_at') {
      return (
        <span className="text-sm text-slate-500" suppressHydrationWarning>
          {new Date(record.created_at).toLocaleDateString()}
        </span>
      );
    }

    if (col === 'updated_at') {
      return (
        <span className="text-sm text-slate-500" suppressHydrationWarning>
          {new Date(record.updated_at).toLocaleDateString()}
        </span>
      );
    }

    if (col === 'record_id') {
      return (
        <span className="text-sm text-slate-500 font-mono">
          {record.id.slice(0, 8)}...
        </span>
      );
    }

    // Custom fields from data (projected so legacy Zoho keys surface as canonical)
    const field = fieldMap[col];
    if (!field) {
      const value = projected[col] ?? record.data?.[col];
      if (!value) return <span className="text-slate-400 dark:text-slate-600">—</span>;
      return <span className="text-slate-700 dark:text-slate-300 truncate">{String(value)}</span>;
    }

    const value = projected[col] ?? record.data?.[col];
    const relatedValues = {
      ...((record.data ?? {}) as Record<string, unknown>),
      ...projected,
      phone: record.phone,
      email: record.email,
    };
    return (
      <FieldRenderer field={field} value={value} relatedValues={relatedValues} />
    );
  };

  if (isLoading) {
    return (
      <>
        {/* Desktop Loading Skeleton */}
        <div className="hidden md:block glass-card rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="animate-pulse">
            <div className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/5" style={{ height: ROW_HEIGHT }} />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b border-slate-200 dark:border-white/5 flex items-center px-4 gap-4" style={{ height: ROW_HEIGHT }}>
                <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </div>
        {/* Mobile Loading Skeleton */}
        <div className="md:hidden space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 p-4 animate-pulse">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="flex-1">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Handle row click - open drawer if callback provided, otherwise navigate
  const handleRowClick = (record: CrmRecord) => {
    if (onRowClick) {
      onRowClick(record.id);
    } else {
      router.push(`/crm/r/${record.id}`);
    }
  };

  // ── Power-user keyboard navigation ──────────────────────────────────────
  // Focus stays on the scroll container (an aria-activedescendant grid), which
  // survives virtualized rows unmounting on scroll; `activeRowIndex` (declared
  // with the other hooks above) drives the focus ring + the active descendant.
  // Arrows / j·k move, Enter (or o) opens, Space (or x) toggles selection,
  // Home/End jump, PageUp/Down page, Esc clears.
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Defer to inline-edit inputs and any focused interactive control (buttons,
    // links, checkboxes) — nav keys only act when the grid container itself is
    // focused (the aria-activedescendant pattern keeps focus there).
    if (editingCell) return;
    const t = e.target as HTMLElement;
    if (
      t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
      t.tagName === 'BUTTON' || t.tagName === 'A' || t.isContentEditable
    ) {
      return;
    }
    if (records.length === 0) return;

    const cur = activeRowIndex < 0 ? 0 : activeRowIndex;
    const go = (next: number) => {
      const clamped = Math.max(0, Math.min(records.length - 1, next));
      setActiveRowIndex(clamped);
      rowVirtualizer.scrollToIndex(clamped, { align: 'auto' });
    };
    const inRange = activeRowIndex >= 0 && activeRowIndex < records.length;

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        go(activeRowIndex < 0 ? 0 : cur + 1);
        break;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        go(activeRowIndex < 0 ? 0 : cur - 1);
        break;
      case 'Home':
        e.preventDefault();
        go(0);
        break;
      case 'End':
        e.preventDefault();
        go(records.length - 1);
        break;
      case 'PageDown':
        e.preventDefault();
        go(cur + 12);
        break;
      case 'PageUp':
        e.preventDefault();
        go(cur - 12);
        break;
      case 'Enter':
      case 'o':
        if (inRange) {
          e.preventDefault();
          handleRowClick(records[activeRowIndex]);
        }
        break;
      case ' ':
      case 'x':
        if (inRange) {
          e.preventDefault();
          handleSelectRow(records[activeRowIndex].id);
        }
        break;
      case 'Escape':
        setActiveRowIndex(-1);
        break;
      default:
        break;
    }
  };

  const activeDescId =
    activeRowIndex >= 0 && activeRowIndex < records.length
      ? `crm-row-${records[activeRowIndex].id}`
      : undefined;

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden">
        {records.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 p-8 text-center">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
              <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No records found</p>
            <p className="text-sm text-slate-500 mb-4">
              Get started by creating a new record.
            </p>
            <Button
              asChild
            >
              <Link href={`/crm/modules/${moduleKey}/new`}>
                <Plus className="w-4 h-4 mr-2" />
                Create Record
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mobile Select All */}
            {records.length > 0 && (
              <div className="flex items-center gap-3 px-1 py-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all (${records.length})`}
                </span>
              </div>
            )}
            {records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                isSelected={selectedIds.has(record.id)}
                onSelect={() => handleSelectRow(record.id)}
                onClick={() => handleRowClick(record)}
                moduleKey={moduleKey}
                onAddTask={() => openTaskDialog(record.id)}
                onDelete={() => onBulkDelete?.([record.id])}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div
        ref={tableContainerRef}
        onWheel={(e) => {
          // Shift+scroll = horizontal scroll for desktop mouse users
          if (e.shiftKey && tableContainerRef.current) {
            e.preventDefault();
            tableContainerRef.current.scrollLeft += e.deltaY;
          }
        }}
        // Keyboard-navigable grid: Tab or click into it, then arrows / j·k to
        // move, Enter to open, Space to select. Focus stays here (survives
        // virtualized row remount) and the active row is announced via
        // aria-activedescendant.
        role="grid"
        tabIndex={0}
        aria-label="Records — arrow keys to move, Enter to open, Space to select"
        aria-rowcount={records.length}
        aria-activedescendant={activeDescId}
        onKeyDown={handleGridKeyDown}
        className={cn(
          'hidden md:block glass-card rounded-lg border border-slate-200 dark:border-white/10 overflow-auto max-h-[calc(100vh-var(--crm-view-offset))] scrollbar-thin sticky-scrollbar',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/40',
          isResizing && 'select-none'
        )}
        // Measured cap wins once mounted; the CSS max-h above is the pre-measure
        // (SSR / first-paint) fallback so the table is never briefly unbounded.
        style={measuredMaxH ? { maxHeight: `${measuredMaxH}px` } : undefined}
      >
      <Table style={{ minWidth: totalMinWidth }}>
        <TableHeader className={cn(
          'sticky top-0 z-10 transition-shadow block',
          isScrolled && 'shadow-md shadow-black/5 dark:shadow-black/20'
        )}>
          <TableRow className="border-b border-slate-200 dark:border-white/5 hover:bg-transparent flex" style={{ minWidth: totalMinWidth, height: ROW_HEIGHT }}>
            <TableHead className="w-12 flex-shrink-0 flex items-center bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm sticky left-0 z-20" style={{ width: 48, minWidth: 48, maxWidth: 48 }}>
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={handleSelectAll}
                aria-label="Select all rows"
                className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500 data-[state=indeterminate]:bg-teal-500 data-[state=indeterminate]:border-teal-500"
              />
            </TableHead>
            {visibleColumns.map((col, colIndex) => (
              <TableHead
                key={col}
                aria-sort={
                  !onSort
                    ? undefined
                    : currentSort?.field === col
                      ? currentSort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                }
                tabIndex={onSort ? 0 : undefined}
                onKeyDown={
                  onSort
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSort(col);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'relative flex-shrink-0 flex items-center bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm text-slate-600 dark:text-slate-400 font-medium text-xs uppercase tracking-wider',
                  onSort && 'cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  colIndex === 0 && 'sticky z-20 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[3px] after:bg-gradient-to-r after:from-black/[0.06] after:to-transparent dark:after:from-white/[0.08]'
                )}
                style={{
                  width: getColWidth(col),
                  minWidth: 80,
                  ...(colIndex === 0 ? { left: stickyFirstColLeft } : {}),
                }}
                onClick={() => handleSort(col)}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {getColumnLabel(col)}
                  {onSort && getSortIcon(col)}
                </div>
                <ResizeHandle
                  columnKey={col}
                  onResizeStart={onResizeStart}
                  onResetWidth={resetColumnWidth}
                />
              </TableHead>
            ))}
            <TableHead className="w-28 flex-shrink-0 flex items-center bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm" style={{ width: 112, minWidth: 112, maxWidth: 112 }} />
          </TableRow>
        </TableHeader>
        <TableBody
          style={{
            height: records.length > 0 ? `${rowVirtualizer.getTotalSize()}px` : undefined,
            position: 'relative',
            display: 'block',
            minWidth: totalMinWidth,
          }}
        >
          {records.length === 0 ? (
            <TableRow style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
              <TableCell colSpan={visibleColumns.length + 2} className="h-64">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 mb-4">
                    <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
                  </div>
                  <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No records found</p>
                  <p className="text-sm text-slate-500 mb-4">
                    Get started by creating a new record or importing data.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      asChild
                    >
                      <Link href={`/crm/import?module=${moduleKey}`}>
                        <FileText className="w-4 h-4 mr-2" />
                        Import Data
                      </Link>
                    </Button>
                    <Button
                      asChild
                    >
                      <Link href={`/crm/modules/${moduleKey}/new`}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Record
                      </Link>
                    </Button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const record = records[virtualRow.index];
              return (
                <TableRow
                  key={record.id}
                  id={`crm-row-${record.id}`}
                  data-index={virtualRow.index}
                  aria-selected={selectedIds.has(record.id)}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    minWidth: totalMinWidth,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    'group border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors flex',
                    'hover:bg-slate-50 dark:hover:bg-white/5',
                    selectedIds.has(record.id) && 'bg-teal-50 dark:bg-teal-500/5',
                    // Keyboard-focused row: stronger tint + inset ring, distinct
                    // from hover (subtle) and selected (checkbox teal).
                    virtualRow.index === activeRowIndex &&
                      'bg-teal-100/70 dark:bg-teal-500/15 ring-2 ring-inset ring-teal-500/60'
                  )}
                  onClick={() => {
                    setActiveRowIndex(virtualRow.index);
                    handleRowClick(record);
                  }}
                  onMouseEnter={() => handleRowMouseEnter(record.id)}
                  onMouseLeave={handleRowMouseLeave}
                >
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'w-12 flex-shrink-0 flex items-center sticky left-0 z-10 !py-[var(--crm-cell-py)]',
                      selectedIds.has(record.id)
                        ? 'bg-teal-50 dark:bg-teal-500/5'
                        : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-white/5'
                    )}
                    style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                  >
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onCheckedChange={() => handleSelectRow(record.id)}
                      className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
                    />
                  </TableCell>
                  {visibleColumns.map((col, colIndex) => (
                    <TableCell
                      key={col}
                      className={cn(
                        'text-sm flex-shrink-0 flex items-center overflow-hidden !py-[var(--crm-cell-py)]',
                        colIndex === 0 && 'sticky z-10 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[3px] after:bg-gradient-to-r after:from-black/[0.06] after:to-transparent dark:after:from-white/[0.08]',
                        colIndex === 0 && (
                          selectedIds.has(record.id)
                            ? 'bg-teal-50 dark:bg-teal-500/5'
                            : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-white/5'
                        )
                      )}
                      style={{
                        width: getColWidth(col),
                        minWidth: 80,
                        ...(colIndex === 0 ? { left: stickyFirstColLeft } : {}),
                      }}
                    >
                      {/* Surface a compact dirty-dot inside the first
                        * (sticky) cell so the rep sees at a glance that
                        * *this* record has pending syncs without
                        * crowding out the label. */}
                      {colIndex === 0 ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <RecordQueuedBadge recordId={record.id} compact />
                          {/* Icon-only flag — never inline the full signal
                              label here (it was replacing first names with
                              "Coverage incomplete…" yellow pills). */}
                          <NeedsAttentionChip record={record} moduleKey={moduleKey} compact />
                          <div className="min-w-0 flex-1 truncate">
                            {renderCellValue(record, col)}
                          </div>
                        </div>
                      ) : (
                        renderCellValue(record, col)
                      )}

                    </TableCell>
                  ))}
                  <TableCell onClick={(e) => e.stopPropagation()} className="w-28 flex-shrink-0 flex items-center !py-[var(--crm-cell-py)]" style={{ width: 112, minWidth: 112, maxWidth: 112 }}>
                    {/* Row Quick Actions - visible on hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      {/* Call - only if phone exists */}
                      {record.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${record.phone}`;
                          }}
                          className="h-7 w-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      {/* Email - only if email exists */}
                      {record.email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `mailto:${record.email}`;
                          }}
                          className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10"
                          title="Send Email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      {/* Add Task */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskDialog(record.id);
                        }}
                        className="h-7 w-7 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-500/10"
                        title="Add Task"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </Button>

                      {/* More Actions Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                          <DropdownMenuItem
                            onClick={() => router.push(`/crm/r/${record.id}`)}
                            className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/crm/r/${record.id}?edit=true`)}
                            className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                            onClick={() => onBulkDelete?.([record.id])}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      </div>

      {/* Add Task Dialog - shared between mobile and desktop */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => !open && closeTaskDialog()}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Add a new task for this record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Enter task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateTask();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description
              </label>
              <Textarea
                placeholder="Add details about this task..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Priority
                </label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as 'low' | 'medium' | 'high' | 'urgent')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeTaskDialog} disabled={isCreatingTask} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!taskTitle.trim() || isCreatingTask} className="w-full sm:w-auto">
              {isCreatingTask ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
