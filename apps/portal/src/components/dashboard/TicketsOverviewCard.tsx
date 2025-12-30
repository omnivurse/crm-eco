import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { MessageSquare, ArrowRight, HelpCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';

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
  if (!tickets || tickets.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            Support & Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <HelpCircle className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 mb-2">No support tickets yet.</p>
            <p className="text-sm text-slate-500 mb-4">
              Have a question? We&apos;re here to help.
            </p>
            <Link href="/support/new">
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Contact Support
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Support & Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tickets.slice(0, 4).map((ticket) => (
            <Link
              key={ticket.id}
              href={`/support/${ticket.id}`}
              className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate mb-1">
                    {ticket.subject}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <StatusBadge status={ticket.status} showIcon={false} />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t flex items-center justify-between">
          <Link 
            href="/support" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all tickets
            <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href="/support/new">
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="w-3 h-3" />
              New Ticket
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

