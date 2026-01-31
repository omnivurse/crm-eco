'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge
} from '@crm-eco/ui';
import { Activity } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string | null;
  subject: string | null;
  description: string | null;
  occurred_at: string;
  created_at: string;
  member_id?: string | null;
  advisor_id?: string | null;
  lead_id?: string | null;
  ticket_id?: string | null;
  need_id?: string | null;
  profiles?: { full_name: string } | null;
}

interface ActivityTableProps {
  activities: ActivityItem[];
  showEntity?: boolean;
  emptyMessage?: string;
}

const typeColors: Record<string, string> = {
  member_created: 'bg-green-100 text-green-700',
  member_updated: 'bg-blue-100 text-blue-700',
  advisor_created: 'bg-emerald-100 text-emerald-700',
  advisor_updated: 'bg-blue-100 text-blue-700',
  lead_created: 'bg-cyan-100 text-cyan-700',
  lead_updated: 'bg-blue-100 text-blue-700',
  ticket_created: 'bg-amber-100 text-amber-700',
  ticket_updated: 'bg-blue-100 text-blue-700',
  ticket_comment_added: 'bg-purple-100 text-purple-700',
  need_created: 'bg-rose-100 text-rose-700',
  need_updated: 'bg-blue-100 text-blue-700',
  need_status_changed: 'bg-indigo-100 text-indigo-700',
  note_added: 'bg-yellow-100 text-yellow-700',
  call_logged: 'bg-purple-100 text-purple-700',
  email_sent: 'bg-indigo-100 text-indigo-700',
};

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    member_created: 'New Member',
    member_updated: 'Updated',
    advisor_created: 'New Advisor',
    advisor_updated: 'Updated',
    lead_created: 'New Lead',
    lead_updated: 'Updated',
    ticket_created: 'Ticket Created',
    ticket_updated: 'Updated',
    ticket_comment_added: 'Comment Added',
    need_created: 'Need Created',
    need_updated: 'Updated',
    need_status_changed: 'Status Change',
    note_added: 'Note',
    call_logged: 'Call',
    email_sent: 'Email',
  };
  return labels[type] || type.replace(/_/g, ' ');
}

// Row height for virtualization
const ROW_HEIGHT = 56;

// Threshold for enabling virtualization (only virtualize for large lists)
const VIRTUALIZATION_THRESHOLD = 50;

export function ActivityTable({
  activities,
  showEntity = false,
  emptyMessage = 'No activity recorded'
}: ActivityTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Use virtualization for large lists
  const shouldVirtualize = activities.length > VIRTUALIZATION_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Activity className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="font-medium">{emptyMessage}</p>
        <p className="text-sm text-slate-400 mt-1">
          Activity will appear here as actions are taken
        </p>
      </div>
    );
  }

  // Render a single row (used by both virtualized and non-virtualized modes)
  const renderRow = (activity: ActivityItem, style?: React.CSSProperties) => (
    <TableRow
      key={activity.id}
      style={style}
      className={style ? 'absolute left-0 w-full flex items-center' : ''}
    >
      <TableCell className={style ? 'flex-shrink-0 w-32' : ''}>
        <Badge
          variant="secondary"
          className={typeColors[activity.type || ''] || 'bg-slate-100 text-slate-700'}
        >
          {getTypeLabel(activity.type || '')}
        </Badge>
      </TableCell>
      <TableCell className={`font-medium ${style ? 'flex-1 min-w-0' : 'max-w-[300px]'}`}>
        <div className="truncate">{activity.subject || '—'}</div>
        {activity.description && (
          <div className="text-xs text-slate-400 truncate">{activity.description}</div>
        )}
      </TableCell>
      {showEntity && (
        <TableCell className={style ? 'flex-shrink-0 w-24' : ''}>
          {activity.ticket_id && (
            <Link href={`/tickets/${activity.ticket_id}`} className="text-blue-600 hover:underline">
              Ticket
            </Link>
          )}
          {activity.need_id && (
            <Link href={`/needs/${activity.need_id}`} className="text-blue-600 hover:underline">
              Need
            </Link>
          )}
          {!activity.ticket_id && !activity.need_id && (
            <span className="text-slate-400">—</span>
          )}
        </TableCell>
      )}
      <TableCell className={`text-slate-600 ${style ? 'flex-shrink-0 w-28' : ''}`}>
        {activity.profiles?.full_name ?? 'System'}
      </TableCell>
      <TableCell className={`text-slate-400 text-sm whitespace-nowrap ${style ? 'flex-shrink-0 w-32' : ''}`}>
        {formatDistanceToNow(new Date(activity.occurred_at || activity.created_at), { addSuffix: true })}
      </TableCell>
    </TableRow>
  );

  // Non-virtualized rendering for small lists
  if (!shouldVirtualize) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Subject</TableHead>
            {showEntity && <TableHead>Entity</TableHead>}
            <TableHead>By</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => renderRow(activity))}
        </TableBody>
      </Table>
    );
  }

  // Virtualized rendering for large lists
  return (
    <div
      ref={tableContainerRef}
      className="overflow-auto max-h-[600px] border rounded-lg"
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-900">
          <TableRow>
            <TableHead className="w-32">Type</TableHead>
            <TableHead>Subject</TableHead>
            {showEntity && <TableHead className="w-24">Entity</TableHead>}
            <TableHead className="w-28">By</TableHead>
            <TableHead className="w-32">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
            display: 'block',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const activity = activities[virtualRow.index];
            return renderRow(activity, {
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
              height: `${virtualRow.size}px`,
            });
          })}
        </TableBody>
      </Table>
    </div>
  );
}


