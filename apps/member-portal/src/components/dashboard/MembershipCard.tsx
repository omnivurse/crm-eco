import Link from 'next/link';
import { ArrowUpRight, Heart } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';
import { StatusBadge } from '@crm-eco/ui/components/status-badge';
import { Bezel } from '@/components/ui/Bezel';

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

interface MembershipCardProps {
  membership: MembershipWithPlan | null;
}

export function MembershipCard({ membership }: MembershipCardProps) {
  if (!membership) {
    return (
      <Bezel>
        <div className="p-6 md:p-7">
          <p className="mp-kicker mp-kicker-teal">Your membership</p>
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mp-mist)]">
              <Heart weight="light" className="h-7 w-7 text-slate-400" aria-hidden />
            </div>
            <p className="mb-1 font-medium text-[var(--mp-ink)]">No active membership yet.</p>
            <p className="mb-4 text-sm text-slate-500">
              Start a new enrollment to apply for membership.
            </p>
            <Link href="/enroll" className="mp-btn-island mx-auto">
              Start Enrollment
              <span className="mp-btn-ico" aria-hidden>
                <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>
      </Bezel>
    );
  }

  const monthlyAmount = membership.billing_amount || membership.plans?.monthly_share;

  return (
    <Bezel>
      <div className="p-6 md:p-7">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="mp-kicker mp-kicker-teal">Your membership</p>
          <StatusBadge status={membership.status} className="capitalize" />
        </div>
        <h2 className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--mp-ink)]">
          {membership.plans?.name || 'N/A'}
        </h2>
        {membership.plans?.code && (
          <p className="text-[0.8rem] text-slate-500">Plan code · {membership.plans.code}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--mp-mist)] px-4 py-3">
            <label className="mb-0.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Member #
            </label>
            <strong className="text-[0.95rem] font-bold tracking-[-0.02em] text-[var(--mp-ink)]">
              {membership.membership_number || 'Pending'}
            </strong>
          </div>
          <div className="rounded-2xl bg-[var(--mp-mist)] px-4 py-3">
            <label className="mb-0.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Effective
            </label>
            <strong className="text-[0.95rem] font-bold tracking-[-0.02em] text-[var(--mp-ink)]">
              {format(new Date(membership.effective_date), 'MMM d, yyyy')}
            </strong>
          </div>
        </div>

        {monthlyAmount != null && (
          <p className="mt-3 text-sm text-slate-500">
            Monthly share{' '}
            <span className="font-semibold text-[var(--mp-ink)]">${monthlyAmount}/mo</span>
          </p>
        )}

        <Link
          href="/plan"
          className="mt-4 inline-flex items-center gap-1 text-[0.8rem] font-semibold text-[var(--mp-teal)] transition-[gap] duration-500 hover:gap-1.5"
        >
          View details
          <ArrowUpRight weight="light" className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Bezel>
  );
}
