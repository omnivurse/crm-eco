import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, getNeedForMember, getNeedEvents } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { ChevronLeft } from 'lucide-react';
import {
  NeedStatusCard,
  NeedAmountsCard,
  NeedTimelineCard,
} from '../../../components/needs';

export default async function NeedDetailPage({ params }: { params: { id: string } }) {
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
  const needId = params.id;

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

  // Fetch related events
  const events = await getNeedEvents(supabase, needId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <Link href="/needs" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Needs
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {need.need_type}
        </h1>
        <p className="text-slate-600 mt-1">
          Need ID: {need.id.substring(0, 8)}
        </p>
      </div>

      {/* Status Card */}
      <NeedStatusCard need={need} />

      {/* Amounts & Reimbursement Card */}
      <NeedAmountsCard need={need} />

      {/* Activity Timeline Card */}
      <NeedTimelineCard events={events} />
    </div>
  );
}

