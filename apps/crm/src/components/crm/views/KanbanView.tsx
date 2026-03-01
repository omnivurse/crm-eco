'use client';

import { useState, useCallback, useMemo, memo } from 'react';
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';
import type { CrmRecord, CrmField } from '@/lib/crm/types';

interface KanbanViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  onRowClick?: (recordId: string) => void;
  onBulkDelete?: (ids: string[]) => void;
}

interface KanbanColumn {
  key: string;
  label: string;
  color: string;
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

// Sortable Kanban Card
const KanbanCard = memo(function KanbanCard({
  record,
  isDragOverlay,
  onRowClick,
  onDelete,
}: {
  record: CrmRecord;
  isDragOverlay?: boolean;
  onRowClick?: (id: string) => void;
  onDelete?: () => void;
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
            {amount > 0 && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  ${amount.toLocaleString()}
                </span>
              </div>
            )}

            {email && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{email}</span>
              </div>
            )}

            {expectedClose && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span suppressHydrationWarning>{new Date(expectedClose).toLocaleDateString()}</span>
              </div>
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
            <DropdownMenuContent align="end" className="w-36 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
              <DropdownMenuItem onClick={() => onRowClick?.(record.id)} className="cursor-pointer text-sm">
                <Eye className="w-3.5 h-3.5 mr-2" />
                View
              </DropdownMenuItem>
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
  index,
  onRowClick,
  onDelete,
}: {
  column: KanbanColumn;
  records: CrmRecord[];
  index: number;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const totalAmount = records.reduce((sum, r) => sum + (Number(r.data?.amount) || 0), 0);

  return (
    <div className="flex flex-col w-[300px] min-w-[300px] flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {column.label || 'No Value'}
        </h3>
        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {records.length}
        </Badge>
        {totalAmount > 0 && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-auto font-medium">
            ${totalAmount.toLocaleString()}
          </span>
        )}
      </div>

      {/* Column Body */}
      <SortableContext
        id={column.key}
        items={records.map(r => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 space-y-2 min-h-[100px] p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-white/5">
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
}: KanbanViewProps) {
  const router = useRouter();

  // Determine groupable fields with a default
  const groupableFields = useMemo(() => {
    const selectFields = getGroupableFields(fields);
    const systemFields: CrmField[] = [];
    if (!selectFields.find(f => f.key === 'status')) {
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
  }, [fields]);

  const [groupByField, setGroupByField] = useState<string>(
    groupableFields[0]?.key || 'status'
  );
  const [records, setRecords] = useState(initialRecords);
  const [activeDragRecord, setActiveDragRecord] = useState<CrmRecord | null>(null);

  // Build columns from unique values
  const columns = useMemo((): KanbanColumn[] => {
    const field = fields.find(f => f.key === groupByField);
    const uniqueValues = new Set<string>();

    // First add field options (if select type)
    if (field?.options) {
      const opts = Array.isArray(field.options) ? field.options : [];
      opts.forEach(o => uniqueValues.add(o));
    }

    // Then add actual values from records
    records.forEach(r => {
      const val = getFieldValue(r, groupByField);
      if (val) uniqueValues.add(val);
    });

    // Always add an empty column for records without a value
    const cols: KanbanColumn[] = [];
    let idx = 0;
    uniqueValues.forEach(val => {
      cols.push({
        key: val,
        label: val,
        color: COLUMN_COLORS[idx % COLUMN_COLORS.length],
      });
      idx++;
    });

    // Add "No Value" column if any records lack the field
    const hasUnassigned = records.some(r => !getFieldValue(r, groupByField));
    if (hasUnassigned) {
      cols.push({
        key: '__none__',
        label: 'No Value',
        color: '#94A3B8',
      });
    }

    return cols;
  }, [records, fields, groupByField]);

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
        const isSystemField = ['status', 'lead_status', 'contact_status', 'stage'].includes(groupByField);
        const updateField = groupByField === 'lead_status' || groupByField === 'contact_status' ? 'status' : groupByField;

        const updates: Record<string, unknown> = isSystemField
          ? { [updateField]: newVal }
          : { data: { ...record.data, [groupByField]: newVal } };

        const response = await fetch(`/api/crm/records/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error('Failed to update');
        toast.success(`Moved to "${newVal || 'No Value'}"`);
      } catch {
        toast.error('Failed to move record');
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

  if (initialRecords.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
          <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No records to display</p>
        <p className="text-sm text-slate-500 mb-4">Create records to see them on the board.</p>
        <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400" asChild>
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
            {columns.map((column, index) => (
              <Column
                key={column.key}
                column={column}
                records={recordsByColumn[column.key] || []}
                index={index}
                onRowClick={handleRowClick}
                onDelete={(id) => onBulkDelete?.([id])}
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
    </div>
  );
});
