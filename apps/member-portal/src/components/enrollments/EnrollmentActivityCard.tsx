import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { Pulse, ArrowRight, FileText, Warning, ChatCircle, PencilSimple } from '@phosphor-icons/react/dist/ssr';
import { format } from 'date-fns';

// Event type mapping to friendly labels
const eventTypeConfig: Record<string, { 
  label: string; 
  icon: React.ReactNode;
  className: string;
}> = {
  status_change: {
    label: 'Status Updated',
    icon: <ArrowRight weight="light" className="h-3 w-3" />,
    className: 'text-[var(--mp-teal)] bg-[rgba(11,109,133,0.08)]',
  },
  step_completed: {
    label: 'Step Completed',
    icon: <FileText weight="light" className="h-3 w-3" />,
    className: 'text-green-600 bg-green-50',
  },
  warning_flagged: {
    label: 'Warning Added',
    icon: <Warning weight="light" className="h-3 w-3" />,
    className: 'text-amber-600 bg-amber-50',
  },
  note: {
    label: 'Note',
    icon: <ChatCircle weight="light" className="h-3 w-3" />,
    className: 'text-slate-600 bg-slate-50',
  },
  field_update: {
    label: 'Details Updated',
    icon: <PencilSimple weight="light" className="h-3 w-3" />,
    className: 'text-slate-600 bg-slate-50',
  },
};

interface AuditLogEntry {
  id: string;
  event_type: string;
  message: string;
  data_before: Record<string, unknown> | null;
  data_after: Record<string, unknown> | null;
  created_at: string;
}

interface EnrollmentActivityCardProps {
  auditLog: AuditLogEntry[];
}

export function EnrollmentActivityCard({ auditLog }: EnrollmentActivityCardProps) {
  if (auditLog.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pulse weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-slate-500">
            No activity recorded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Pulse weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
          Activity History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {auditLog.map((entry) => {
            const config = eventTypeConfig[entry.event_type] || eventTypeConfig.note;
            
            // Extract status transition if present
            const oldStatus = entry.data_before?.status as string | undefined;
            const newStatus = entry.data_after?.status as string | undefined;
            const hasTransition = oldStatus && newStatus && oldStatus !== newStatus;

            return (
              <div
                key={entry.id}
                className="flex gap-3 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.className}`}>
                  {config.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {config.label}
                    </span>
                    {hasTransition && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <span className="capitalize">{oldStatus}</span>
                        <ArrowRight weight="light" className="h-3 w-3" />
                        <span className="capitalize">{newStatus}</span>
                      </span>
                    )}
                  </div>
                  {entry.message && (
                    <p className="mt-0.5 truncate text-sm text-slate-600">
                      {entry.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
