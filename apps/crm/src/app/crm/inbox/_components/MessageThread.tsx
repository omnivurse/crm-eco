'use client';

import React from 'react';
import {
  MessageSquare,
  Clock,
  Check,
  CheckCheck,
  Loader2,
  ChevronLeft,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Avatar, AvatarFallback } from '@crm-eco/ui/components/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import type { InboxConversation, InboxMessage, InboxChannel, ConversationStatus } from '@/lib/inbox/types';

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

interface MessageThreadProps {
  conversation: InboxConversation;
  messages: InboxMessage[];
  loadingMessages: boolean;
  onStatusChange: (conversationId: string, status: ConversationStatus) => void;
  onBackToList: () => void;
}

export const MessageThread = React.memo(function MessageThread({
  conversation,
  messages,
  loadingMessages,
  onStatusChange,
  onBackToList,
}: MessageThreadProps) {
  return (
    <>
      {/* Header */}
      <div className="p-3 lg:p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            <button
              onClick={onBackToList}
              className="lg:hidden p-2 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <Avatar className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0">
              <AvatarFallback className={cn('text-xs lg:text-sm font-medium', CHANNEL_COLORS[conversation.channel])}>
                {getInitials(conversation.contact_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-white truncate text-sm lg:text-base">
                {conversation.contact_name || 'Unknown Contact'}
              </h3>
              <p className="text-xs lg:text-sm text-slate-500 truncate">
                {conversation.contact_email || conversation.contact_phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
            <Select
              value={conversation.status}
              onValueChange={(value) => onStatusChange(conversation.id, value as ConversationStatus)}
            >
              <SelectTrigger className="w-24 lg:w-32 text-xs lg:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => toast.info('More actions coming soon')}
              className="hidden sm:block p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="More actions"
            >
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Subject & Info */}
      <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className={cn('p-1 lg:p-1.5 rounded flex-shrink-0', CHANNEL_COLORS[conversation.channel])}>
            {CHANNEL_ICONS[conversation.channel]}
          </span>
          <h2 className="font-medium text-slate-900 dark:text-white text-sm lg:text-base truncate">
            {conversation.subject || 'No subject'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:gap-4 mt-1 lg:mt-2 text-xs lg:text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 lg:w-3.5 h-3 lg:h-3.5" />
            Started {formatTime(conversation.first_message_at)}
          </span>
          <span>{conversation.message_count} messages</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 lg:p-4 overflow-y-auto space-y-3 lg:space-y-4">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'max-w-[90%] lg:max-w-[80%] p-3 lg:p-4 rounded-xl text-sm lg:text-base',
                msg.direction === 'outbound'
                  ? 'ml-auto bg-teal-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium opacity-75">
                  {msg.direction === 'outbound' ? 'You' : msg.from_name || 'Contact'}
                </span>
                <span className="text-xs opacity-50">
                  {formatTime(msg.sent_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words">{msg.body_text || msg.body_html}</p>
              {msg.direction === 'outbound' && (
                <div className="flex items-center justify-end mt-1">
                  {msg.status === 'read' ? (
                    <CheckCheck className="w-4 h-4 opacity-75" />
                  ) : msg.status === 'delivered' ? (
                    <Check className="w-4 h-4 opacity-75" />
                  ) : (
                    <Clock className="w-4 h-4 opacity-75" />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
});
