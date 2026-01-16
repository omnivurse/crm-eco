'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import { 
  MessageSquare, 
  CheckSquare, 
  Phone, 
  Mail, 
  ArrowRightLeft,
  FileText,
  Calendar,
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface RecordMiniTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const EVENT_ICONS: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  note: { 
    icon: <MessageSquare className="w-3 h-3" />, 
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-500/20',
  },
  task: { 
    icon: <CheckSquare className="w-3 h-3" />, 
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-500/20',
  },
  call: { 
    icon: <Phone className="w-3 h-3" />, 
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
  },
  email: { 
    icon: <Mail className="w-3 h-3" />, 
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-500/20',
  },
  stage_change: { 
    icon: <ArrowRightLeft className="w-3 h-3" />, 
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-500/20',
  },
  attachment: { 
    icon: <FileText className="w-3 h-3" />, 
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-500/20',
  },
  meeting: { 
    icon: <Calendar className="w-3 h-3" />, 
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-500/20',
  },
};

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getEventTitle(event: TimelineEvent): string {
  const data = event.data;
  
  switch (event.type) {
    case 'note':
      const body = String(data.body || '');
      return body.length > 50 ? body.slice(0, 50) + '...' : body;
    case 'task':
      return String(data.title || 'Task');
    case 'call':
      return `Call - ${data.result || 'logged'}`;
    case 'email':
      return String(data.subject || 'Email sent');
    case 'stage_change':
      return `Stage: ${data.from_stage || '?'} → ${data.to_stage || '?'}`;
    case 'attachment':
      return String(data.file_name || 'File uploaded');
    case 'meeting':
      return String(data.title || 'Meeting');
    default:
      return 'Activity';
  }
}

export function RecordMiniTimeline({ events, className }: RecordMiniTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={cn('text-center py-4 text-sm text-slate-500', className)}>
        No recent activity
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {events.map((event, index) => {
        const config = EVENT_ICONS[event.type] || EVENT_ICONS.note;
        
        return (
          <div
            key={event.id}
            className="flex items-start gap-2 group"
          >
            {/* Icon */}
            <div className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
              config.bg, config.color
            )}>
              {config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                {getEventTitle(event)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatRelativeTime(event.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
