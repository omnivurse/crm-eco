'use client';

/**
 * The command row above an open thread.
 *
 * Outlook puts Reply / Reply all / Forward on a permanent bar; this inbox hid
 * them inside a "more actions" menu and behind a collapsed reply dock, so the
 * three things a person does with an email were the three hardest to find.
 *
 * Every control here is a real action wired to the page — nothing is decorative.
 */

import React from 'react';
import {
  Archive,
  Ban,
  Clock,
  Flag,
  Forward,
  Mail,
  MoveRight,
  Printer,
  Reply,
  ReplyAll,
  Trash2,
  Undo2,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { ConversationStatus } from '@/lib/inbox/types';
import { SNOOZE_PRESETS } from '@/lib/inbox/inbox-actions';

export interface InboxRibbonProps {
  status: ConversationStatus;
  flagged: boolean;
  unread: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onSpam: () => void;
  onRestore: () => void;
  onToggleFlag: () => void;
  onToggleRead: () => void;
  onSnooze: (until: string) => void;
  onMove: (status: ConversationStatus) => void;
  onPrint: () => void;
  /** No messages loaded yet — reply/forward would have nothing to quote. */
  disabled?: boolean;
}

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white';

const MOVE_TARGETS: Array<{ status: ConversationStatus; label: string }> = [
  { status: 'open', label: 'Inbox' },
  { status: 'pending', label: 'Pending' },
  { status: 'resolved', label: 'Resolved' },
  { status: 'archived', label: 'Archive' },
  { status: 'trash', label: 'Deleted Items' },
  { status: 'spam', label: 'Junk' },
];

export const InboxRibbon = React.memo(function InboxRibbon({
  status,
  flagged,
  unread,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onTrash,
  onSpam,
  onRestore,
  onToggleFlag,
  onToggleRead,
  onSnooze,
  onMove,
  onPrint,
  disabled = false,
}: InboxRibbonProps) {
  const inBin = status === 'trash' || status === 'spam';

  return (
    <div
      role="toolbar"
      aria-label="Email actions"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-slate-200/80 px-2 py-1 dark:border-white/10"
    >
      <button type="button" onClick={onReply} disabled={disabled} className={BUTTON}>
        <Reply className="h-4 w-4" aria-hidden />
        Reply
      </button>
      <button type="button" onClick={onReplyAll} disabled={disabled} className={BUTTON}>
        <ReplyAll className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Reply all</span>
      </button>
      <button type="button" onClick={onForward} disabled={disabled} className={BUTTON}>
        <Forward className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Forward</span>
      </button>

      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden />

      {inBin ? (
        <button type="button" onClick={onRestore} className={BUTTON}>
          <Undo2 className="h-4 w-4" aria-hidden />
          Restore
        </button>
      ) : (
        <>
          <button type="button" onClick={onArchive} className={BUTTON} title="Archive (E)">
            <Archive className="h-4 w-4" aria-hidden />
            <span className="hidden md:inline">Archive</span>
          </button>
          <button type="button" onClick={onTrash} className={BUTTON} title="Delete (Del)">
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="hidden md:inline">Delete</span>
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onToggleFlag}
        aria-pressed={flagged}
        className={cn(BUTTON, flagged && 'text-amber-600 dark:text-amber-400')}
        title={flagged ? 'Clear flag' : 'Flag this thread'}
      >
        <Flag className={cn('h-4 w-4', flagged && 'fill-current')} aria-hidden />
        <span className="hidden md:inline">{flagged ? 'Flagged' : 'Flag'}</span>
      </button>

      <button
        type="button"
        onClick={onToggleRead}
        className={BUTTON}
        title={unread ? 'Mark read (U)' : 'Mark unread (U)'}
      >
        <Mail className="h-4 w-4" aria-hidden />
        <span className="hidden lg:inline">{unread ? 'Mark read' : 'Mark unread'}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={BUTTON} title="Snooze until later">
            <Clock className="h-4 w-4" aria-hidden />
            <span className="hidden lg:inline">Snooze</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[190px]">
          {SNOOZE_PRESETS.map((preset) => (
            <DropdownMenuItem key={preset.key} onClick={() => onSnooze(preset.resolve().toISOString())}>
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={BUTTON} title="Move to folder">
            <MoveRight className="h-4 w-4" aria-hidden />
            <span className="hidden lg:inline">Move</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {MOVE_TARGETS.filter((target) => target.status !== status).map((target) => (
            <DropdownMenuItem key={target.status} onClick={() => onMove(target.status)}>
              {target.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSpam} disabled={status === 'spam'}>
            <Ban className="mr-2 h-4 w-4" aria-hidden />
            Report junk
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button type="button" onClick={onPrint} className={cn(BUTTON, 'ml-auto')} title="Print (Ctrl+P)">
        <Printer className="h-4 w-4" aria-hidden />
        <span className="sr-only">Print</span>
      </button>
    </div>
  );
});
