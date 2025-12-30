import { Card, CardContent } from '@crm-eco/ui';
import { AlertCircle } from 'lucide-react';
import { WelcomeCard } from './WelcomeCard';
import { MembershipCard } from './MembershipCard';
import { EnrollmentPanel } from './EnrollmentPanel';
import { NeedsOverviewCard } from './NeedsOverviewCard';
import { TicketsOverviewCard } from './TicketsOverviewCard';

// Types matching the data from page.tsx
interface MemberData {
  id: string;
  first_name: string;
  organization_id: string;
}

interface MembershipWithPlan {
  id: string;
  membership_number: string | null;
  status: 'pending' | 'active' | 'terminated' | 'paused';
  effective_date: string;
  billing_amount: number | null;
  plans: { 
    name: string; 
    code: string; 
    monthly_share: number;
  } | null;
}

interface LatestEnrollment {
  id: string;
  enrollment_number: string | null;
  status: string;
  enrollment_mode: string;
  updated_at: string;
  created_at: string;
  plans: { id: string; name: string; code: string } | null;
}

interface NeedSummary {
  id: string;
  need_type: string;
  description: string;
  total_amount: number;
  eligible_amount: number;
  reimbursed_amount: number;
  status: 'open' | 'in_review' | 'processing' | 'paid' | 'closed';
  incident_date: string | null;
  created_at: string;
}

interface TicketSummary {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  created_at: string;
}

interface MemberDashboardShellProps {
  member: MemberData;
  membership: MembershipWithPlan | null;
  enrollment: LatestEnrollment | null;
  needs: NeedSummary[];
  tickets: TicketSummary[];
}

export function MemberDashboardShell({
  member,
  membership,
  enrollment,
  needs,
  tickets,
}: MemberDashboardShellProps) {
  const hasActiveMembership = membership?.status === 'active' || membership?.status === 'pending';
  const hasInProgressEnrollment = enrollment?.status === 'draft' || enrollment?.status === 'in_progress';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Card - Full Width */}
      <WelcomeCard
        firstName={member.first_name}
        hasActiveMembership={hasActiveMembership}
        hasInProgressEnrollment={hasInProgressEnrollment}
        inProgressEnrollmentId={hasInProgressEnrollment ? enrollment?.id : undefined}
      />

      {/* Main Grid - 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <MembershipCard membership={membership} />
          <NeedsOverviewCard needs={needs} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <EnrollmentPanel enrollment={enrollment} />
          <TicketsOverviewCard tickets={tickets} />
        </div>
      </div>

      {/* Important Notice - Full Width */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 mb-1">Important Reminder</h4>
              <p className="text-sm text-amber-700">
                WealthShare is a healthshare ministry, not insurance. Members share each other&apos;s 
                medical expenses according to program guidelines. Sharing is voluntary and not guaranteed. 
                Please review your membership guidelines for complete details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

