import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { ChevronLeft } from 'lucide-react';
import { SubmitNeedWizard } from '../../../components/needs';

export default async function SubmitNeedPage() {
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
          You must be a registered member to submit a need.
        </p>
        <Link href="/enroll">
          <Button>Enroll Now</Button>
        </Link>
      </div>
    );
  }

  const { member } = context;

  // Pre-fill Member Information from the member record (editable in the form).
  const m = member as {
    first_name?: string | null;
    last_name?: string | null;
    member_number?: string | null;
    date_of_birth?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  const memberPrefill = {
    firstName: m.first_name ?? '',
    lastName: m.last_name ?? '',
    memberIdCard: m.member_number ?? '',
    dateOfBirth: m.date_of_birth ?? '',
    email: m.email ?? '',
    phone: m.phone ?? '',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/needs" className="inline-flex items-center text-sm text-blue-600 hover:underline mb-6">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Needs
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Sharing Request</h1>
        <p className="text-slate-600 mt-2">
          Complete the form below to submit your request for sharing.
        </p>
      </div>

      {/* Wizard */}
      <SubmitNeedWizard memberPrefill={memberPrefill} />
    </div>
  );
}

