import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { Bezel } from '@/components/ui/Bezel';

interface AdvisorCardProps {
  advisor: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url?: string | null;
  } | null;
}

export function AdvisorCard({ advisor }: AdvisorCardProps) {
  if (!advisor) {
    return (
      <Bezel>
        <div className="p-6 md:p-7">
          <p className="mp-kicker mp-kicker-teal">Your advisor</p>
          <p className="mt-2 text-sm text-slate-500">
            We&apos;ll match you with an advisor once your enrollment is active.
          </p>
        </div>
      </Bezel>
    );
  }

  const fullName =
    `${advisor.first_name ?? ''} ${advisor.last_name ?? ''}`.trim() || 'Your advisor';
  const initials = (advisor.first_name?.[0] ?? '') + (advisor.last_name?.[0] ?? '');

  return (
    <Bezel>
      <div className="flex h-full flex-col p-6 md:p-7">
        <p className="mp-kicker mp-kicker-teal">Your advisor</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--mp-teal-soft)] to-[#12a065] text-sm font-semibold text-white">
            {initials.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <strong className="block text-[0.95rem] font-bold text-[var(--mp-ink)]">
              {fullName}
            </strong>
            <span className="text-[0.8rem] text-slate-500">Healthshare advisor</span>
          </div>
        </div>
        <Link
          href="/support?topic=advisor"
          className="mt-auto inline-flex items-center gap-1 pt-4 text-[0.8rem] font-semibold text-[var(--mp-teal)] transition-[gap] duration-500 hover:gap-1.5"
        >
          Message
          <ArrowUpRight weight="light" className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Bezel>
  );
}
