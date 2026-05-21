import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { 
  getMemberForUser, 
  getMemberMemberships, 
  getMemberNeeds,
  getMemberTickets,
  getLatestSelfServeEnrollment,
} from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { Heart, ArrowRight } from 'lucide-react';
import { MemberDashboardShell } from '@/components/dashboard';

export default async function MemberDashboard() {
  const supabase = await createServerSupabaseClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Resolve member from profile
  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    // User is authenticated but has no member record
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
          <Heart className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Welcome to Double Helix Hub</h1>
        <p className="text-slate-600 mb-8">
          It looks like you don&apos;t have a member account yet. 
          Start your enrollment to become a member and access your benefits.
        </p>
        <Link href="/enroll">
          <Button size="lg" className="gap-2">
            Start Your Enrollment
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

  const { member } = context;

  if (!member.organization_id) {
    redirect('/');
  }

  // Fetch all dashboard data in parallel
  const [memberships, latestEnrollment, needs, tickets, billingSchedule, openFailures, advisorEnrollment] = await Promise.all([
    getMemberMemberships(supabase, member.id, member.organization_id),
    getLatestSelfServeEnrollment(supabase, member.id, member.organization_id),
    getMemberNeeds(supabase, member.id, member.organization_id, 5),
    getMemberTickets(supabase, member.id, member.organization_id, 5),
    supabase
      .from('billing_schedules')
      .select('amount, next_billing_date, frequency')
      .eq('member_id', member.id)
      .eq('status', 'active')
      .order('next_billing_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('billing_failures')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member.id)
      .eq('resolved', false),
    supabase
      .from('enrollments')
      .select('advisor_id')
      .eq('primary_member_id', member.id)
      .not('advisor_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Find active or pending membership
  const activeMembership = memberships.find(
    (m: { status: string }) => m.status === 'active' || m.status === 'pending'
  ) || null;

  // Resolve advisor (single round-trip when available)
  let advisor = null;
  if (advisorEnrollment?.data?.advisor_id) {
    const { data } = await supabase
      .from('advisors')
      .select('first_name, last_name, email, phone')
      .eq('id', advisorEnrollment.data.advisor_id)
      .maybeSingle();
    advisor = data ?? null;
  }

  return (
    <MemberDashboardShell
      member={{
        id: member.id,
        first_name: member.first_name,
        organization_id: member.organization_id,
      }}
      membership={activeMembership}
      enrollment={latestEnrollment}
      needs={needs}
      tickets={tickets}
      billingSchedule={billingSchedule.data}
      openFailureCount={openFailures.count ?? 0}
      advisor={advisor}
    />
  );
}
