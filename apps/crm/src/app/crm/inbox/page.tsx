'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import Link from 'next/link';
import {
  Mail,
  MessageSquare,
  Phone,
  MessageCircle,
  Video,
  HelpCircle,
  Share2,
  MessagesSquare,
  Search,
  Star,
  StarOff,
  Inbox as InboxIcon,
  Filter,
  Plus,
  MoreVertical,
  Trash2,
  Archive,
  Reply,
  Forward,
  Clock,
  Check,
  CheckCheck,
  Loader2,
  X,
  Send,
  Paperclip,
  User,
  RefreshCw,
  UserPlus,
  Tag,
  AlertCircle,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@crm-eco/ui/components/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import type {
  InboxConversation,
  InboxMessage,
  InboxStats,
  InboxChannel,
  ConversationStatus,
  ConversationPriority,
} from '@/lib/inbox/types';

// Channel icons mapping
const CHANNEL_ICONS: Record<InboxChannel, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  sms: <MessageSquare className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  chat: <MessagesSquare className="w-4 h-4" />,
  social: <Share2 className="w-4 h-4" />,
  support: <HelpCircle className="w-4 h-4" />,
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

type FilterType = 'all' | 'unread' | 'assigned_to_me' | 'unassigned';

export default function InboxPage() {
  // Use cached client auth - deduplicates auth calls
  const { user: authUser, profile: authProfile, loading: authLoading } = useClientAuth();
  
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<InboxConversation | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [channelFilter, setChannelFilter] = useState<InboxChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'active'>('active');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Live search with debounce (300ms for API calls)
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 300 });
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Compose form state
  const [composeChannel, setComposeChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  // Use profile ID from cached auth
  const currentUserId = authProfile?.id || null;
  
  // Mobile responsive state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Load conversations - uses cached auth profile
  const loadConversations = useCallback(async () => {
    if (!authProfile) return;
    
    try {
      const profile = authProfile;

      // Build query
      let query = supabase
        .from('inbox_conversations')
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('last_message_at', { ascending: false });

      // Apply status filter
      if (statusFilter === 'active') {
        query = query.in('status', ['open', 'pending']);
      } else {
        query = query.eq('status', statusFilter);
      }

      // Apply channel filter
      if (channelFilter !== 'all') {
        query = query.eq('channel', channelFilter);
      }

      // Apply assignment filter
      if (filter === 'assigned_to_me') {
        query = query.eq('assigned_to', profile.id);
      } else if (filter === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (filter === 'unread') {
        query = query.gt('unread_count', 0);
      }

      // Apply search (uses debounced query to prevent API spam)
      if (debouncedQuery) {
        query = query.or(
          `subject.ilike.%${debouncedQuery}%,preview.ilike.%${debouncedQuery}%,contact_name.ilike.%${debouncedQuery}%,contact_email.ilike.%${debouncedQuery}%`
        );
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error loading conversations:', error);
        // If table doesn't exist yet, show empty state
        if (error.code === '42P01') {
          setConversations([]);
          return;
        }
        throw error;
      }

      setConversations(data || []);

      // Load stats using count queries (optimized - avoids fetching all records)
      const [openCount, pendingCount, unreadCount, assignedCount, unassignedCount] = await Promise.all([
        supabase
          .from('inbox_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .eq('status', 'open'),
        supabase
          .from('inbox_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .eq('status', 'pending'),
        supabase
          .from('inbox_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .in('status', ['open', 'pending'])
          .gt('unread_count', 0),
        supabase
          .from('inbox_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .eq('assigned_to', profile.id),
        supabase
          .from('inbox_conversations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .in('status', ['open', 'pending'])
          .is('assigned_to', null),
      ]);

      setStats({
        total_open: openCount.count || 0,
        total_pending: pendingCount.count || 0,
        total_unread: unreadCount.count || 0,
        assigned_to_me: assignedCount.count || 0,
        unassigned: unassignedCount.count || 0,
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [authProfile, filter, channelFilter, statusFilter, debouncedQuery]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [supabase]);

  // Select conversation
  const handleSelectConversation = async (conv: InboxConversation) => {
    setSelectedConversation(conv);
    setMobileView('detail'); // Switch to detail view on mobile
    await loadMessages(conv.id);

    // Mark as read
    if (conv.unread_count > 0) {
      await supabase
        .from('inbox_conversations')
        .update({
          unread_count: 0,
          last_read_at: new Date().toISOString(),
          last_read_by: currentUserId,
        })
        .eq('id', conv.id);

      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    }
  };

  // Handle back to list on mobile
  const handleBackToList = () => {
    setMobileView('list');
    setSelectedConversation(null);
  };

  // Send reply - uses cached auth profile and user
  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim() || !authProfile || !authUser) return;

    setSending(true);
    try {
      // Use email from cached auth user
      const userEmail = authUser.email || '';

      // Create message using cached profile
      const { error } = await supabase.from('inbox_messages').insert({
        org_id: authProfile.organization_id,
        conversation_id: selectedConversation.id,
        channel: selectedConversation.channel,
        direction: 'outbound',
        from_name: authProfile.full_name || userEmail,
        from_address: userEmail,
        to_address: selectedConversation.contact_email || selectedConversation.contact_phone,
        to_name: selectedConversation.contact_name,
        body_text: replyText,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Reply sent');
      setReplyText('');
      await loadMessages(selectedConversation.id);
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  // Reset compose form
  const resetComposeForm = () => {
    setComposeChannel('email');
    setComposeTo('');
    setComposeSubject('');
    setComposeMessage('');
  };

  // Send new composed message
  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeMessage.trim()) {
      toast.error('To and Message are required');
      return;
    }
    if (composeChannel === 'email' && !composeSubject.trim()) {
      toast.error('Subject is required for email');
      return;
    }
    if (!authProfile || !authUser) {
      toast.error('You must be logged in to send messages');
      return;
    }

    setComposeSending(true);
    try {
      // Build request body based on channel
      const payload: Record<string, string | undefined> = {
        channel: composeChannel,
        to: composeTo.trim(),
        from_name: authProfile.full_name || authUser.email || undefined,
      };

      if (composeChannel === 'email') {
        payload.subject = composeSubject.trim();
        payload.body_text = composeMessage.trim();
      } else {
        payload.body = composeMessage.trim();
      }

      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Create inbox conversation + message records so it appears in the list
      const now = new Date().toISOString();
      const { data: conv, error: convError } = await supabase
        .from('inbox_conversations')
        .insert({
          org_id: authProfile.organization_id,
          channel: composeChannel,
          thread_id: data.message_id || crypto.randomUUID(),
          subject: composeSubject.trim() || null,
          preview: composeMessage.trim().slice(0, 200),
          contact_email: composeChannel === 'email' ? composeTo.trim() : null,
          contact_phone: composeChannel !== 'email' ? composeTo.trim() : null,
          contact_name: null,
          status: 'open' as ConversationStatus,
          priority: 'normal' as ConversationPriority,
          assigned_to: authProfile.id,
          assigned_at: now,
          unread_count: 0,
          message_count: 1,
          last_message_at: now,
          first_message_at: now,
          tags: [],
          labels: [],
          metadata: {},
        })
        .select()
        .single();

      if (convError) {
        console.error('Failed to create conversation record:', convError);
      } else if (conv) {
        // Insert the outbound message
        await supabase.from('inbox_messages').insert({
          org_id: authProfile.organization_id,
          conversation_id: conv.id,
          channel: composeChannel,
          direction: 'outbound',
          from_name: authProfile.full_name || authUser.email,
          from_address: authUser.email,
          to_address: composeTo.trim(),
          subject: composeSubject.trim() || null,
          body_text: composeMessage.trim(),
          status: 'sent',
          sent_at: now,
          external_id: data.message_id || null,
          external_provider: data.provider || null,
          metadata: {},
        });
      }

      toast.success('Message sent');
      setShowComposeModal(false);
      resetComposeForm();
      await loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  // Update conversation status
  const updateStatus = async (conversationId: string, status: ConversationStatus) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      await supabase
        .from('inbox_conversations')
        .update(updates)
        .eq('id', conversationId);

      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, status } : c)
      );

      if (selectedConversation?.id === conversationId) {
        setSelectedConversation({ ...selectedConversation, status });
      }

      toast.success(`Marked as ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Format timestamp
  const formatTime = (dateStr: string) => {
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
  };

  // Get initials
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header - Responsive */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Inbox</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              {stats ? `${stats.total_unread} unread, ${stats.total_open + stats.total_pending} active` : 'Unified communications inbox'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <button
            onClick={loadConversations}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-slate-500" />
          </button>
          <button
            onClick={() => setShowComposeModal(true)}
            className="inline-flex items-center gap-2 px-3 lg:px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors text-sm lg:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Compose</span>
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filters</h2>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {/* Status Filters */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Inbox</h3>
              <div className="space-y-1">
                {[
                  { key: 'all' as FilterType, label: 'All Messages', icon: <InboxIcon className="w-4 h-4" />, count: conversations.length },
                  { key: 'unread' as FilterType, label: 'Unread', icon: <Mail className="w-4 h-4" />, count: stats?.total_unread || 0, highlight: true },
                  { key: 'assigned_to_me' as FilterType, label: 'Assigned to Me', icon: <User className="w-4 h-4" />, count: stats?.assigned_to_me || 0 },
                  { key: 'unassigned' as FilterType, label: 'Unassigned', icon: <UserPlus className="w-4 h-4" />, count: stats?.unassigned || 0 },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setFilter(item.key);
                      setShowMobileSidebar(false);
                    }}
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
                  onClick={() => {
                    setChannelFilter('all');
                    setShowMobileSidebar(false);
                  }}
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
                    onClick={() => {
                      setChannelFilter(channel);
                      setShowMobileSidebar(false);
                    }}
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
          </div>
        </div>
      )}

      {/* Main Content - Responsive */}
      <div className="flex-1 flex gap-4 lg:gap-6 min-h-0 overflow-hidden">
        {/* Filters Sidebar - Desktop only */}
        <div className="hidden lg:block w-56 flex-shrink-0 space-y-6 overflow-y-auto">
          {/* Status Filters */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Inbox</h3>
            <div className="space-y-1">
              {[
                { key: 'all' as FilterType, label: 'All Messages', icon: <InboxIcon className="w-4 h-4" />, count: conversations.length },
                { key: 'unread' as FilterType, label: 'Unread', icon: <Mail className="w-4 h-4" />, count: stats?.total_unread || 0, highlight: true },
                { key: 'assigned_to_me' as FilterType, label: 'Assigned to Me', icon: <User className="w-4 h-4" />, count: stats?.assigned_to_me || 0 },
                { key: 'unassigned' as FilterType, label: 'Unassigned', icon: <UserPlus className="w-4 h-4" />, count: stats?.unassigned || 0 },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
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
                onClick={() => setChannelFilter('all')}
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
                  onClick={() => setChannelFilter(channel)}
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
        </div>

        {/* Conversation List - Responsive */}
        <div className={cn(
          "flex-1 lg:flex-none lg:w-80 xl:w-96 flex-shrink-0 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col",
          // On mobile, hide list when viewing detail
          mobileView === 'detail' ? 'hidden lg:flex' : 'flex'
        )}>
          {/* Search */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                  onClick={() => handleSelectConversation(conv)}
                  className={cn(
                    'w-full text-left p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                    selectedConversation?.id === conv.id && 'bg-teal-50 dark:bg-teal-900/20',
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

        {/* Conversation Detail - Responsive */}
        <div className={cn(
          "flex-1 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col",
          // On mobile, hide detail when viewing list (unless a conversation is selected)
          mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        )}>
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-3 lg:p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                    {/* Mobile back button */}
                    <button
                      onClick={handleBackToList}
                      className="lg:hidden p-2 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                    <Avatar className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0">
                      <AvatarFallback className={cn('text-xs lg:text-sm font-medium', CHANNEL_COLORS[selectedConversation.channel])}>
                        {getInitials(selectedConversation.contact_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate text-sm lg:text-base">
                        {selectedConversation.contact_name || 'Unknown Contact'}
                      </h3>
                      <p className="text-xs lg:text-sm text-slate-500 truncate">
                        {selectedConversation.contact_email || selectedConversation.contact_phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
                    <Select
                      value={selectedConversation.status}
                      onValueChange={(value) => updateStatus(selectedConversation.id, value as ConversationStatus)}
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
                  <span className={cn('p-1 lg:p-1.5 rounded flex-shrink-0', CHANNEL_COLORS[selectedConversation.channel])}>
                    {CHANNEL_ICONS[selectedConversation.channel]}
                  </span>
                  <h2 className="font-medium text-slate-900 dark:text-white text-sm lg:text-base truncate">
                    {selectedConversation.subject || 'No subject'}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:gap-4 mt-1 lg:mt-2 text-xs lg:text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 lg:w-3.5 h-3 lg:h-3.5" />
                    Started {formatTime(selectedConversation.first_message_at)}
                  </span>
                  <span>{selectedConversation.message_count} messages</span>
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

              {/* Reply Input */}
              <div className="p-3 lg:p-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex gap-2 lg:gap-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={2}
                    className="flex-1 px-3 lg:px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className="px-3 lg:px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors self-end"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-4">
              <Mail className="w-12 lg:w-16 h-12 lg:h-16 mb-4 opacity-30" />
              <p className="text-base lg:text-lg font-medium text-center">No conversation selected</p>
              <p className="text-sm text-center">Select a conversation to view messages</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal - Responsive */}
      <Dialog open={showComposeModal} onOpenChange={(open) => { setShowComposeModal(open); if (!open) resetComposeForm(); }}>
        <DialogContent className="w-[95vw] max-w-xl mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 lg:space-y-4 pt-3 lg:pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Channel</label>
              <Select value={composeChannel} onValueChange={(v) => setComposeChannel(v as 'email' | 'sms' | 'whatsapp')}>
                <SelectTrigger className="text-sm lg:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
              <input
                type="text"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="Search contacts or enter email/phone"
                className="w-full px-3 lg:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Enter subject"
                className="w-full px-3 lg:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
              <textarea
                rows={4}
                value={composeMessage}
                onChange={(e) => setComposeMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full px-3 lg:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 lg:pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => toast.info('File attachments coming soon')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex gap-2 lg:gap-3">
                <button
                  onClick={() => setShowComposeModal(false)}
                  className="px-3 lg:px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleComposeSend}
                  disabled={composeSending || !composeTo.trim() || !composeMessage.trim()}
                  className="inline-flex items-center gap-2 px-3 lg:px-4 py-2 text-sm bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {composeSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{composeSending ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
