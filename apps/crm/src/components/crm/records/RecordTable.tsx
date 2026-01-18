'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import { FieldRenderer } from './FieldRenderer';
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
      await onSave(editValue);
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
            {selectOptions.map((opt: string) => (
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

  // Number field
  if (fieldType === 'number' || fieldType === 'currency') {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="number"
          value={String(editValue)}
          onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : '')}
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
  if (fieldType === 'date' || fieldType === 'datetime') {
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

export function RecordTable({
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
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Status options for common status fields
  const STATUS_OPTIONS = [
    'Active', 'Inactive', 'New', 'Contacted', 'Qualified', 'Working',
    'Converted', 'Lost', 'Hot Prospect - ready to move', 'Prospect',
  ];

  // Handle inline edit save
  const handleInlineEditSave = useCallback(async (value: unknown) => {
    if (!editingCell || !onRecordUpdate) return;

    try {
      const record = records.find(r => r.id === editingCell.recordId);
      if (!record) return;

      // Determine if this is a system field or data field
      const isSystemField = ['status', 'title', 'owner_id'].includes(editingCell.field);

      const updates: Record<string, unknown> = isSystemField
        ? { [editingCell.field]: value }
        : { data: { ...record.data, [editingCell.field]: value } };

      await onRecordUpdate(editingCell.recordId, updates);
      toast.success('Updated successfully');
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Failed to update');
    } finally {
      setEditingCell(null);
    }
  }, [editingCell, onRecordUpdate, records]);

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

  // Create field lookup map
  const fieldMap = useMemo(() => {
    return fields.reduce((acc, field) => {
      acc[field.key] = field;
      return acc;
    }, {} as Record<string, CrmField>);
  }, [fields]);

  // Get visible columns from view or explicit columns
  const visibleColumns = useMemo(() => {
    const columns = explicitColumns || view?.columns || ['title', 'status', 'email', 'created_at'];
    return columns.filter((col) => fieldMap[col] || ['title', 'status', 'owner_id', 'created_at', 'email', 'phone', 'first_name', 'last_name', 'lead_status', 'contact_status'].includes(col));
  }, [explicitColumns, view?.columns, fieldMap]);

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
    if (col === 'status') return 'Status';
    if (col === 'lead_status') return 'Status';
    if (col === 'contact_status') return 'Status';
    if (col === 'owner_id') return 'Owner';
    if (col === 'created_at') return 'Created';
    return fieldMap[col]?.label || col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const renderCellValue = (record: CrmRecord, col: string): React.ReactNode => {
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

    // Build display name from first_name and last_name if available
    if (col === 'title') {
      const firstName = record.data?.first_name || '';
      const lastName = record.data?.last_name || '';
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || record.title || 'Untitled';
      
      return (
        <Link
          href={`/crm/r/${record.id}`}
          className="font-medium text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {displayName}
        </Link>
      );
    }
    
    if (col === 'first_name' || col === 'last_name' || col === 'email' || col === 'phone') {
      const value = record.data?.[col] as string | undefined;

      const content = !value ? (
        <span className="text-slate-400 dark:text-slate-600">—</span>
      ) : col === 'email' ? (
        <a
          href={`mailto:${value}`}
          className="text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span className="text-slate-700 dark:text-slate-300">{value}</span>
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
      const status = record.status || String(record.data?.[col] || record.data?.status || '');
      if (!status) return <span className="text-slate-400 dark:text-slate-600">—</span>;

      const style = STATUS_STYLES[status] || { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' };

      const content = (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
          {status}
        </span>
      );

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
    
    if (col === 'created_at') {
      return (
        <span className="text-sm text-slate-500">
          {new Date(record.created_at).toLocaleDateString()}
        </span>
      );
    }

    // Custom fields from data
    const field = fieldMap[col];
    if (!field) {
      const value = record.data?.[col];
      if (!value) return <span className="text-slate-400 dark:text-slate-600">—</span>;
      return <span className="text-slate-700 dark:text-slate-300">{String(value)}</span>;
    }

    const value = record.data?.[col];
    return <FieldRenderer field={field} value={value} />;
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/5" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 border-b border-slate-200 dark:border-white/5 flex items-center px-4 gap-4">
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
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

  return (
    <div 
      ref={tableContainerRef}
      className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-auto max-h-[calc(100vh-280px)]"
    >
      <Table>
        <TableHeader className={cn(
          'sticky top-0 z-10 transition-shadow',
          isScrolled && 'shadow-md shadow-black/5 dark:shadow-black/20'
        )}>
          <TableRow className="border-b border-slate-200 dark:border-white/5 hover:bg-transparent">
            <TableHead className="w-12 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked';
                }}
                onCheckedChange={handleSelectAll}
                className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
              />
            </TableHead>
            {visibleColumns.map((col) => (
              <TableHead
                key={col}
                className={cn(
                  'bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm text-slate-600 dark:text-slate-400 font-medium text-xs uppercase tracking-wider',
                  onSort && 'cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none'
                )}
                onClick={() => handleSort(col)}
              >
                <div className="flex items-center gap-1.5">
                  {getColumnLabel(col)}
                  {onSort && getSortIcon(col)}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-28 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
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
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400"
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
            records.map((record, idx) => (
              <TableRow
                key={record.id}
                className={cn(
                  'group border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors',
                  'hover:bg-slate-50 dark:hover:bg-white/5',
                  selectedIds.has(record.id) && 'bg-teal-50 dark:bg-teal-500/5'
                )}
                onClick={() => handleRowClick(record)}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(record.id)}
                    onCheckedChange={() => handleSelectRow(record.id)}
                    className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
                  />
                </TableCell>
                {visibleColumns.map((col) => (
                  <TableCell key={col} className="text-sm">
                    {renderCellValue(record, col)}
                  </TableCell>
                ))}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {/* Row Quick Actions - visible on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        // TODO: Open add task dialog
                        console.log('Add task for', record.id);
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
