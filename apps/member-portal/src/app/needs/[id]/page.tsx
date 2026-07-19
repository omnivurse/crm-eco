import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  getMemberForUser,
  getNeedForMember,
  getNeedEvents,
  parseNeedInvoice,
} from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { PageHeader } from '@/components/PageHeader';
import {
  NeedStatusCard,
  NeedAmountsCard,
  NeedTimelineCard,
  NeedAttachmentsCard,
  NeedAddDocumentsPanel,
  NeedInvoiceCard,
} from '../../../components/needs';

const INVOICE_LOCKED_STATUSES = new Set(['closed', 'paid', 'denied', 'cancelled']);
import { listNeedAttachmentsForMember } from '@/lib/data/need-attachments';

export default async function NeedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h1>
        <p className="text-slate-600 mb-8">
          You must be a registered member to view need details.
        </p>
        <Link href="/login">
          <Button>Login</Button>
        </Link>
      </div>
    );
  }

  const { member } = context;
  const needId = id;

  if (!member.organization_id) {
    redirect('/');
  }

  // Fetch the need with ownership check
  const need = await getNeedForMember(supabase, needId, member.id, member.organization_id);

  if (!need) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Need Not Found</h1>
        <p className="text-slate-600 mb-8">
          This Need could not be found or isn&apos;t available under your account.
        </p>
        <Link href="/needs">
          <Button>Back to Needs</Button>
        </Link>
      </div>
    );
  }

  // Fetch related events and attachments
  const [events, attachments] = await Promise.all([
    getNeedEvents(supabase, needId),
    listNeedAttachmentsForMember(needId),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <PageHeader
        title={need.need_type}
        description={`Need ID: ${need.id.substring(0, 8)}`}
        backHref="/needs"
        backLabel="Back to Needs"
      />

      <NeedStatusCard need={need} />

      <NeedAmountsCard need={need} />

      <NeedAttachmentsCard
        needId={needId}
        attachments={attachments}
        canRemove={!INVOICE_LOCKED_STATUSES.has(need.status)}
      />

      <NeedAddDocumentsPanel needId={needId} status={need.status} />

      {/* Itemized invoice — the member breaks a receipt/bill into line items */}
      <NeedInvoiceCard
        needId={needId}
        invoice={parseNeedInvoice(need.custom_fields)}
        canEdit={!INVOICE_LOCKED_STATUSES.has(need.status)}
      />

      <NeedTimelineCard events={events} />
    </div>
  );
}
