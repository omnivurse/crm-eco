'use client';

import React from 'react';
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  MessagesSquare,
  Inbox as InboxIcon,
  Filter,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { InboxChannel, InboxStats } from '@/lib/inbox/types';

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
  stats: InboxStats | null;
  conversationCount: number;
  // Mobile overlay
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const FilterItems = React.memo(function FilterItems({
  filter,
  onFilterChange,
  channelFilter,
  onChannelFilterChange,
  stats,
  conversationCount,
  onItemClick,
}: InboxFiltersProps & { onItemClick?: () => void }) {
  const items = [
    { key: 'all' as FilterType, label: 'All Messages', icon: <InboxIcon className="w-4 h-4" />, count: conversationCount },
    { key: 'unread' as FilterType, label: 'Unread', icon: <Mail className="w-4 h-4" />, count: stats?.total_unread || 0, highlight: true },
    { key: 'assigned_to_me' as FilterType, label: 'Assigned to Me', icon: <User className="w-4 h-4" />, count: stats?.assigned_to_me || 0 },
    { key: 'unassigned' as FilterType, label: 'Unassigned', icon: <UserPlus className="w-4 h-4" />, count: stats?.unassigned || 0 },
  ];

  return (
    <>
      {/* Status Filters */}
      <div className="mb-6 lg:mb-0">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Inbox</h3>
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => { onFilterChange(item.key); onItemClick?.(); }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === item.key
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                {item.label}
              </div>
              {item.count > 0 && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  filter === item.key ? 'bg-teal-500' : item.highlight ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-700'
                )}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Filter */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Channels</h3>
        <div className="space-y-1">
          <button
            onClick={() => { onChannelFilterChange('all'); onItemClick?.(); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              channelFilter === 'all'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            <Filter className="w-4 h-4" />
            All Channels
          </button>
          {(['email', 'sms', 'whatsapp', 'phone', 'chat'] as InboxChannel[]).map((channel) => (
            <button
              key={channel}
              onClick={() => { onChannelFilterChange(channel); onItemClick?.(); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                channelFilter === channel
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              {CHANNEL_ICONS[channel]}
              {channel}
            </button>
          ))}
        </div>
      </div>
    </>
  );
});

export const InboxFilters = React.memo(function InboxFilters(props: InboxFiltersProps) {
  const { isMobileOpen, onMobileClose } = props;

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-56 flex-shrink-0 space-y-6 overflow-y-auto">
        <FilterItems {...props} />
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filters</h2>
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
