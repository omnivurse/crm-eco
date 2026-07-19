import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, getMemberTickets } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { SupportTicketForm, SupportTicketsList } from '@/components/support';

export default async function SupportPage() {
  const supabase = await createServerSupabaseClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Resolve member from profile
  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    redirect('/');
  }

  const { member } = context;

  if (!member.organization_id) {
    redirect('/');
  }

  // Fetch recent tickets
  const tickets = await getMemberTickets(supabase, member.id, member.organization_id, 20);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Support Center"
        description="Get help with your membership, billing, or any other questions."
        backHref="/"
        backLabel="Back to Dashboard"
      />

      <SupportTicketForm />

      <SupportTicketsList tickets={tickets as any} />
    </div>
  );
}
