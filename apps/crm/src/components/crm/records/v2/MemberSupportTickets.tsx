'use client';

/**
 * Surfaces shared public.tickets for a linked MMS member on the CRM record shell.
 * Same rows as Admin /support and CRM /crm/tickets — no duplicate ticket system.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Ticket } from 'lucide-react';
import { Badge } from '@crm-eco/ui';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@crm-eco/ui/lib/utils';

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
};

export interface MemberSupportTicketsProps {
  memberId: string;
  className?: string;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'open' || status === 'in_progress') return 'default';
  if (status === 'waiting') return 'secondary';
  if (status === 'resolved' || status === 'closed') return 'outline';
  return 'outline';
}

export function MemberSupportTickets({ memberId, className }: MemberSupportTicketsProps) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('tickets')
        .select('id, subject, status, priority, category, created_at')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (cancelled) return;
      if (queryError) {
        setError('Could not load support tickets');
        setTickets([]);
      } else {
        setTickets((data ?? []) as TicketRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Support tickets</h3>
        </div>
        <Link href="/crm/tickets" className="text-xs font-medium text-teal-600 hover:underline">
          Open queue
        </Link>
      </header>
      <div className="px-4 py-3">
        {loading && <p className="text-xs text-slate-500">Loading tickets…</p>}
        {!loading && error && <p className="text-xs text-red-600">{error}</p>}
        {!loading && !error && tickets.length === 0 && (
          <p className="text-xs text-slate-500">No support tickets for this member.</p>
        )}
        {!loading && !error && tickets.length > 0 && (
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/crm/tickets/${ticket.id}`}
                    className="truncate text-sm font-medium text-slate-900 hover:underline dark:text-white"
                  >
                    {ticket.subject}
                  </Link>
                  <p className="text-[11px] text-slate-500">
                    {format(new Date(ticket.created_at), 'MMM d, yyyy')} · {ticket.category}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant={statusVariant(ticket.status)} className="text-[10px]">
                    {ticket.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
