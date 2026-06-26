import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { MessageSquare, HelpCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

interface TicketSummary {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  created_at: string;
}

interface SupportTicketsListProps {
  tickets: TicketSummary[];
}

// Category display mapping
const categoryLabels: Record<string, string> = {
  service: 'General',
  enrollment: 'Enrollment',
  billing: 'Billing',
  need: 'Needs',
  other: 'Technical',
};

export function SupportTicketsList({ tickets }: SupportTicketsListProps) {
  if (!tickets || tickets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            Your Support Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <HelpCircle className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 mb-2">No support tickets yet.</p>
            <p className="text-sm text-slate-500">
              Use the form above to send us a message if you need help.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Your Support Tickets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/support/${ticket.id}`}
              className="block p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-slate-900 truncate">
                      {ticket.subject}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {categoryLabels[ticket.category] || ticket.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    Opened {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ticket.status} showIcon={false} />
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

