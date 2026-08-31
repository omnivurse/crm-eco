'use client';

import React, { useEffect, useRef } from 'react';
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  MessagesSquare,
  Inbox as InboxIcon,
  Send,
  FileText,
  Clock,
  Archive,
  Star,
  User,
  UserPlus,
  AlertCircle,
  AtSign,
  X,
  ChevronDown,
  ChevronRight,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { InboxChannel, InboxStats, ConversationStatus } from '@/lib/inbox/types';
import type { SharedMailbox } from '@/lib/inbox/shared-mailboxes';

type FilterType = 'all' | 'unread' | 'assigned_to_me' | 'unassigned';

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  sms: <MessageSquare className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  chat: <MessagesSquare className="w-4 h-4" />,
};

interface InboxFiltersProps {
  filter: FilterType;
  onFilterChange: (f: FilterType) => void;
  channelFilter: InboxChannel | 'all';
  onChannelFilterChange: (c: InboxChannel | 'all') => void;
  statusFilter?: ConversationStatus | 'active';
  onStatusFilterChange?: (s: ConversationStatus | 'active') => void;
  mailboxFilter?: string | 'all';
  onMailboxFilterChange?: (m: string | 'all') => void;
  mailboxes?: SharedMailbox[];
  mailboxesLoading?: boolean;
  stats: InboxStats | null;
  conversationCount: number;
  draftsCount?: number;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Desktop reading mode: hide the folder list behind a reopen rail. FilterItems stay mounted. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface FolderItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  highlight?: boolean;
  onClick: () => void;
  active: boolean;
}

/** Mailboxes shown before the list collapses behind "Show all". */
const MAILBOX_COLLAPSED_COUNT = 6;

const SharedMailboxSection = React.memo(function SharedMailboxSection({
  mailboxes,
  loading,
  activeMailbox,
  onSelect,
}: {
  mailboxes: SharedMailbox[];
  loading: boolean;
  activeMailbox: string | 'all';
  onSelect: (mailbox: string | 'all') => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  // A selected mailbox must stay visible even when it sits past the cutoff,
  // otherwise the active filter appears to vanish from the sidebar.
  const activeIsHidden =
    activeMailbox !== 'all' &&
    mailboxes.findIndex((m) => m.email === activeMailbox) >= MAILBOX_COLLAPSED_COUNT;

  const showAll = expanded || activeIsHidden;
  const visible = showAll ? mailboxes : mailboxes.slice(0, MAILBOX_COLLAPSED_COUNT);
  const hiddenCount = mailboxes.length - visible.length;

  return (
    <div>
      <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-1.5 px-2">
        Shared Mailboxes
      </h3>

      {loading ? (
        <div className="space-y-1 px-2.5 py-1" aria-label="Loading mailboxes">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-6 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : mailboxes.length === 0 ? (
        <p className="px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400">
          No verified sending addresses yet. Add one in Settings → Email Domains.
        </p>
      ) : (
        <div className="space-y-0.5">
          <button
            onClick={() => onSelect('all')}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
              activeMailbox === 'all'
                ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
            )}
          >
            <InboxIcon className="w-4 h-4 flex-shrink-0" />
            All Mailboxes
          </button>

          {visible.map((mailbox) => {
            const active = activeMailbox === mailbox.email;
            return (
              <button
                key={mailbox.email}
                onClick={() => onSelect(mailbox.email)}
                title={`${mailbox.label} — ${mailbox.email}`}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                  active
                    ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <AtSign className="w-4 h-4 flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate">{mailbox.label}</span>
                    <span className="block truncate text-[10px] font-normal text-slate-400 dark:text-slate-500">
                      {mailbox.email}
                    </span>
                  </span>
                </span>
                {mailbox.unreadCount > 0 && (
                  <span
                    className={cn(
                      'text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0',
                      active
                        ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400'
                        : 'bg-red-500 text-white'
                    )}
                  >
                    {mailbox.unreadCount}
                  </span>
                )}
              </button>
            );
          })}

          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              Show all {mailboxes.length}
            </button>
          )}

          {showAll && !activeIsHidden && mailboxes.length > MAILBOX_COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 rotate-180" />
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
});

const FilterItems = React.memo(function FilterItems({
  filter,
  onFilterChange,
  channelFilter,
  onChannelFilterChange,
  statusFilter = 'active',
  onStatusFilterChange,
  mailboxFilter = 'all',
  onMailboxFilterChange,
  mailboxes = [],
  mailboxesLoading = false,
  stats,
  conversationCount,
  draftsCount = 0,
  onItemClick,
}: InboxFiltersProps & { onItemClick?: () => void }) {
  const folders: FolderItem[] = [
    {
      key: 'inbox',
      label: 'Inbox',
      icon: <InboxIcon className="w-4 h-4" />,
      count: conversationCount,
      active: filter === 'all' && statusFilter === 'active',
      onClick: () => {
        onFilterChange('all');
        onStatusFilterChange?.('active');
        onItemClick?.();
      },
    },
    {
      key: 'unread',
      label: 'Unread',
      icon: <Mail className="w-4 h-4" />,
      count: stats?.total_unread || 0,
      highlight: true,
      active: filter === 'unread',
      onClick: () => {
        onFilterChange('unread');
        onItemClick?.();
      },
    },
    {
      key: 'sent',
      label: 'Sent',
      icon: <Send className="w-4 h-4" />,
      active: false, // Will be wired to outbound filter
      onClick: () => {
        onItemClick?.();
      },
    },
    {
      key: 'drafts',
      label: 'Drafts',
      icon: <FileText className="w-4 h-4" />,
      count: draftsCount,
      active: false,
      onClick: () => {
        onItemClick?.();
      },
    },
    {
      key: 'snoozed',
      label: 'Snoozed',
      icon: <Clock className="w-4 h-4" />,
      active: statusFilter === 'snoozed',
      onClick: () => {
        onFilterChange('all');
        onStatusFilterChange?.('snoozed');
        onItemClick?.();
      },
    },
    {
      key: 'archived',
      label: 'Archived',
      icon: <Archive className="w-4 h-4" />,
      active: statusFilter === 'archived',
      onClick: () => {
        onFilterChange('all');
        onStatusFilterChange?.('archived');
        onItemClick?.();
      },
    },
  ];

  const teamItems: FolderItem[] = [
    {
      key: 'assigned_to_me',
      label: 'Assigned to Me',
      icon: <User className="w-4 h-4" />,
      count: stats?.assigned_to_me || 0,
      active: filter === 'assigned_to_me',
      onClick: () => {
        onFilterChange('assigned_to_me');
        onItemClick?.();
      },
    },
    {
      key: 'unassigned',
      label: 'Unassigned',
      icon: <UserPlus className="w-4 h-4" />,
      count: stats?.unassigned || 0,
      active: filter === 'unassigned',
      onClick: () => {
        onFilterChange('unassigned');
        onItemClick?.();
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Folders */}
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-1.5 px-2">
          Folders
        </h3>
        <div className="space-y-0.5">
          {folders.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                item.active
                  ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              )}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                {item.label}
              </div>
              {(item.count ?? 0) > 0 && (
                <span className={cn(
                  'text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-semibold',
                  item.active
                    ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400'
                    : item.highlight
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                )}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Shared mailboxes */}
      {onMailboxFilterChange && (
        <SharedMailboxSection
          mailboxes={mailboxes}
          loading={mailboxesLoading}
          activeMailbox={mailboxFilter}
          onSelect={(m) => {
            onMailboxFilterChange(m);
            onItemClick?.();
          }}
        />
      )}

      {/* Team */}
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-1.5 px-2">
          Team
        </h3>
        <div className="space-y-0.5">
          {teamItems.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                item.active
                  ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              )}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                {item.label}
              </div>
              {(item.count ?? 0) > 0 && (
                <span className={cn(
                  'text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-semibold',
                  item.active
                    ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                )}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-1.5 px-2">
          Channels
        </h3>
        <div className="space-y-0.5">
          <button
            onClick={() => { onChannelFilterChange('all'); onItemClick?.(); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
              channelFilter === 'all'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
            )}
          >
            <InboxIcon className="w-4 h-4" />
            All Channels
          </button>
          {(['email', 'sms', 'whatsapp', 'phone', 'chat'] as InboxChannel[]).map((channel) => (
            <button
              key={channel}
              onClick={() => { onChannelFilterChange(channel); onItemClick?.(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors capitalize',
                channelFilter === channel
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              )}
            >
              {CHANNEL_ICONS[channel]}
              {channel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export const InboxFilters = React.memo(function InboxFilters(props: InboxFiltersProps) {
  const { isMobileOpen, onMobileClose, collapsed = false, onCollapsedChange } = props;
  const foldersRef = useRef<HTMLDivElement>(null);

  // Collapsing with aria-hidden while a folder button still has focus trips
  // Chrome's "Blocked aria-hidden" warning. inert + blur matches the shell drawer.
  useEffect(() => {
    if (!collapsed) return;
    const root = foldersRef.current;
    const active = document.activeElement;
    if (root && active instanceof HTMLElement && root.contains(active)) {
      active.blur();
    }
  }, [collapsed]);

  return (
    <>
      {/* Desktop Sidebar — hidden with CSS when reading so filter state is not remounted */}
      <div
        className={cn(
          'hidden lg:flex flex-col flex-shrink-0 min-h-0',
          collapsed ? 'w-10' : 'w-52',
        )}
      >
        {onCollapsedChange && (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="hidden lg:inline-flex items-center justify-center h-9 w-full shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show folders' : 'Hide folders'}
            title={collapsed ? 'Show folders' : 'Hide folders'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" aria-hidden />
            ) : (
              <PanelLeft className="w-4 h-4" aria-hidden />
            )}
          </button>
        )}
        <div
          ref={foldersRef}
          className={cn(
            'flex-1 min-h-0 overflow-y-auto',
            collapsed && 'hidden',
          )}
          inert={collapsed}
        >
          <FilterItems {...props} />
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inbox</h2>
              <button
                onClick={onMobileClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <FilterItems {...props} onItemClick={onMobileClose} />
          </div>
        </div>
      )}
    </>
  );
});
