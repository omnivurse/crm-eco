'use client';

import { useState, useCallback, useEffect, useRef, memo, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  User,
  Mail,
  Phone,
  Inbox,
  Plus,
  Calendar,
  ExternalLink,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import type { CrmRecord, CrmField } from '@/lib/crm/types';

interface SplitViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  displayColumns?: string[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (recordId: string) => void;
  onBulkDelete?: (ids: string[]) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Active': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  'In-Active': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
  'Inactive': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
  'Prospect': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  'New': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  'Contacted': { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30' },
  'Qualified': { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/30' },
  'Working': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  'Converted': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  'Lost': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
  'Closed Won': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  'Closed Lost': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30' },
};

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

// Compact table row for left panel
const CompactRow = memo(function CompactRow({
  record,
  isActive,
  isSelected,
  onSelect,
  onClick,
  onOpenFullRecord,
}: {
  record: CrmRecord;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  /** Navigate to `/crm/r/:id` (e.g. double-click). */
  onOpenFullRecord?: () => void;
}) {
  const displayName = getDisplayName(record);
  const { status, style: statusStyle } = getStatusInfo(record);
  const email = (record.email || record.data?.email) as string | undefined;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-white/5',
        isActive
          ? 'bg-teal-50 dark:bg-teal-500/10 border-l-2 border-l-teal-500'
          : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border-l-2 border-l-transparent',
        isSelected && !isActive && 'bg-teal-50/50 dark:bg-teal-500/5'
      )}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        onOpenFullRecord?.();
      }}
      title="Click to preview · Double-click to open full record"
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="border-slate-400 dark:border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isActive ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'
        )}>
          {displayName}
        </p>
        {email && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
        )}
      </div>

      {status && (
        <span className={cn(
          'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0',
          statusStyle.bg, statusStyle.text, statusStyle.border
        )}>
          {status}
        </span>
      )}
    </div>
  );
});

// Detail panel (right side)
const DetailPanel = memo(function DetailPanel({
  record,
  fields,
  moduleKey,
  onClose,
}: {
  record: CrmRecord;
  fields: CrmField[];
  moduleKey: string;
  onClose: () => void;
}) {
  const displayName = getDisplayName(record);
  const { status, style: statusStyle } = getStatusInfo(record);
  const email = (record.email || record.data?.email) as string | undefined;
  const phone = (record.phone || record.data?.phone) as string | undefined;
  const amount = Number(record.data?.amount) || 0;

  // Build field data for display
  const fieldEntries = useMemo(() => {
    const entries: { key: string; label: string; value: string; type: string }[] = [];

    fields.forEach(field => {
      if (['id', 'org_id', 'module_id', 'system', 'data'].includes(field.key)) return;
      const rawVal = record.data?.[field.key];
      if (rawVal === null || rawVal === undefined || rawVal === '') return;
      entries.push({
        key: field.key,
        label: field.label,
        value: String(rawVal),
        type: field.type,
      });
    });

    return entries;
  }, [fields, record]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-white/10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {displayName}
            </h2>
            {status && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0',
                statusStyle.bg, statusStyle.text, statusStyle.border
              )}>
                {status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
            Created {new Date(record.created_at).toLocaleDateString()} &middot; Updated {new Date(record.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href={`/crm/r/${record.id}`}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Full View
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
        {/* Contact Info */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Contact Info
          </h3>
          <div className="space-y-2">
            {email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a href={`mailto:${email}`} className="text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 truncate">
                  {email}
                </a>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a href={`tel:${phone}`} className="text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400">
                  {phone}
                </a>
              </div>
            )}
            {record.owner_id && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">Assigned Owner</span>
              </div>
            )}
          </div>
        </div>

        {/* Amount (for deals) */}
        {amount > 0 && (
          <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Deal Value</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">${amount.toLocaleString()}</p>
          </div>
        )}

        {/* Field Details */}
        {fieldEntries.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Details
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {fieldEntries.map(entry => (
                <div key={entry.key} className="flex items-start gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-28 flex-shrink-0 pt-0.5">
                    {entry.label}
                  </span>
                  <span className="text-sm text-slate-900 dark:text-white break-words flex-1">
                    {entry.type === 'date' || entry.type === 'datetime' ? (
                      <span suppressHydrationWarning>{new Date(entry.value).toLocaleDateString()}</span>
                    ) : entry.type === 'currency' ? (
                      `$${Number(entry.value).toLocaleString()}`
                    ) : entry.type === 'boolean' ? (
                      entry.value === 'true' ? 'Yes' : 'No'
                    ) : (
                      entry.value
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            {phone && (
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a href={`tel:${phone}`}>
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  Call
                </a>
              </Button>
            )}
            {email && (
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a href={`mailto:${email}`}>
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  Email
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link href={`/crm/r/${record.id}?edit=true`}>
                Edit Record
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export const SplitView = memo(function SplitView({
  records,
  fields,
  moduleKey,
  displayColumns,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onBulkDelete,
}: SplitViewProps) {
  const router = useRouter();
  const [activeRecordId, setActiveRecordId] = useState<string | null>(
    records.length > 0 ? records[0].id : null
  );
  const [dividerPosition, setDividerPosition] = useState(40); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const activeRecord = useMemo(
    () => records.find(r => r.id === activeRecordId) || null,
    [records, activeRecordId]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeRecordId) return;
      const currentIndex = records.findIndex(r => r.id === activeRecordId);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, records.length - 1);
        setActiveRecordId(records[nextIndex].id);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setActiveRecordId(records[prevIndex].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        router.push(`/crm/r/${activeRecordId}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRecordId, records, router]);

  // Divider drag handling
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setDividerPosition(Math.max(25, Math.min(65, percent)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSelectRow = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  // Auto-scroll active record into view
  useEffect(() => {
    if (!activeRecordId || !leftPanelRef.current) return;
    const activeElement = leftPanelRef.current.querySelector(`[data-record-id="${activeRecordId}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeRecordId]);

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
          <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No records found</p>
        <p className="text-sm text-slate-500 mb-4">Create records to use the split view.</p>
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
    <div
      ref={containerRef}
      className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex"
      style={{ height: 'calc(100vh - var(--crm-view-offset) - 60px)', minHeight: '500px' }}
    >
      {/* Left Panel - Compact List */}
      <div
        className="flex flex-col border-r border-slate-200 dark:border-white/10 overflow-hidden"
        style={{ width: `${dividerPosition}%` }}
      >
        {/* Left Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {records.length} Records
          </span>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <ChevronUp className="w-3 h-3" />
            <ChevronDown className="w-3 h-3" />
            <span>Navigate</span>
          </div>
        </div>

        {/* Scrollable List */}
        <div ref={leftPanelRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {records.map(record => (
            <div key={record.id} data-record-id={record.id}>
              <CompactRow
                record={record}
                isActive={record.id === activeRecordId}
                isSelected={selectedIds.has(record.id)}
                onSelect={() => handleSelectRow(record.id)}
                onClick={() => setActiveRecordId(record.id)}
                onOpenFullRecord={() => onRowClick?.(record.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Resizable Divider */}
      <div
        className={cn(
          'w-1 cursor-col-resize flex-shrink-0 relative group',
          'bg-slate-200 dark:bg-white/10',
          'hover:bg-teal-500/50 dark:hover:bg-teal-500/30',
          isDragging && 'bg-teal-500 dark:bg-teal-500/50'
        )}
        onMouseDown={handleDividerMouseDown}
      >
        <div className={cn(
          'absolute inset-y-0 -left-1 -right-1',
          isDragging && 'cursor-col-resize'
        )} />
      </div>

      {/* Right Panel - Detail */}
      <div
        className="flex flex-col overflow-hidden bg-white dark:bg-slate-900/30"
        style={{ width: `${100 - dividerPosition}%` }}
      >
        {activeRecord ? (
          <DetailPanel
            record={activeRecord}
            fields={fields}
            moduleKey={moduleKey}
            onClose={() => setActiveRecordId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-3">
                <Inbox className="w-8 h-8 text-slate-400 dark:text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Select a record</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Click a record on the left to preview it here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
