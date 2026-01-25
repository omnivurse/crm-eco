import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CallLog {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  recipient_phone: string;
  status: string;
  direction: string;
  duration_seconds: number;
  ticket_id: string | null;
  created_at: string;
}

interface Props {
  calls: CallLog[];
}

export default function CallHistoryList({ calls }: Props) {
  function getCallIcon(direction: string, status: string) {
    if (status === 'missed') {
      return <PhoneMissed className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (direction === 'inbound') {
      return <PhoneIncoming className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    return <PhoneOutgoing className="w-4 h-4 text-green-600 dark:text-green-400" />;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ended':
        return 'text-green-600 dark:text-green-400';
      case 'missed':
        return 'text-red-600 dark:text-red-400';
      case 'voicemail':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-12">
        <Phone className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">No calls yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <div
          key={call.id}
          className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
              {getCallIcon(call.direction, call.status)}
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-slate-50">
                {call.caller_name || call.caller_phone}
              </p>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className={getStatusColor(call.status)}>
                  {call.status}
                </span>
                {call.duration_seconds > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(call.duration_seconds)}
                  </span>
                )}
                <span>{formatDate(call.created_at)}</span>
              </div>
            </div>
          </div>
          {call.ticket_id && (
            <Link
              to={`/tickets/${call.ticket_id}`}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm flex items-center gap-1"
            >
              View Ticket
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
