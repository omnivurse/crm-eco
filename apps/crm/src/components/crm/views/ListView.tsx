'use client';

import { memo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  CheckSquare,
  User,
  Inbox,
  Plus,
  Calendar,
} from 'lucide-react';
import type { CrmRecord, CrmField } from '@/lib/crm/types';

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

function getInitials(record: CrmRecord): string {
  const firstName = String(record.data?.first_name || '');
  const lastName = String(record.data?.last_name || '');
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  const name = getDisplayName(record);
  if (name && name !== 'Untitled') {
    const parts = name.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name[0].toUpperCase();
  }
  return '?';
}

function getDisplayName(record: CrmRecord): string {
  if (record.title && record.title !== 'Untitled') return record.title;
  const firstName = record.data?.first_name || '';
  const lastName = record.data?.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || record.data?.account_name as string || record.data?.name as string || record.title || 'Untitled';
}

function getStatusInfo(record: CrmRecord) {
  const rawStatus = record.status ?? record.data?.status ?? record.data?.lead_status ?? record.data?.contact_status;
  const status = rawStatus ? String(rawStatus) : '';
  const style = STATUS_STYLES[status] || { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' };
  return { status, style };
}

const AVATAR_COLORS = [
  'bg-teal-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-indigo-500',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ListViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (recordId: string) => void;
  onBulkDelete?: (ids: string[]) => void;
}

const ListRow = memo(function ListRow({
  record,
  isSelected,
  onSelect,
  onClick,
  moduleKey,
  onDelete,
}: {
  record: CrmRecord;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  moduleKey: string;
  onDelete?: () => void;
}) {
  const displayName = getDisplayName(record);
  const initials = getInitials(record);
  const { status, style: statusStyle } = getStatusInfo(record);
  const email = (record.email || record.data?.email) as string | undefined;
  const phone = (record.phone || record.data?.phone) as string | undefined;
  const avatarColor = getAvatarColor(record.id);

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors group',
        'hover:bg-slate-50 dark:hover:bg-white/[0.03]',
        isSelected && 'bg-teal-50/50 dark:bg-teal-500/5'
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
        />
      </div>

      {/* Avatar */}
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0',
        avatarColor
      )}>
        {initials}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link
            href={`/crm/r/${record.id}`}
            className="font-semibold text-sm text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {displayName}
          </Link>
          {status && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border flex-shrink-0',
              statusStyle.bg, statusStyle.text, statusStyle.border
            )}>
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400 truncate max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="w-3 h-3 flex-shrink-0" />
              {email}
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="w-3 h-3 flex-shrink-0" />
              {phone}
            </a>
          )}
        </div>
      </div>

      {/* Owner */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 w-24">
        {record.owner_id ? (
          <>
            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-3 h-3" />
            </div>
            <span>Assigned</span>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-600">Unassigned</span>
        )}
      </div>

      {/* Date */}
      <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 w-28" suppressHydrationWarning>
        <Calendar className="w-3 h-3" />
        {new Date(record.created_at).toLocaleDateString()}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {phone && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { window.location.href = `tel:${phone}`; }}
            className="h-7 w-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </Button>
        )}
        {email && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { window.location.href = `mailto:${email}`; }}
            className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10"
            title="Email"
          >
            <Mail className="w-3.5 h-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            <DropdownMenuItem onClick={() => onClick()} className="cursor-pointer">
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <DropdownMenuItem
              className="text-red-600 dark:text-red-400 cursor-pointer"
              onClick={() => onDelete?.()}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

export const ListView = memo(function ListView({
  records,
  fields,
  moduleKey,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onBulkDelete,
}: ListViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual returns mutable virtualizer by design
  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleRowClick = useCallback((recordId: string) => {
    if (onRowClick) {
      onRowClick(recordId);
    } else {
      router.push(`/crm/r/${recordId}`);
    }
  }, [onRowClick, router]);

  const handleSelectRow = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const allSelected = records.length > 0 && selectedIds.size === records.length;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(records.map(r => r.id)));
    }
  }, [allSelected, records, onSelectionChange]);

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
          <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No records found</p>
        <p className="text-sm text-slate-500 mb-4">Get started by creating a new record.</p>
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
    <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
      {/* Select All Header */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
        <Checkbox
          checked={allSelected}
          onCheckedChange={handleSelectAll}
          className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
        />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${records.length} records`}
        </span>
      </div>

      {/* Virtualized List */}
      <div
        ref={containerRef}
        className="overflow-auto max-h-[calc(100vh-var(--crm-view-offset)-100px)] scrollbar-thin"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const record = records[virtualRow.index];
            return (
              <div
                key={record.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ListRow
                  record={record}
                  isSelected={selectedIds.has(record.id)}
                  onSelect={() => handleSelectRow(record.id)}
                  onClick={() => handleRowClick(record.id)}
                  moduleKey={moduleKey}
                  onDelete={() => onBulkDelete?.([record.id])}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
