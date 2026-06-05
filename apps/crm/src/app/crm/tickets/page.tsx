import { redirect } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { getTicketsBoardData } from '@/lib/crm/tickets-queries';
import { TicketsBoardShell } from '@/components/tickets/TicketsBoardShell';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';

export const dynamic = 'force-dynamic';

export default async function CrmTicketsPage() {
  const data = await getTicketsBoardData();
  if (!data) redirect('/crm-login');

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Ticket className="h-6 w-6 text-teal-600" />
            Support Tickets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Member support requests from the portal and internal service queue
          </p>
        </div>
        <CreateTicketDialog />
      </div>

      <TicketsBoardShell
        tickets={data.tickets}
        savedViews={data.savedViews}
        defaultSavedViewId={data.defaultSavedViewId}
        assignableProfiles={data.assignableProfiles}
        stats={data.stats}
      />
    </div>
  );
}
