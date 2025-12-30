import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, getMemberNeeds } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { ChevronLeft } from 'lucide-react';
import {
  NeedsSummaryStrip,
  NeedsListCard,
} from '../../components/needs';

// Type for needs from the database
interface NeedRow {
  id: string;
  need_type: string;
  description: string;
  total_amount: number;
  eligible_amount: number;
  reimbursed_amount: number;
  status: 'open' | 'in_review' | 'processing' | 'paid' | 'closed';
  urgency_light: 'green' | 'orange' | 'red' | null;
  incident_date: string | null;
  created_at: string;
  updated_at: string;
}

// Compute summary counts from needs
function computeSummaryCounts(needs: NeedRow[]) {
  let openCount = 0;
  let approvedCount = 0;
  let paidCount = 0;

  for (const need of needs) {
    switch (need.status) {
      case 'open':
      case 'in_review':
      case 'processing':
        openCount++;
        break;
      case 'paid':
        paidCount++;
        break;
      case 'closed':
        // Could have approved amount even if closed
        if (need.eligible_amount > 0 || need.reimbursed_amount > 0) {
          approvedCount++;
        }
        break;
    }
  }

  // Count needs with eligible_amount > 0 as approved (excluding already-paid)
  for (const need of needs) {
    if (
      need.status !== 'paid' &&
      need.status !== 'closed' &&
      need.eligible_amount > 0
    ) {
      approvedCount++;
    }
  }

  return { openCount, approvedCount, paidCount };
}

export default async function NeedsPage() {
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
          You must be a registered member to view your needs.
        </p>
        <Link href="/login">
          <Button>Login</Button>
        </Link>
      </div>
    );
  }

  const { member } = context;

  // Fetch needs with a higher limit for the full list view
  const needs = await getMemberNeeds(supabase, member.id, member.organization_id, 50) as NeedRow[];

  // Compute summary counts
  const { openCount, approvedCount, paidCount } = computeSummaryCounts(needs);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Needs & Sharing</h1>
        <p className="text-slate-600 mt-1">
          View the status of your submitted Needs and sharing activity.
        </p>
      </div>

      {/* Summary Strip */}
      <NeedsSummaryStrip
        openCount={openCount}
        approvedCount={approvedCount}
        paidCount={paidCount}
      />

      {/* Needs List */}
      <NeedsListCard needs={needs} />
    </div>
  );
}

