'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';

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
}

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
}: RecordTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

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
    return columns.filter((col) => fieldMap[col] || ['title', 'status', 'owner_id', 'created_at', 'email', 'phone'].includes(col));
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
      return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />;
    }
    return currentSort.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const getColumnLabel = (col: string): string => {
    if (col === 'title') return 'Name';
    if (col === 'status') return 'Status';
    if (col === 'owner_id') return 'Owner';
    if (col === 'created_at') return 'Created';
    return fieldMap[col]?.label || col;
  };

  const renderCellValue = (record: CrmRecord, col: string): React.ReactNode => {
    // System fields
    if (col === 'title') {
      return (
        <Link
          href={`/crm/r/${record.id}`}
          className="font-medium text-brand-navy-800 hover:text-brand-teal-600 hover:underline"
        >
          {record.title || 'Untitled'}
        </Link>
      );
    }
    
    if (col === 'status') {
      return record.status ? (
        <Badge variant="secondary">{record.status}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    
    if (col === 'owner_id') {
      return record.owner_id ? (
        <span className="inline-flex items-center gap-1 text-sm">
          <User className="w-3 h-3" />
          {/* In real app, would show owner name */}
          Owner
        </span>
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      );
    }
    
    if (col === 'created_at') {
      return (
        <span className="text-sm text-muted-foreground">
          {new Date(record.created_at).toLocaleDateString()}
        </span>
      );
    }

    // Custom fields from data
    const field = fieldMap[col];
    if (!field) return <span className="text-muted-foreground">—</span>;

    const value = record.data[col];
    return <FieldRenderer field={field} value={value} />;
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white">
        <div className="animate-pulse">
          <div className="h-12 bg-muted/50 border-b" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 border-b flex items-center px-4 gap-4">
              <div className="w-4 h-4 bg-muted rounded" />
              <div className="flex-1 h-4 bg-muted rounded" />
              <div className="w-24 h-4 bg-muted rounded" />
              <div className="w-20 h-4 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-brand-navy-50 border-b px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            {onBulkUpdate && (
              <Button variant="outline" size="sm">
                Update
              </Button>
            )}
            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onBulkDelete(Array.from(selectedIds))}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked';
                }}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            {visibleColumns.map((col) => (
              <TableHead
                key={col}
                className={cn(
                  'cursor-pointer hover:bg-muted/50 transition-colors',
                  onSort && 'select-none'
                )}
                onClick={() => handleSort(col)}
              >
                <div className="flex items-center gap-1">
                  {getColumnLabel(col)}
                  {onSort && getSortIcon(col)}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length + 2} className="h-32 text-center">
                <div className="text-muted-foreground">
                  <p className="text-lg font-medium">No records found</p>
                  <p className="text-sm">Try adjusting your filters or create a new record.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow
                key={record.id}
                className={cn(
                  'cursor-pointer hover:bg-muted/50',
                  selectedIds.has(record.id) && 'bg-brand-teal-50'
                )}
                onClick={() => router.push(`/crm/r/${record.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(record.id)}
                    onCheckedChange={() => handleSelectRow(record.id)}
                  />
                </TableCell>
                {visibleColumns.map((col) => (
                  <TableCell key={col}>{renderCellValue(record, col)}</TableCell>
                ))}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/crm/r/${record.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/crm/r/${record.id}?edit=true`)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onBulkDelete?.([record.id])}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
