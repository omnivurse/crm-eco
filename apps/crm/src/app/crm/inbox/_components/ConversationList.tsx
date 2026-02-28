'use client';

import React from 'react';
import { Search, Inbox as InboxIcon } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Avatar, AvatarFallback } from '@crm-eco/ui/components/avatar';
import type { InboxConversation, InboxChannel, ConversationStatus } from '@/lib/inbox/types';

const CHANNEL_ICONS: Record<InboxChannel, React.ReactNode> = {
  email: <span className="w-4 h-4 inline-flex items-center justify-center">✉</span>,
  sms: <span className="w-4 h-4 inline-flex items-center justify-center">💬</span>,
  whatsapp: <span className="w-4 h-4 inline-flex items-center justify-center">📱</span>,
  phone: <span className="w-4 h-4 inline-flex items-center justify-center">📞</span>,
  video: <span className="w-4 h-4 inline-flex items-center justify-center">🎥</span>,
  chat: <span className="w-4 h-4 inline-flex items-center justify-center">💭</span>,
  social: <span className="w-4 h-4 inline-flex items-center justify-center">🔗</span>,
  support: <span className="w-4 h-4 inline-flex items-center justify-center">❓</span>,
};

const CHANNEL_COLORS: Record<InboxChannel, string> = {
  email: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20',
  sms: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20',
  whatsapp: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/20',
  phone: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/20',
  video: 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-500/20',
  chat: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20',
  social: 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-500/20',
  support: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/20',
};

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  snoozed: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface ConversationListProps {
  conversations: InboxConversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conv: InboxConversation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  mobileView: 'list' | 'detail';
}

export const ConversationList = React.memo(function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  mobileView,
}: ConversationListProps) {
  return (
    <div className={cn(
      "flex-1 lg:flex-none lg:w-80 xl:w-96 flex-shrink-0 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col",
      mobileView === 'detail' ? 'hidden lg:flex' : 'flex'
    )}>
      {/* Search */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
            <InboxIcon className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No conversations</p>
            <p className="text-xs text-center mt-1">
              Conversations will appear here when you receive messages
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className={cn(
                'w-full text-left p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                selectedConversationId === conv.id && 'bg-teal-50 dark:bg-teal-900/20',
                conv.unread_count > 0 && 'bg-blue-50/50 dark:bg-blue-900/10'
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className={cn('text-xs font-medium', CHANNEL_COLORS[conv.channel])}>
                    {getInitials(conv.contact_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'text-sm truncate',
                      conv.unread_count > 0 ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                    )}>
                      {conv.contact_name || conv.contact_email || conv.contact_phone || 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-500 flex-shrink-0">{formatTime(conv.last_message_at)}</span>
                  </div>
                  <p className={cn(
                    'text-sm truncate',
                    conv.unread_count > 0 ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'
                  )}>
                    {conv.subject || 'No subject'}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{conv.preview || 'No preview'}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn('p-1 rounded', CHANNEL_COLORS[conv.channel])}>
                      {CHANNEL_ICONS[conv.channel]}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[conv.status])}>
                      {conv.status}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500 text-white">
                        {conv.unread_count} new
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
});
