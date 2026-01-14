'use client';

import { useState } from 'react';
import { 
  ArrowRight,
  CheckSquare,
  Phone,
  Users,
  Mail,
  StickyNote,
  Paperclip,
  FileEdit,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Filter,
  ClipboardCheck,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import type { 
  TimelineEvent, 
  TimelineEventType,
  CrmStageHistoryWithUser,
  CrmTaskWithAssignee,
  CrmNoteWithAuthor,
  CrmAttachmentWithAuthor,
  CrmAuditLogWithActor,
} from '@/lib/crm/types';

interface RecordTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
  className?: string;
}

const EVENT_ICONS: Record<TimelineEventType, React.ReactNode> = {
  stage_change: <ArrowRight className="w-4 h-4" />,
  activity: <CheckSquare className="w-4 h-4" />,
  note: <StickyNote className="w-4 h-4" />,
  attachment: <Paperclip className="w-4 h-4" />,
  audit: <FileEdit className="w-4 h-4" />,
  message: <Mail className="w-4 h-4" />,
};

const EVENT_COLORS: Record<TimelineEventType, { bg: string; text: string; border: string }> = {
  stage_change: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  activity: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  note: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  attachment: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  audit: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  message: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
};

const ACTIVITY_TYPE_ICONS: Record<string, React.ReactNode> = {
  task: <CheckSquare className="w-4 h-4" />,
  call: <Phone className="w-4 h-4" />,
  meeting: <Users className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
};

function StageChangeEvent({ data }: { data: CrmStageHistoryWithUser }) {
  const duration = data.duration_seconds 
    ? formatDuration(data.duration_seconds)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {data.from_stage && (
          <>
            <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-slate-300">
              {data.from_stage}
            </Badge>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </>
        )}
        <Badge variant="outline" className="bg-teal-500/10 border-teal-500/30 text-teal-400">
          {data.to_stage}
        </Badge>
      </div>
      {data.reason && (
        <p className="text-sm text-slate-400">{data.reason}</p>
      )}
      {duration && (
        <p className="text-xs text-slate-500">
          Time in previous stage: {duration}
        </p>
      )}
    </div>
  );
}

function ActivityEvent({ data }: { data: CrmTaskWithAssignee }) {
  const icon = ACTIVITY_TYPE_ICONS[data.activity_type] || ACTIVITY_TYPE_ICONS.task;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-white">{data.title}</span>
        <Badge 
          variant="outline" 
          className={cn(
            'capitalize',
            data.status === 'completed' 
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-slate-800/50 border-slate-600 text-slate-300'
          )}
        >
          {data.status}
        </Badge>
      </div>
      {data.description && (
        <p className="text-sm text-slate-400 line-clamp-2">{data.description}</p>
      )}
      {data.due_at && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Due: {format(new Date(data.due_at), 'MMM d, yyyy h:mm a')}
        </p>
      )}
      {data.call_result && (
        <p className="text-xs text-slate-500">
          Call result: <span className="capitalize">{data.call_result.replace('_', ' ')}</span>
        </p>
      )}
      {data.outcome && (
        <p className="text-sm text-slate-400 italic">{data.outcome}</p>
      )}
    </div>
  );
}

function NoteEvent({ data }: { data: CrmNoteWithAuthor }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = data.body.length > 200;
  
  return (
    <div className="space-y-2">
      <p className={cn(
        'text-sm text-slate-300 whitespace-pre-wrap',
        !expanded && isLong && 'line-clamp-3'
      )}>
        {data.body}
      </p>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-6 px-2 text-xs text-slate-400 hover:text-white"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Show more
            </>
          )}
        </Button>
      )}
      {data.is_pinned && (
        <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-400 text-xs">
          Pinned
        </Badge>
      )}
    </div>
  );
}

function AttachmentEvent({ data }: { data: CrmAttachmentWithAuthor }) {
  const sizeStr = data.file_size 
    ? formatFileSize(data.file_size)
    : '';

  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-800/50">
        <Paperclip className="w-4 h-4 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{data.file_name}</p>
        <p className="text-xs text-slate-500">
          {data.mime_type} {sizeStr && `• ${sizeStr}`}
        </p>
      </div>
    </div>
  );
}

function AuditEvent({ data }: { data: CrmAuditLogWithActor }) {
  const actionLabels: Record<string, string> = {
    create: 'Created record',
    update: 'Updated record',
    delete: 'Deleted record',
    import: 'Imported record',
    bulk_update: 'Bulk update',
    stage_change: 'Changed stage',
    approval_request: 'Requested approval',
    approval_action: 'Approval decision',
    approval_apply: 'Approved action applied',
    rule_triggered: 'Rule triggered',
  };

  // Special rendering for approval events
  if (data.action === 'approval_action' && data.diff) {
    const diff = data.diff as { action?: string; comment?: string; new_status?: string };
    const actionIcon = diff.action === 'approve' 
      ? <Check className="w-4 h-4 text-green-400" />
      : diff.action === 'reject'
      ? <X className="w-4 h-4 text-red-400" />
      : <MessageSquare className="w-4 h-4 text-yellow-400" />;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {actionIcon}
          <span className="text-sm text-slate-300 capitalize">
            {diff.action === 'request_changes' ? 'Requested changes' : diff.action || 'Decision made'}
          </span>
          {diff.new_status && (
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs',
                diff.new_status === 'approved' && 'bg-green-500/10 border-green-500/30 text-green-400',
                diff.new_status === 'rejected' && 'bg-red-500/10 border-red-500/30 text-red-400',
                diff.new_status === 'pending' && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
              )}
            >
              {diff.new_status}
            </Badge>
          )}
        </div>
        {diff.comment && (
          <p className="text-sm text-slate-400 italic">&ldquo;{diff.comment}&rdquo;</p>
        )}
      </div>
    );
  }

  if (data.action === 'approval_request' && data.diff) {
    const diff = data.diff as { trigger_type?: string; action_type?: string };
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-slate-300">Approval requested</span>
        </div>
        {diff.action_type && (
          <p className="text-xs text-slate-500">
            Action type: <span className="capitalize">{diff.action_type.replace('_', ' ')}</span>
          </p>
        )}
      </div>
    );
  }

  if (data.action === 'approval_apply') {
    return (
      <div className="flex items-center gap-2">
        <Check className="w-4 h-4 text-green-400" />
        <span className="text-sm text-slate-300">Approved action was applied</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-300">
        {actionLabels[data.action] || data.action}
      </p>
      {data.action === 'update' && data.diff && (
        <p className="text-xs text-slate-500">
          Fields modified
        </p>
      )}
    </div>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const icon = EVENT_ICONS[event.type];
  const colors = EVENT_COLORS[event.type];
  
  // Get the user info based on event type
  let userName: string | null = null;
  if (event.type === 'stage_change') {
    userName = (event.data as CrmStageHistoryWithUser).changed_by_name;
  } else if (event.type === 'activity') {
    userName = (event.data as CrmTaskWithAssignee).assignee?.full_name || null;
  } else if (event.type === 'note') {
    userName = (event.data as CrmNoteWithAuthor).author?.full_name || null;
  } else if (event.type === 'attachment') {
    userName = (event.data as CrmAttachmentWithAuthor).author?.full_name || null;
  } else if (event.type === 'audit') {
    userName = (event.data as CrmAuditLogWithActor).actor?.full_name || null;
  }

  const renderContent = () => {
    switch (event.type) {
      case 'stage_change':
        return <StageChangeEvent data={event.data as CrmStageHistoryWithUser} />;
      case 'activity':
        return <ActivityEvent data={event.data as CrmTaskWithAssignee} />;
      case 'note':
        return <NoteEvent data={event.data as CrmNoteWithAuthor} />;
      case 'attachment':
        return <AttachmentEvent data={event.data as CrmAttachmentWithAuthor} />;
      case 'audit':
        return <AuditEvent data={event.data as CrmAuditLogWithActor} />;
      default:
        return <p className="text-sm text-slate-400">Unknown event type</p>;
    }
  };

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-5 top-10 bottom-0 w-px bg-white/10 last:hidden" />
      
      {/* Icon */}
      <div className={cn(
        'relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
        colors.bg,
        colors.text,
        'border',
        colors.border
      )}>
        {event.type === 'activity' 
          ? ACTIVITY_TYPE_ICONS[(event.data as CrmTaskWithAssignee).activity_type] || icon
          : icon
        }
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {event.type.replace('_', ' ')}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-xs text-slate-500">
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </span>
          {userName && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" />
                {userName}
              </span>
            </>
          )}
        </div>
        
        {/* Event content */}
        <div className="glass-card rounded-xl p-4 border border-white/5">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export function RecordTimeline({ events, isLoading, className }: RecordTimelineProps) {
  const [filter, setFilter] = useState<TimelineEventType | 'all'>('all');

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(e => e.type === filter);

  const eventCounts = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-800/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-slate-800/50 rounded" />
              <div className="h-20 bg-slate-800/30 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-full',
            filter === 'all' 
              ? 'bg-teal-500 hover:bg-teal-400 text-white' 
              : 'glass border-white/10 text-slate-300 hover:text-white'
          )}
        >
          All ({events.length})
        </Button>
        {Object.entries(EVENT_ICONS).map(([type, icon]) => {
          const count = eventCounts[type] || 0;
          if (count === 0) return null;
          
          return (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(type as TimelineEventType)}
              className={cn(
                'rounded-full',
                filter === type 
                  ? 'bg-teal-500 hover:bg-teal-400 text-white' 
                  : 'glass border-white/10 text-slate-300 hover:text-white'
              )}
            >
              {icon}
              <span className="ml-1.5 capitalize">{type.replace('_', ' ')}s</span>
              <span className="ml-1 text-xs opacity-70">({count})</span>
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      {filteredEvents.length > 0 ? (
        <div className="space-y-0">
          {filteredEvents.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-1">No timeline events</h3>
          <p className="text-slate-400">
            {filter === 'all' 
              ? 'Activity will appear here as it happens'
              : `No ${filter.replace('_', ' ')} events found`
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
