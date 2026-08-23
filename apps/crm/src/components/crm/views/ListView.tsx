'use client';

import { memo, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { currentListReturnTo, statusToneForValue, withReturnTo } from '@/lib/crm/status-lanes';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import { Button } from '@crm-eco/ui/components/button';
import { CallLink } from '@/components/crm/records/CallLink';
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
  SearchX,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import type { CrmRecord, CrmField } from '@/lib/crm/types';
import {
  readListQueryState,
  recordNounFromModuleKey,
  requestClearListState,
  resolveListEmptyState,
  type ListEmptyState,
} from '@/lib/crm/list-empty-state';

// ============================================================================
// Filter-aware empty state — shared by ListView and RecordTable
// ============================================================================

/**
 * Reads the URL-driven list state and decides which empty state applies.
 * Returns `null` while there are rows so callers can early-out.
 *
 * `activeViewFilterCount` — how many filters the active saved (crm_view)
 * view applies. When known, an explicit `?view=` only counts as narrowing
 * when the view actually filters (an "All Contacts" view is not narrowing);
 * when unknown (`undefined`) the URL presence of `?view=` decides, as before.
 */
export function useListEmptyState(
  recordCount: number,
  moduleKey: string,
  totalCount?: number | null,
  activeViewFilterCount?: number | null,
  loadError?: boolean,
): ListEmptyState | null {
  const searchParams = useSearchParams();
  return useMemo(() => {
    if (recordCount > 0) return null;
    const query = readListQueryState(searchParams);
    if (query.viewId && typeof activeViewFilterCount === 'number' && activeViewFilterCount <= 0) {
      query.viewId = null;
    }
    return resolveListEmptyState({
      recordCount,
      totalCount,
      query,
      recordNoun: recordNounFromModuleKey(moduleKey),
      loadError,
    });
  }, [recordCount, totalCount, activeViewFilterCount, searchParams, moduleKey, loadError]);
}

/**
 * The empty panel itself. Clear buttons dispatch `crm:clear-list-state`,
 * which ModuleShell answers with its existing clear handlers (so the URL,
 * chips bar and toolbar all stay in sync). Create/Import only render for a
 * genuinely empty module.
 */
export function ListEmptyStatePanel({
  state,
  moduleKey,
  className,
  compact = false,
}: {
  state: ListEmptyState;
  moduleKey: string;
  className?: string;
  compact?: boolean;
}) {
  const failed = state.reason === 'load-failed';
  const isNarrowed = state.reason !== 'no-records';
  const Icon = failed ? AlertTriangle : isNarrowed ? SearchX : Inbox;
  return (
    <div
      role="status"
      aria-live="polite"
      data-reason={state.reason}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'p-8' : 'p-12',
        className,
      )}
    >
      <div className={cn('p-4 rounded-full mb-4', failed ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-100 dark:bg-slate-800/50')}>
        <Icon className={cn('w-10 h-10', failed ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600')} aria-hidden />
      </div>
      <p className="text-lg font-medium text-slate-900 dark:text-white mb-1 break-words max-w-md">
        {state.title}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md">{state.description}</p>
      {state.actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {state.actions.map((action, i) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={i === 0 ? 'default' : 'outline'}
              className={i === 0 ? undefined : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}
              onClick={() => requestClearListState({ moduleKey, target: action.id })}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {state.showCreateImport && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            asChild
          >
            <Link href={`/crm/import?module=${moduleKey}`}>
              <FileText className="w-4 h-4 mr-2" aria-hidden />
              Import Data
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/crm/modules/${moduleKey}/new`}>
              <Plus className="w-4 h-4 mr-2" aria-hidden />
              Create Record
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}


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

function getStatusValue(record: CrmRecord): string {
  const rawStatus = record.status ?? record.data?.status ?? record.data?.lead_status ?? record.data?.contact_status;
  return rawStatus ? String(rawStatus) : '';
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
  /** Filtered total from the server — distinguishes "page out of range" from "no match". */
  totalCount?: number | null;
  /** Filter count of the active saved view (see `useListEmptyState`). */
  activeViewFilterCount?: number | null;
  /** The server failed to load rows — render the retry state, never the Create CTA. */
  loadError?: boolean;
  fillParent?: boolean;
}

const ListRow = memo(function ListRow({
  record,
  isSelected,
  onSelect,
  onClick,
  moduleKey,
  recordHref,
  onDelete,
}: {
  record: CrmRecord;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  moduleKey: string;
  /** Record page URL carrying `?returnTo=<this list>` so Back keeps list state. */
  recordHref: string;
  onDelete?: () => void;
}) {
  const displayName = getDisplayName(record);
  const initials = getInitials(record);
  const status = getStatusValue(record);
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
            href={recordHref}
            className="font-semibold text-sm text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {displayName}
          </Link>
          {status && (
            // Lane tone (lib/crm/status-lanes) — same colour as RecordTable, the record header and the desk.
            <StatusBadge status={status} tone={statusToneForValue(status)} size="sm" className="flex-shrink-0" />
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
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {phone && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10"
          >
            {/* TE-8: a real tel: anchor (CallLink stops row-click propagation). */}
            <CallLink phone={phone} title="Call" aria-label={`Call ${phone}`} data-testid="crm-row-call">
              <Phone className="w-3.5 h-3.5" />
            </CallLink>
          </Button>
        )}
        {email && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { window.location.href = `mailto:${email}`; }}
            className="h-7 w-7 text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:text-primary dark:hover:bg-primary/10"
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
  totalCount,
  activeViewFilterCount,
  loadError,
  fillParent = false,
}: ListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const emptyState = useListEmptyState(records.length, moduleKey, totalCount, activeViewFilterCount, loadError);
  // Back keeps list state: row links carry `?returnTo=<this list URL>` (validated
  // by RecordDetailShellV2's sanitizeReturnTo).
  const listReturnTo = useMemo(
    () => currentListReturnTo(pathname, searchParams?.toString()),
    [pathname, searchParams],
  );
  const recordHref = useCallback(
    (recordId: string) => withReturnTo(`/crm/r/${recordId}`, listReturnTo),
    [listReturnTo],
  );

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
      router.push(recordHref(recordId));
    }
  }, [onRowClick, router, recordHref]);

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

  if (emptyState) {
    return (
      <div className={cn('glass-card rounded-2xl border border-slate-200 dark:border-white/10', fillParent && 'h-full min-h-0')}>
        <ListEmptyStatePanel state={emptyState} moduleKey={moduleKey} />
      </div>
    );
  }

  return (
    <div className={cn('glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden', fillParent && 'h-full min-h-0 flex flex-col')}>
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
                  recordHref={recordHref(record.id)}
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
