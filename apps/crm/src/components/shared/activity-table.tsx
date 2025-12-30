'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
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

export function ActivityTable({ 
  activities, 
  showEntity = false,
  emptyMessage = 'No activity recorded'
}: ActivityTableProps) {
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
        {activities.map((activity) => (
          <TableRow key={activity.id}>
            <TableCell>
              <Badge 
                variant="secondary" 
                className={typeColors[activity.type || ''] || 'bg-slate-100 text-slate-700'}
              >
                {getTypeLabel(activity.type || '')}
              </Badge>
            </TableCell>
            <TableCell className="font-medium max-w-[300px]">
              <div className="truncate">{activity.subject || '—'}</div>
              {activity.description && (
                <div className="text-xs text-slate-400 truncate">{activity.description}</div>
              )}
            </TableCell>
            {showEntity && (
              <TableCell>
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
            <TableCell className="text-slate-600">
              {activity.profiles?.full_name ?? 'System'}
            </TableCell>
            <TableCell className="text-slate-400 text-sm whitespace-nowrap">
              {formatDistanceToNow(new Date(activity.occurred_at || activity.created_at), { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}


