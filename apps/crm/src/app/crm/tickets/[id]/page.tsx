import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { getTicketCategoryLabel, getTicketPriorityLabel, getTicketStatusLabel } from '@crm-eco/lib';
import { getStaffTicketDetail } from '@/lib/crm/tickets-queries';
import { TicketStatusBadge } from '@/components/shared/status-badge';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { CategoryBadge } from '@/components/shared/category-badge';
import { AddCommentForm } from '@/components/tickets/add-comment-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmTicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getStaffTicketDetail(id);

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Ticket not found</h1>
        <p className="mb-8 text-slate-600">
          This ticket doesn&apos;t exist or isn&apos;t in your organization.
        </p>
        <Link href="/crm/tickets" className="text-blue-600 hover:underline">
          Back to tickets
        </Link>
      </div>
    );
  }

  const { ticket, comments } = result;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        href="/crm/tickets"
        className="inline-flex items-center text-sm text-blue-600 hover:underline"
      >
        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
        Back to tickets
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{ticket.subject}</h1>
          <CategoryBadge category={ticket.category} />
          <TicketStatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
          <span>Opened {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}</span>
          {ticket.member && (
            <span>
              Member:{' '}
              <Link
                href={`/crm/members/${ticket.member.id}`}
                className="text-blue-600 hover:underline"
              >
                {ticket.member.first_name} {ticket.member.last_name}
              </Link>
            </span>
          )}
          <span>
            Assigned: {ticket.assigned_to?.full_name ?? 'Unassigned'}
          </span>
          <span>Created by: {ticket.created_by?.full_name ?? 'Unknown'}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {ticket.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-slate-500">No comments yet.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className={`rounded-lg border p-4 ${
                    comment.is_internal
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{comment.author_name}</span>
                    <span>{format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}</span>
                    {comment.is_internal && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                        <Lock className="h-3 w-3" />
                        Internal
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{comment.body}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t pt-4">
            <AddCommentForm ticketId={ticket.id} />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Status: {getTicketStatusLabel(ticket.status as never)} · Priority:{' '}
        {getTicketPriorityLabel(ticket.priority as never)} · Category:{' '}
        {getTicketCategoryLabel(ticket.category as never)}
      </p>
    </div>
  );
}
