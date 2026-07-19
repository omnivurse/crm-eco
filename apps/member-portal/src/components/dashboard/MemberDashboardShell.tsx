import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { WelcomeCard } from './WelcomeCard';
import { MembershipCard } from './MembershipCard';
import { EnrollmentPanel } from './EnrollmentPanel';
import { NeedsOverviewCard } from './NeedsOverviewCard';
import { TicketsOverviewCard } from './TicketsOverviewCard';
import { NextBillingCard } from './NextBillingCard';
import { FailureBanner } from './FailureBanner';
import { AdvisorCard } from './AdvisorCard';
import { Bezel } from '@/components/ui/Bezel';

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

interface BillingScheduleSummary {
  amount: number | null;
  next_billing_date: string | null;
  frequency?: string | null;
}

interface AdvisorSummary {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url?: string | null;
}

interface MemberDashboardShellProps {
  member: MemberData;
  membership: MembershipWithPlan | null;
  enrollment: LatestEnrollment | null;
  needs: NeedSummary[];
  tickets: TicketSummary[];
  billingSchedule?: BillingScheduleSummary | null;
  openFailureCount?: number;
  advisor?: AdvisorSummary | null;
}

export function MemberDashboardShell({
  member,
  membership,
  enrollment,
  needs,
  tickets,
  billingSchedule = null,
  openFailureCount = 0,
  advisor = null,
}: MemberDashboardShellProps) {
  const hasActiveMembership =
    membership?.status === 'active' || membership?.status === 'pending';
  const hasInProgressEnrollment =
    enrollment?.status === 'draft' || enrollment?.status === 'in_progress';
  const showEnrollment =
    !hasActiveMembership ||
    hasInProgressEnrollment ||
    enrollment?.status === 'submitted';

  return (
    <div className="mp-bento">
      <div className="mp-reveal mp-span-8 mp-row-2">
        <WelcomeCard
          firstName={member.first_name}
          hasActiveMembership={hasActiveMembership}
          hasInProgressEnrollment={hasInProgressEnrollment}
          inProgressEnrollmentId={hasInProgressEnrollment ? enrollment?.id : undefined}
        />
      </div>

      <div className="mp-reveal mp-span-4">
        <MembershipCard membership={membership} />
      </div>

      <div className="mp-reveal mp-span-4">
        <NextBillingCard schedule={billingSchedule} />
      </div>

      {openFailureCount > 0 && (
        <div className="mp-reveal mp-span-12">
          <FailureBanner count={openFailureCount} />
        </div>
      )}

      <div className="mp-reveal mp-span-6">
        <NeedsOverviewCard needs={needs} />
      </div>

      {showEnrollment ? (
        <div className="mp-reveal mp-span-6">
          <EnrollmentPanel enrollment={enrollment} />
        </div>
      ) : (
        <>
          <div className="mp-reveal mp-span-3">
            <AdvisorCard advisor={advisor} />
          </div>
          <div className="mp-reveal mp-span-3">
            <TicketsOverviewCard tickets={tickets} />
          </div>
        </>
      )}

      {showEnrollment && (
        <>
          <div className="mp-reveal mp-span-3">
            <AdvisorCard advisor={advisor} />
          </div>
          <div className="mp-reveal mp-span-3">
            <TicketsOverviewCard tickets={tickets} />
          </div>
        </>
      )}

      <div className="mp-reveal mp-span-12">
        <Bezel>
          <div className="flex items-start gap-4 p-6 md:p-7">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(245,158,11,0.12)] text-[#b45309]">
              <WarningCircle weight="light" className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="mb-1 text-[0.85rem] font-bold text-[var(--mp-ink)]">
                Important Reminder
              </p>
              <p className="max-w-3xl text-[0.8rem] leading-relaxed text-slate-500">
                Double Helix Hub is a health sharing ministry, not insurance. Members share each
                other&apos;s medical expenses according to program guidelines. Sharing is voluntary
                and not guaranteed. Please review your membership guidelines for complete details.
              </p>
            </div>
          </div>
        </Bezel>
      </div>
    </div>
  );
}
