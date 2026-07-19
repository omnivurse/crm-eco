import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { Bezel } from '@/components/ui/Bezel';

interface NextBillingCardProps {
  schedule: {
    amount: number | null;
    next_billing_date: string | null;
    frequency?: string | null;
  } | null;
}

export function NextBillingCard({ schedule }: NextBillingCardProps) {
  return (
    <Bezel variant="deep">
      <div className="flex h-full flex-col p-6 md:p-7">
        <p className="mp-kicker mp-kicker-light">Next billing</p>
        {schedule?.next_billing_date ? (
          <>
            <p className="mt-1 text-[clamp(1.75rem,3vw,2.25rem)] font-bold leading-none tracking-[-0.03em] text-white">
              ${Number(schedule.amount ?? 0).toFixed(0)}
            </p>
            <p className="mt-2 text-[0.85rem] text-white/60">
              Due{' '}
              {new Date(schedule.next_billing_date).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <Link
              href="/billing"
              className="mt-auto inline-flex items-center gap-1 pt-4 text-[0.8rem] font-semibold text-white/85 transition-[gap] duration-500 hover:gap-1.5"
            >
              Manage
              <ArrowUpRight weight="light" className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-white/60">
            Once your enrollment is active, billing details will appear here.
          </p>
        )}
      </div>
    </Bezel>
  );
}
