'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@crm-eco/ui';
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  Bell,
  TrendingDown,
  MessageSquare,
  Check,
  X,
  AlarmClock,
  ChevronRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { WorkqueueItem, WorkqueueActionKey } from '@/lib/workqueue/types';

// ---------------------------------------------------------------------------
// Visual config per item type
// ---------------------------------------------------------------------------

interface TypeVisual {
  icon: LucideIcon;
  label: string;
  dot: string;
  badgeCls: string;
}

const TYPE_VISUALS: Record<WorkqueueItem['type'], TypeVisual> = {
  pending_approval: {
    icon: ClipboardCheck,
    label: 'Approval',
    dot: 'bg-green-400',
    badgeCls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  overdue_task: {
    icon: Clock,
    label: 'Overdue',
    dot: 'bg-amber-400',
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  today_task: {
    icon: Clock,
    label: 'Today',
    dot: 'bg-blue-400',
    badgeCls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  follow_up: {
    icon: Bell,
    label: 'Follow Up',
    dot: 'bg-purple-400',
    badgeCls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  at_risk_deal: {
    icon: TrendingDown,
    label: 'At Risk',
    dot: 'bg-red-400',
    badgeCls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  unread_message: {
    icon: MessageSquare,
    label: 'Message',
    dot: 'bg-teal-400',
    badgeCls: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  },
};

// ---------------------------------------------------------------------------
// Link resolver
// ---------------------------------------------------------------------------

function getItemHref(item: WorkqueueItem): string {
  switch (item.type) {
    case 'pending_approval':
      return `/crm/approvals/requests/${item.id}`;
    case 'overdue_task':
    case 'today_task':
    case 'follow_up':
      return item.recordId ? `/crm/r/${item.recordId}` : '/crm/activities';
    case 'at_risk_deal':
      return item.recordId ? `/crm/r/${item.recordId}` : '/crm/pipeline';
    case 'unread_message':
      return `/crm/inbox/${item.id}`;
    default:
      return '/crm';
  }
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) {
    const absSeconds = Math.abs(seconds);
    if (absSeconds < 3600) return `in ${Math.floor(absSeconds / 60)}m`;
    if (absSeconds < 86400) return `in ${Math.floor(absSeconds / 3600)}h`;
    return `in ${Math.floor(absSeconds / 86400)}d`;
  }
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WorkqueueItemRowProps {
  item: WorkqueueItem;
  onAction: (itemId: string, itemType: WorkqueueItem['type'], action: WorkqueueActionKey) => Promise<boolean>;
}

export function WorkqueueItemRow({ item, onAction }: WorkqueueItemRowProps) {
  const [processing, setProcessing] = useState<WorkqueueActionKey | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const visual = TYPE_VISUALS[item.type];
  const Icon = visual.icon;
  const href = getItemHref(item);

  async function handleAction(actionKey: WorkqueueActionKey, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setProcessing(actionKey);
    try {
      const ok = await onAction(item.id, item.type, actionKey);
      if (ok && ['complete', 'dismiss', 'approve', 'reject'].includes(actionKey)) {
        setDismissed(true);
      }
    } finally {
      setProcessing(null);
    }
  }

  if (dismissed) {
    return (
      <div className="flex items-center gap-4 px-5 py-3 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 transition-all duration-300">
        <Check className="w-4 h-4" />
        <span className="text-sm">Done &mdash; {item.title}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
    >
      {/* Priority dot */}
      <div className={cn('w-2 h-2 rounded-full shrink-0', visual.dot)} />

      {/* Type badge */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border shrink-0',
          visual.badgeCls,
        )}
      >
        <Icon className="w-3 h-3" />
        {visual.label}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
          {item.title}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
          {item.subtitle}
        </p>
      </div>

      {/* Quick-action buttons */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.actions.map((act) => {
          const isProcessing = processing === act.key;

          if (act.key === 'open') return null;

          return (
            <Button
              key={act.key}
              size="sm"
              variant="ghost"
              className={cn(
                'h-7 px-2 text-xs font-medium',
                act.variant === 'primary' && 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10',
                act.variant === 'danger' && 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10',
                act.variant === 'secondary' && 'text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
              disabled={processing !== null}
              onClick={(e) => handleAction(act.key, e)}
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : act.key === 'approve' ? (
                <Check className="w-3.5 h-3.5" />
              ) : act.key === 'reject' ? (
                <X className="w-3.5 h-3.5" />
              ) : act.key === 'complete' ? (
                <Check className="w-3.5 h-3.5" />
              ) : act.key === 'snooze' ? (
                <AlarmClock className="w-3.5 h-3.5" />
              ) : null}
              <span className="ml-1">{act.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Time */}
      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
        {item.dueAt ? timeAgo(item.dueAt) : timeAgo(item.createdAt)}
      </span>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}
