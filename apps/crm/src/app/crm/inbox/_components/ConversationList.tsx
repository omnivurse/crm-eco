'use client';

import React, { useState, useCallback } from 'react';
import {
  Search,
  Inbox as InboxIcon,
  Star,
  Archive,
  Tag,
  Trash2,
  CheckSquare,
  Square,
  Paperclip,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Avatar, AvatarFallback } from '@crm-eco/ui/components/avatar';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { toastCopy, type CountNoun } from '@/lib/crm/toast-copy';
import type { InboxConversation, InboxChannel, ConversationStatus } from '@/lib/inbox/types';

const CONVERSATION_NOUN: CountNoun = { one: 'conversation', other: 'conversations' };

const CHANNEL_ICONS: Record<InboxChannel, React.ReactNode> = {
  email: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">✉</span>,
  sms: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">💬</span>,
  whatsapp: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">📱</span>,
  phone: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">📞</span>,
  video: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">🎥</span>,
  chat: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">💭</span>,
  social: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">🔗</span>,
  support: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">❓</span>,
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
  trash: 'bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-300',
  spam: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

function conversationLooksUnread(conv: InboxConversation): boolean {
  return conv.is_unread_for_user === true;
}

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
  onBulkAction?: () => void;
  /** Desktop: narrower list so the reading pane can take the leftover width. */
  readingMode?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const ConversationList = React.memo(function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  mobileView,
  onBulkAction,
  readingMode = false,
  emptyTitle = 'No conversations',
  emptyDescription = 'Conversations will appear here when you receive messages',
}: ConversationListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) setBulkMode(false);
      return next;
    });
    if (!bulkMode) setBulkMode(true);
  }, [bulkMode]);

  const toggleStar = useCallback(async (conv: InboxConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTags = conv.tags || [];
    const isStarred = currentTags.includes('starred');
    const newTags = isStarred
      ? currentTags.filter(t => t !== 'starred')
      : [...currentTags, 'starred'];

    await supabase
      .from('inbox_conversations')
      .update({ tags: newTags })
      .eq('id', conv.id);

    // Optimistically update in-place
    conv.tags = newTags;
    toast.success(isStarred ? 'Unstarred' : 'Starred');
  }, []);

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    await supabase
      .from('inbox_conversations')
      .update({ status: 'archived' })
      .in('id', ids);

    setSelectedIds(new Set());
    setBulkMode(false);
    toast.success(toastCopy.bulkTitle('Archived', ids.length, CONVERSATION_NOUN));
    onBulkAction?.();
  }, [selectedIds, onBulkAction]);

  const handleBulkTrash = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    await supabase
      .from('inbox_conversations')
      .update({ status: 'trash' })
      .in('id', ids);

    setSelectedIds(new Set());
    setBulkMode(false);
    toast.success(toastCopy.movedToTrash(ids.length, CONVERSATION_NOUN));
    onBulkAction?.();
  }, [selectedIds, onBulkAction]);

  const selectAll = useCallback(() => {
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
      setBulkMode(false);
    } else {
      setSelectedIds(new Set(conversations.map(c => c.id)));
    }
  }, [selectedIds, conversations]);

  return (
    <div className={cn(
      'flex min-h-0 flex-1 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-[#f7f8fa] dark:border-white/10 dark:bg-[#0a1118] lg:flex-none',
      readingMode ? 'lg:w-80' : 'lg:w-[22rem] xl:w-96',
      mobileView === 'detail' ? 'hidden lg:flex' : 'flex'
    )}>
      {/* Search + bulk actions bar */}
      <div className="border-b border-slate-200/80 p-2.5 dark:border-white/10">
        {bulkMode ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                title={selectedIds.size === conversations.length ? 'Deselect all' : 'Select all'}
              >
                {selectedIds.size === conversations.length ? (
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {selectedIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleBulkArchive}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-700"
                title="Archive selected"
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                onClick={handleBulkTrash}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-red-600"
                title="Move selected to trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setSelectedIds(new Set()); setBulkMode(false); }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-700"
                title="Cancel"
              >
                <span className="text-xs font-medium">Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-md border border-slate-200/80 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0d1620] dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
            <InboxIcon className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">{emptyTitle}</p>
            <p className="text-xs text-center mt-1">
              {emptyDescription}
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isStarred = (conv.tags || []).includes('starred');
            const isSelected = selectedIds.has(conv.id);
            const hasAttachments = conv.metadata && (conv.metadata as Record<string, unknown>).has_attachments;

            return (
              <div
                key={conv.id}
                className={cn(
                  'group relative border-b border-slate-200/60 transition-colors duration-150 dark:border-white/5',
                  selectedConversationId === conv.id
                    ? 'bg-white before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-teal-500 dark:bg-[#101820]'
                    : 'hover:bg-white/80 dark:hover:bg-white/[0.04]',
                  conversationLooksUnread(conv) && selectedConversationId !== conv.id && 'bg-teal-50/40 dark:bg-teal-500/[0.06]',
                  isSelected && 'bg-teal-50/80 dark:bg-teal-900/30'
                )}
              >
                {/* The row's click target is an overlay rather than a wrapper so
                    the star and bulk checkbox stay real buttons — a <button>
                    inside a <button> is invalid and breaks hydration. */}
                <button
                  type="button"
                  onClick={() => !bulkMode ? onSelectConversation(conv) : toggleSelect(conv.id, { stopPropagation: () => {} } as React.MouseEvent)}
                  aria-current={selectedConversationId === conv.id ? 'true' : undefined}
                  className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                >
                  <span className="sr-only">
                    {conv.contact_name || conv.contact_email || conv.contact_phone || 'Unknown'}
                    {conv.subject ? ` — ${conv.subject}` : ''}
                  </span>
                </button>
                <div className="pointer-events-none relative z-10 flex items-start gap-3 px-3 py-2.5 text-left">
                  {/* Checkbox / Avatar */}
                  <div className="relative flex-shrink-0">
                    {bulkMode ? (
                      <button
                        type="button"
                        onClick={(e) => toggleSelect(conv.id, e)}
                        aria-label={isSelected ? 'Deselect conversation' : 'Select conversation'}
                        className="pointer-events-auto w-10 h-10 flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    ) : (
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className={cn('text-xs font-medium', CHANNEL_COLORS[conv.channel])}>
                          {getInitials(conv.contact_name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'text-sm truncate',
                        conversationLooksUnread(conv) ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                      )}>
                        {conv.contact_name || conv.contact_email || conv.contact_phone || 'Unknown'}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-slate-500">{formatTime(conv.last_message_at)}</span>
                      </div>
                    </div>
                    <p className={cn(
                      'text-sm truncate',
                      conversationLooksUnread(conv) ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'
                    )}>
                      {conv.subject || 'No subject'}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{conv.preview || 'No preview'}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={cn('p-0.5 rounded', CHANNEL_COLORS[conv.channel])}>
                        {CHANNEL_ICONS[conv.channel]}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[conv.status])}>
                        {conv.status}
                      </span>
                      {conversationLooksUnread(conv) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500 text-white font-medium">
                          New
                        </span>
                      )}
                      {/* Star toggle */}
                      <button
                        type="button"
                        onClick={(e) => toggleStar(conv, e)}
                        aria-label={isStarred ? 'Remove star' : 'Star conversation'}
                        aria-pressed={isStarred}
                        className={cn(
                          'pointer-events-auto ml-auto p-0.5 rounded transition-colors',
                          isStarred
                            ? 'text-amber-500'
                            : 'text-slate-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-amber-400'
                        )}
                      >
                        <Star className={cn('w-3.5 h-3.5', isStarred && 'fill-current')} />
                      </button>
                    </div>
                    {/* Labels */}
                    {conv.labels && conv.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {conv.labels.map((label, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${label.color}20`,
                              color: label.color,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
