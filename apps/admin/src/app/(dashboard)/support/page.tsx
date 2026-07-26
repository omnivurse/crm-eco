import Link from 'next/link';
import { ChatCircle, ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
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
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';
import { SupportQueueFilters } from './SupportQueueFilters';

export const dynamic = 'force-dynamic';

type QueueTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  member_id: string | null;
  member: { id: string; first_name: string | null; last_name: string | null } | null;
};

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'open' || status === 'in_progress') return 'default';
  if (status === 'waiting') return 'secondary';
  if (status === 'resolved' || status === 'closed') return 'outline';
  return 'outline';
}

function priorityVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (priority === 'urgent' || priority === 'high') return 'destructive';
  if (priority === 'normal') return 'secondary';
  return 'outline';
}

async function getSupportQueue(filters: {
  status?: string;
  priority?: string;
  q?: string;
}): Promise<QueueTicket[]> {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return [];

  let query = supabase
    .from('tickets')
    .select(
      `
      id,
      subject,
      status,
      priority,
      category,
      created_at,
      member_id,
      member:members!tickets_member_id_fkey(id, first_name, last_name)
    `,
    )
    .eq('organization_id', tenant.organizationId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters.status === 'open') {
    query = query.in('status', ['open', 'in_progress', 'waiting']);
  } else if (filters.status === 'pending') {
    query = query.eq('status', 'waiting');
  } else if (filters.status === 'resolved') {
    query = query.in('status', ['resolved', 'closed']);
  } else if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[support queue]', error);
    return [];
  }

  let rows = (data ?? []) as unknown as QueueTicket[];

  if (filters.q?.trim()) {
    const needle = filters.q.trim().toLowerCase();
    rows = rows.filter((t) => {
      const memberName = [t.member?.first_name, t.member?.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return t.subject.toLowerCase().includes(needle) || memberName.includes(needle);
    });
  }

  return rows;
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? 'open';
  const priority = params.priority ?? 'all';
  const q = params.q ?? '';
  const tickets = await getSupportQueue({ status, priority, q });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Support"
        description="Member portal tickets for this organization — same queue CRM uses"
        icon={<ChatCircle weight="light" className="h-6 w-6" />}
      />

      <SupportQueueFilters status={status} priority={priority} q={q} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ticket queue</CardTitle>
          <CardDescription>
            {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
            {status !== 'all' ? ` · filter: ${status}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No tickets match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => {
                    const memberName = ticket.member
                      ? [ticket.member.first_name, ticket.member.last_name]
                          .filter(Boolean)
                          .join(' ') || 'Member'
                      : '—';
                    return (
                      <tr
                        key={ticket.id}
                        className="border-b border-slate-100 last:border-0 dark:border-white/5"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          {ticket.member_id ? (
                            <Link
                              href={`/members/${ticket.member_id}?tab=support`}
                              className="font-medium text-[var(--adm-cyan)] hover:underline"
                            >
                              {memberName}
                            </Link>
                          ) : (
                            <span className="text-slate-500">{memberName}</span>
                          )}
                        </td>
                        <td className="max-w-[240px] truncate px-4 py-3 font-medium text-slate-900 dark:text-white">
                          <Link href={`/support/${ticket.id}`} className="hover:underline">
                            {ticket.subject}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {getTicketCategoryLabel(ticket.category as TicketCategory)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(ticket.status)}>
                            {getTicketStatusLabel(ticket.status as TicketStatus)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={priorityVariant(ticket.priority)}>
                            {getTicketPriorityLabel(ticket.priority as TicketPriority)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            {ticket.member_id && (
                              <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                                <Link href={`/members/${ticket.member_id}?tab=support`}>
                                  Member
                                </Link>
                              </Button>
                            )}
                            <Button asChild variant="outline" size="sm" className="h-8 px-2">
                              <Link href={`/support/${ticket.id}`}>
                                Open
                                <ArrowSquareOut weight="light" className="ml-1 h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
