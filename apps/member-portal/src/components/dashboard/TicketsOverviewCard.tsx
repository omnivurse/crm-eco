import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { Bezel } from '@/components/ui/Bezel';

interface TicketSummary {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  created_at: string;
}

interface TicketsOverviewCardProps {
  tickets: TicketSummary[];
}

export function TicketsOverviewCard({ tickets }: TicketsOverviewCardProps) {
  const openCount = (tickets ?? []).filter(
    (t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting',
  ).length;

  return (
    <Bezel>
      <div className="flex h-full flex-col p-6 md:p-7">
        <p className="mp-kicker mp-kicker-teal">Support</p>
        <p className="mt-1 text-[1.75rem] font-bold leading-none tracking-[-0.03em] text-[var(--mp-ink)]">
          {openCount}
        </p>
        <p className="mt-1 text-[0.8rem] text-slate-500">
          {openCount === 1 ? 'Open ticket' : 'Open tickets'}
        </p>
        {(tickets ?? []).slice(0, 2).map((ticket) => (
          <Link
            key={ticket.id}
            href={`/support/${ticket.id}`}
            className="mt-3 block truncate border-t border-[rgba(11,109,133,0.06)] pt-3 text-[0.8rem] font-medium text-[var(--mp-ink)] hover:text-[var(--mp-teal)]"
          >
            {ticket.subject}
          </Link>
        ))}
        <Link
          href={openCount > 0 ? '/support' : '/support/new'}
          className="mt-auto inline-flex items-center gap-1 pt-4 text-[0.8rem] font-semibold text-[var(--mp-teal)] transition-[gap] duration-500 hover:gap-1.5"
        >
          {openCount > 0 ? 'View tickets' : 'Get help'}
          <ArrowUpRight weight="light" className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Bezel>
  );
}
