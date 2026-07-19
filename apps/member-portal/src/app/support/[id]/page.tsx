import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button, Badge } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { getMemberTicketById, listMemberTicketComments } from '@/lib/data/support-tickets';
import {
  SupportTicketThread,
  SupportTicketReplyForm,
} from '@/components/support/SupportTicketThread';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

const categoryLabels: Record<string, string> = {
  service: 'General',
  enrollment: 'Enrollment',
  billing: 'Billing',
  need: 'Needs',
  other: 'Technical',
};

const CLOSED_STATUSES = new Set(['resolved', 'closed']);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SupportTicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const context = await getMemberForUser(supabase, user.id);
  if (!context) redirect('/');

  const [ticket, comments] = await Promise.all([
    getMemberTicketById(id),
    listMemberTicketComments(id),
  ]);

  if (!ticket) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Ticket not found</h1>
        <p className="mb-8 text-slate-600">
          This support ticket doesn&apos;t exist or isn&apos;t linked to your account.
        </p>
        <Button asChild>
          <Link href="/support">Back to Support</Link>
        </Button>
      </div>
    );
  }

  const isClosed = CLOSED_STATUSES.has(ticket.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader
        title={ticket.subject}
        description={`Opened ${new Date(ticket.created_at).toLocaleDateString()}`}
        backHref="/support"
        backLabel="Back to Support"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {categoryLabels[ticket.category] ?? ticket.category}
            </Badge>
            <StatusBadge status={ticket.status} showIcon={false} />
          </div>
        }
      />

      <SupportTicketThread
        comments={comments}
        ticketDescription={ticket.description}
        ticketCreatedAt={ticket.created_at}
      />

      <SupportTicketReplyForm ticketId={ticket.id} disabled={isClosed} />
    </div>
  );
}
