import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CaretLeft, Lock } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui';
import {
  getTicketCategoryLabel,
  getTicketPriorityLabel,
  getTicketStatusLabel,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@crm-eco/lib';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { AdminTicketReplyForm } from './AdminTicketReplyForm';
import { AdminTicketStatusForm } from './AdminTicketStatusForm';

export const dynamic = 'force-dynamic';

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const { data: ticket } = await supabase
    .from('tickets')
    .select(
      `
      id,
      subject,
      description,
      status,
      priority,
      category,
      created_at,
      member_id,
      member:members!tickets_member_id_fkey(id, first_name, last_name, email)
    `,
    )
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .maybeSingle();

  if (!ticket) notFound();

  const { data: comments } = await supabase
    .from('ticket_comments')
    .select(
      `
      id,
      body,
      is_internal,
      created_at,
      author:profiles!ticket_comments_created_by_profile_id_fkey(full_name)
    `,
    )
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  const member = ticket.member as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  const memberName = member
    ? [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Member'
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        href="/support"
        className="inline-flex items-center text-sm text-[var(--adm-cyan)] hover:underline"
      >
        <CaretLeft weight="light" className="mr-1 h-4 w-4" />
        Back to support queue
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{ticket.subject}</h1>
          <Badge variant="secondary">
            {getTicketCategoryLabel(ticket.category as TicketCategory)}
          </Badge>
          <Badge>{getTicketStatusLabel(ticket.status as TicketStatus)}</Badge>
          <Badge variant="outline">
            {getTicketPriorityLabel(ticket.priority as TicketPriority)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
          <span>
            Opened{' '}
            {ticket.created_at
              ? format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')
              : '—'}
          </span>
          {member && ticket.member_id && (
            <span>
              Member:{' '}
              <Link
                href={`/members/${ticket.member_id}?tab=support`}
                className="text-[var(--adm-cyan)] hover:underline"
              >
                {memberName}
              </Link>
              {member.email ? ` · ${member.email}` : ''}
            </span>
          )}
        </div>
        <AdminTicketStatusForm ticketId={ticket.id} status={ticket.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {ticket.description || '—'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!comments?.length ? (
            <p className="text-sm text-slate-500">No comments yet.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((comment) => {
                const author = comment.author as { full_name: string | null } | null;
                return (
                  <li
                    key={comment.id}
                    className={`rounded-lg border p-4 ${
                      comment.is_internal
                        ? 'border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {author?.full_name ?? 'Unknown'}
                      </span>
                      <span>
                        {comment.created_at
                          ? format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')
                          : '—'}
                      </span>
                      {comment.is_internal && (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                          <Lock weight="light" className="h-3 w-3" />
                          Internal
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                      {comment.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <AdminTicketReplyForm ticketId={ticket.id} />
        </CardContent>
      </Card>
    </div>
  );
}
