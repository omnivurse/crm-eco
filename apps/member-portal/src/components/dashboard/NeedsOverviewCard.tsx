import Link from 'next/link';
import { ArrowUpRight, SealQuestion } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';
import { Bezel } from '@/components/ui/Bezel';

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

interface NeedsOverviewCardProps {
  needs: NeedSummary[];
}

const formatAmount = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function NeedsOverviewCard({ needs }: NeedsOverviewCardProps) {
  if (!needs || needs.length === 0) {
    return (
      <Bezel>
        <div className="p-6 md:p-7">
          <p className="mp-kicker mp-kicker-teal">Needs</p>
          <h2 className="mb-4 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--mp-ink)]">
            Recent sharing requests
          </h2>
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mp-mist)]">
              <SealQuestion weight="light" className="h-7 w-7 text-slate-400" aria-hidden />
            </div>
            <p className="mb-1 text-[var(--mp-ink)]">No Needs on file yet.</p>
            <p className="text-sm text-slate-500">
              When you submit a Need for sharing, you&apos;ll see updates here.
            </p>
          </div>
        </div>
      </Bezel>
    );
  }

  return (
    <Bezel>
      <div className="p-6 md:p-7">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div>
            <p className="mp-kicker mp-kicker-teal">Needs</p>
            <h2 className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--mp-ink)]">
              Recent sharing requests
            </h2>
          </div>
          <Link
            href="/needs"
            className="inline-flex shrink-0 items-center gap-1 text-[0.8rem] font-semibold text-[var(--mp-teal)]"
          >
            See all
            <ArrowUpRight weight="light" className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div>
          {needs.slice(0, 4).map((need) => (
            <div
              key={need.id}
              className="flex items-center justify-between border-b border-[rgba(11,109,133,0.06)] py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[0.85rem] font-semibold text-[var(--mp-ink)]">
                  {need.need_type}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-slate-500">
                  {need.status === 'paid' && need.reimbursed_amount > 0
                    ? `Shared ${format(new Date(need.created_at), 'MMM d')} · ${formatAmount(need.reimbursed_amount)}`
                    : `Submitted ${format(new Date(need.created_at), 'MMM d')} · ${formatAmount(need.total_amount)}`}
                </p>
              </div>
              <StatusBadge status={need.status} showIcon={false} />
            </div>
          ))}
        </div>
      </div>
    </Bezel>
  );
}
