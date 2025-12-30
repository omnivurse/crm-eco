import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { Activity, ArrowRight, FileText, AlertTriangle, MessageSquare, Edit } from 'lucide-react';
import { format } from 'date-fns';

// Event type mapping to friendly labels
const eventTypeConfig: Record<string, { 
  label: string; 
  icon: React.ReactNode;
  className: string;
}> = {
  status_change: {
    label: 'Status Updated',
    icon: <ArrowRight className="w-3 h-3" />,
    className: 'text-blue-600 bg-blue-50',
  },
  step_completed: {
    label: 'Step Completed',
    icon: <FileText className="w-3 h-3" />,
    className: 'text-green-600 bg-green-50',
  },
  warning_flagged: {
    label: 'Warning Added',
    icon: <AlertTriangle className="w-3 h-3" />,
    className: 'text-amber-600 bg-amber-50',
  },
  note: {
    label: 'Note',
    icon: <MessageSquare className="w-3 h-3" />,
    className: 'text-slate-600 bg-slate-50',
  },
  field_update: {
    label: 'Details Updated',
    icon: <Edit className="w-3 h-3" />,
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
            <Activity className="w-5 h-5 text-blue-600" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-4">
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
          <Activity className="w-5 h-5 text-blue-600" />
          Activity History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {auditLog.map((entry) => {
            const config = eventTypeConfig[entry.event_type] || eventTypeConfig.note;
            
            // Extract status transition if present
            const oldStatus = entry.data_before?.status as string | undefined;
            const newStatus = entry.data_after?.status as string | undefined;
            const hasTransition = oldStatus && newStatus && oldStatus !== newStatus;

            return (
              <div
                key={entry.id}
                className="flex gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.className}`}>
                  {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">
                      {config.label}
                    </span>
                    {hasTransition && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <span className="capitalize">{oldStatus}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="capitalize">{newStatus}</span>
                      </span>
                    )}
                  </div>
                  {entry.message && (
                    <p className="text-sm text-slate-600 mt-0.5 truncate">
                      {entry.message}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
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

