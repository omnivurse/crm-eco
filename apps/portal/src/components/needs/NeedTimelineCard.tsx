import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { History, CheckCircle, Clock, FileText, MessageSquare, AlertTriangle, Send } from 'lucide-react';
import { format } from 'date-fns';

interface NeedEvent {
  id: string;
  event_type: string;
  description: string | null;
  note: string | null;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
  occurred_at: string | null;
}

interface NeedTimelineCardProps {
  events: NeedEvent[];
}

// Map event types to friendly labels and icons
const getEventConfig = (eventType: string) => {
  const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    created: {
      label: 'Need Created',
      icon: <FileText className="w-4 h-4" />,
      className: 'text-blue-600 bg-blue-100',
    },
    submitted: {
      label: 'Submitted for Review',
      icon: <Send className="w-4 h-4" />,
      className: 'text-blue-600 bg-blue-100',
    },
    docs_received: {
      label: 'Documents Received',
      icon: <FileText className="w-4 h-4" />,
      className: 'text-green-600 bg-green-100',
    },
    docs_requested: {
      label: 'Documents Requested',
      icon: <AlertTriangle className="w-4 h-4" />,
      className: 'text-amber-600 bg-amber-100',
    },
    in_review: {
      label: 'In Review',
      icon: <Clock className="w-4 h-4" />,
      className: 'text-blue-600 bg-blue-100',
    },
    approved: {
      label: 'Approved',
      icon: <CheckCircle className="w-4 h-4" />,
      className: 'text-green-600 bg-green-100',
    },
    paid: {
      label: 'Reimbursement Processed',
      icon: <CheckCircle className="w-4 h-4" />,
      className: 'text-green-600 bg-green-100',
    },
    denied: {
      label: 'Not Approved',
      icon: <AlertTriangle className="w-4 h-4" />,
      className: 'text-red-600 bg-red-100',
    },
    closed: {
      label: 'Closed',
      icon: <CheckCircle className="w-4 h-4" />,
      className: 'text-slate-600 bg-slate-100',
    },
    note: {
      label: 'Update',
      icon: <MessageSquare className="w-4 h-4" />,
      className: 'text-slate-600 bg-slate-100',
    },
    status_change: {
      label: 'Status Changed',
      icon: <Clock className="w-4 h-4" />,
      className: 'text-blue-600 bg-blue-100',
    },
    consent_recorded: {
      label: 'Member Consent Recorded',
      icon: <CheckCircle className="w-4 h-4" />,
      className: 'text-green-600 bg-green-100',
    },
    payment_recorded: {
      label: 'Payment Information Added',
      icon: <CheckCircle className="w-4 h-4" />,
      className: 'text-blue-600 bg-blue-100',
    },
  };

  return configs[eventType] || {
    label: eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: <History className="w-4 h-4" />,
    className: 'text-slate-600 bg-slate-100',
  };
};

// Map status values to friendly labels
const getStatusLabel = (status: string | null): string => {
  if (!status) return '';
  const statusMap: Record<string, string> = {
    open: 'New',
    submitted: 'Submitted',
    in_review: 'In Review',
    awaiting_docs: 'Waiting on Documents',
    processing: 'Processing',
    approved: 'Approved',
    paid: 'Paid',
    closed: 'Closed',
    denied: 'Not Approved',
  };
  return statusMap[status] || status;
};

export function NeedTimelineCard({ events }: NeedTimelineCardProps) {
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="w-6 h-6 text-slate-600" />
            Activity & Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-center py-8">
            No activity recorded for this Need yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <History className="w-6 h-6 text-slate-600" />
          Activity & Updates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

          <div className="space-y-6">
            {events.map((event, index) => {
              const config = getEventConfig(event.event_type);
              const eventDate = event.occurred_at || event.created_at;
              const hasStatusChange = event.old_status && event.new_status;

              return (
                <div key={event.id} className="relative pl-10">
                  {/* Icon circle */}
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${config.className}`}
                  >
                    {config.icon}
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h4 className="font-medium text-slate-900">
                        {config.label}
                        {hasStatusChange && (
                          <span className="font-normal text-slate-600 ml-2">
                            ({getStatusLabel(event.old_status)} → {getStatusLabel(event.new_status)})
                          </span>
                        )}
                      </h4>
                      <time className="text-sm text-slate-500 whitespace-nowrap">
                        {format(new Date(eventDate), 'MMM d, yyyy h:mm a')}
                      </time>
                    </div>

                    {(event.description || event.note) && (
                      <p className="text-slate-600 text-sm">
                        {event.description || event.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

