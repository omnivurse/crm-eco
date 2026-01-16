'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Send,
  Paperclip,
  User,
  Clock,
  CheckCircle2,
  Archive,
  Tag,
  MoreVertical,
  Mail,
  MessageSquare,
  Phone,
  Video,
  LinkIcon,
  UserPlus,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import type {
  InboxConversation,
  InboxMessage,
  InboxChannel,
} from '@/lib/inbox/types';
import {
  CHANNEL_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from '@/lib/inbox/types';

// ============================================================================
// Types
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function getChannelIcon(channel: InboxChannel, size: string = 'w-4 h-4') {
  const iconMap: Record<InboxChannel, React.ReactNode> = {
    email: <Mail className={size} />,
    sms: <MessageSquare className={size} />,
    whatsapp: <MessageSquare className={size} />,
    phone: <Phone className={size} />,
    video: <Video className={size} />,
    chat: <MessageSquare className={size} />,
    social: <User className={size} />,
    support: <FileText className={size} />,
  };
  return iconMap[channel] || <Mail className={size} />;
}

// ============================================================================
// Components
// ============================================================================

function MessageBubble({ message, isOwn }: { message: InboxMessage; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isOwn
              ? 'bg-teal-600 text-white rounded-br-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md'
          }`}
        >
          {message.subject && (
            <div className={`text-sm font-medium mb-1 ${isOwn ? 'text-teal-100' : 'text-slate-700 dark:text-slate-300'}`}>
              {message.subject}
            </div>
          )}
          <div className="whitespace-pre-wrap text-sm">
            {message.body_text || message.body_html?.replace(/<[^>]*>/g, '') || 'No content'}
          </div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/20 dark:border-slate-700">
              {message.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Paperclip className="w-3 h-3" />
                  <span>{att.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 mt-1 text-xs ${isOwn ? 'justify-end' : 'justify-start'} text-slate-500 dark:text-slate-400`}>
          {isOwn ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
          <span>{formatTime(message.sent_at)}</span>
          {message.status === 'read' && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{date}</span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function QuickActionsPanel({
  conversation,
  onAction,
}: {
  conversation: InboxConversation;
  onAction: (action: string, data?: Record<string, unknown>) => void;
}) {
  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Quick Actions
      </h4>
      <div className="flex flex-wrap gap-2">
        {!conversation.contact_id && (
          <button
            onClick={() => onAction('convert_lead')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-300"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Lead
          </button>
        )}
        <button
          onClick={() => onAction('create_task')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-300"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Create Task
        </button>
        <button
          onClick={() => onAction('add_note')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-300"
        >
          <FileText className="w-3.5 h-3.5" />
          Add Note
        </button>
        {conversation.linked_deal_id && (
          <button
            onClick={() => onAction('view_deal')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-300"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            View Deal
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const [conversation, setConversation] = useState<InboxConversation | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  const fetchConversation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inbox/${conversationId}?include_messages=true`);
      const data = await response.json();
      
      setConversation(data.conversation);
      setMessages(data.messages || []);
      
      // Mark as read
      if (data.conversation?.unread_count > 0) {
        await fetch(`/api/inbox/${conversationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read' }),
        });
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/inbox/team');
      const data = await response.json();
      setTeamMembers(data.members || []);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    }
  }, []);

  useEffect(() => {
    fetchConversation();
    fetchTeamMembers();
  }, [fetchConversation, fetchTeamMembers]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !conversation) return;
    
    setSending(true);
    try {
      await fetch(`/api/inbox/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'outbound',
          body_text: replyText,
        }),
      });
      setReplyText('');
      fetchConversation();
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setSending(false);
    }
  };

  const handleAssign = async (userId: string | null) => {
    try {
      await fetch(`/api/inbox/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assigned_to: userId }),
      });
      setShowAssign(false);
      fetchConversation();
    } catch (error) {
      console.error('Failed to assign:', error);
    }
  };

  const handleStatusChange = async (action: string) => {
    try {
      await fetch(`/api/inbox/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchConversation();
    } catch (error) {
      console.error('Failed to change status:', error);
    }
  };

  const handleQuickAction = (action: string) => {
    // TODO: Implement quick actions
    console.log('Quick action:', action);
    alert(`Quick action "${action}" would be executed here`);
  };

  // Group messages by date
  const messagesByDate: Record<string, InboxMessage[]> = {};
  messages.forEach((msg) => {
    const date = formatDate(msg.sent_at);
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(msg);
  });

  if (loading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400">Conversation not found</p>
          <Link href="/crm/inbox" className="text-teal-600 hover:underline mt-2 inline-block">
            Back to Inbox
          </Link>
        </div>
      </div>
    );
  }

  const channelConfig = CHANNEL_CONFIG[conversation.channel];
  const statusConfig = STATUS_CONFIG[conversation.status];

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/inbox"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className={`p-2.5 rounded-lg bg-${channelConfig.color}-500/10`}>
            <div className={`text-${channelConfig.color}-600 dark:text-${channelConfig.color}-400`}>
              {getChannelIcon(conversation.channel, 'w-5 h-5')}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-slate-900 dark:text-white">
                {conversation.contact_name || conversation.contact_email || conversation.contact_phone || 'Unknown'}
              </h1>
              <span className={`px-2 py-0.5 text-xs rounded bg-${statusConfig.color}-100 dark:bg-${statusConfig.color}-500/20 text-${statusConfig.color}-700 dark:text-${statusConfig.color}-400`}>
                {statusConfig.name}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {conversation.subject || `${channelConfig.name} conversation`}
              {conversation.contact_email && ` • ${conversation.contact_email}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Assignment */}
          <div className="relative">
            <button
              onClick={() => setShowAssign(!showAssign)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <User className="w-4 h-4" />
              {conversation.assigned_to ? 'Reassign' : 'Assign'}
            </button>
            {showAssign && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Unassigned
                </button>
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAssign(member.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Status Actions */}
          {conversation.status !== 'resolved' && (
            <button
              onClick={() => handleStatusChange('resolve')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Resolve
            </button>
          )}
          {conversation.status === 'resolved' && (
            <button
              onClick={() => handleStatusChange('reopen')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Reopen
            </button>
          )}
          <button
            onClick={() => handleStatusChange('archive')}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Archive"
          >
            <Archive className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(messagesByDate).map(([date, msgs]) => (
          <div key={date}>
            <DateDivider date={date} />
            {msgs.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.direction === 'outbound'}
              />
            ))}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No messages in this conversation yet</p>
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <QuickActionsPanel conversation={conversation} onAction={handleQuickAction} />
      
      {/* Reply Composer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-2">
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Paperclip className="w-5 h-5 text-slate-500" />
            </button>
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
              className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className={`w-5 h-5 ${sending ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
