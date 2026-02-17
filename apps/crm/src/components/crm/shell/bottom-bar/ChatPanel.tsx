'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Search,
  Loader2,
  ExternalLink,
  Mail,
  Phone,
  MessageSquare,
  Video,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

interface Conversation {
  id: string;
  channel: string;
  subject: string | null;
  preview: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  priority: string | null;
  unread_count: number;
  last_message_at: string | null;
  message_count: number;
  assigned_to: string | null;
}

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  phone: <Phone className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  chat: <MessageCircle className="w-3.5 h-3.5" />,
};

const channelColors: Record<string, string> = {
  email: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  sms: 'text-green-500 bg-green-50 dark:bg-green-500/10',
  whatsapp: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  phone: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
  video: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  chat: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10',
};

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/inbox?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchConversations();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchConversations, search]);

  const formatTime = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diff < 1) return 'now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="flex flex-col max-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-teal-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Chats</h3>
          {totalUnread > 0 && (
            <span className="text-[10px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">
              {totalUnread}
            </span>
          )}
        </div>
        <button
          onClick={() => { router.push('/crm/inbox'); onClose(); }}
          className="flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors"
        >
          Open Inbox
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full text-xs pl-7 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {search ? 'No conversations found' : 'No recent conversations'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { router.push(`/crm/inbox?id=${conv.id}`); onClose(); }}
                className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                {/* Channel Icon */}
                <span className={cn('flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0', channelColors[conv.channel] || 'text-slate-500 bg-slate-100')}>
                  {channelIcons[conv.channel] || <MessageCircle className="w-3.5 h-3.5" />}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                      'text-xs truncate',
                      conv.unread_count > 0 ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                    )}>
                      {conv.contact_name || conv.contact_email || conv.subject || 'Unknown'}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0" suppressHydrationWarning>
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {conv.subject || conv.preview || 'No subject'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
                      {conv.channel}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
