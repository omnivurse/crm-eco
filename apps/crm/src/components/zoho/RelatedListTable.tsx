'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { Plus, ExternalLink, MoreHorizontal, Inbox } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface RelatedListTableProps {
  title: string;
  icon?: React.ReactNode;
  items: Record<string, unknown>[];
  columns: Column[];
  onAdd?: () => void;
  onViewAll?: () => void;
  emptyMessage?: string;
  maxItems?: number;
  className?: string;
}

export function RelatedListTable({
  title,
  icon,
  items,
  columns,
  onAdd,
  onViewAll,
  emptyMessage = 'No items yet',
  maxItems = 5,
  className,
}: RelatedListTableProps) {
  const displayItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  return (
    <div className={cn('glass-card rounded-xl border border-slate-200 dark:border-white/10', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-500 dark:text-slate-400">{icon}</span>}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <Badge variant="secondary" className="ml-1 text-xs">
            {items.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              className="h-7 px-2 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          )}
          {onViewAll && items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAll}
              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-white"
            >
              View All
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
          {onAdd && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAdd}
              className="mt-3 text-xs border-slate-200 dark:border-white/10"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add {title.replace(/s$/, '')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 dark:border-white/5 hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 py-2 px-4"
                  >
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item, idx) => (
                <TableRow
                  key={idx}
                  className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className="py-2 px-4 text-sm">
                      {col.render 
                        ? col.render(item[col.key], item)
                        : formatCellValue(item[col.key])
                      }
                    </TableCell>
                  ))}
                  <TableCell className="py-2 px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                        <DropdownMenuItem className="text-xs cursor-pointer">
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs cursor-pointer">
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs cursor-pointer text-red-600 dark:text-red-400">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {hasMore && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-white/5">
              <button
                onClick={onViewAll}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
              >
                View {items.length - maxItems} more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-slate-400 dark:text-slate-600">—</span>;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
