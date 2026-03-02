'use client';

import React from 'react';
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
  X,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { InboxChannel, InboxStats, ConversationStatus } from '@/lib/inbox/types';

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
  stats: InboxStats | null;
  conversationCount: number;
  draftsCount?: number;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
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

const FilterItems = React.memo(function FilterItems({
  filter,
  onFilterChange,
  channelFilter,
  onChannelFilterChange,
  statusFilter = 'active',
  onStatusFilterChange,
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
  const { isMobileOpen, onMobileClose } = props;

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-52 flex-shrink-0 overflow-y-auto">
        <FilterItems {...props} />
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
