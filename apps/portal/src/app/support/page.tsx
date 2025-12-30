import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, getMemberTickets } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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

  // Fetch recent tickets
  const tickets = await getMemberTickets(supabase, member.id, member.organization_id, 20);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support Center</h1>
        <p className="text-slate-600 mt-1">
          Get help with your membership, billing, or any other questions.
        </p>
      </div>

      {/* Support Form */}
      <SupportTicketForm />

      {/* Tickets List */}
      <SupportTicketsList tickets={tickets as any} />
    </div>
  );
}

