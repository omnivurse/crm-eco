'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import {
  Mail,
  Plus,
  Loader2,
  RefreshCw,
  Menu,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import type {
  InboxConversation,
  InboxMessage,
  InboxStats,
  InboxChannel,
  ConversationStatus,
} from '@/lib/inbox/types';

import { InboxFilters } from './_components/InboxFilters';
import { ConversationList } from './_components/ConversationList';
import { MessageThread } from './_components/MessageThread';
import { ReplyForm } from './_components/ReplyForm';
import { ComposeModal } from './_components/ComposeModal';

type FilterType = 'all' | 'unread' | 'assigned_to_me' | 'unassigned';

export default function InboxPage() {
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

  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 300 });
  const [loadingMessages, setLoadingMessages] = useState(false);

  const currentUserId = authProfile?.id || null;

  // Mobile responsive state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!authProfile) return;

    try {
      const profile = authProfile;

      let query = supabase
        .from('inbox_conversations')
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('last_message_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.in('status', ['open', 'pending']);
      } else {
        query = query.eq('status', statusFilter);
      }

      if (channelFilter !== 'all') {
        query = query.eq('channel', channelFilter);
      }

      if (filter === 'assigned_to_me') {
        query = query.eq('assigned_to', profile.id);
      } else if (filter === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (filter === 'unread') {
        query = query.gt('unread_count', 0);
      }

      if (debouncedQuery) {
        query = query.or(
          `subject.ilike.%${debouncedQuery}%,preview.ilike.%${debouncedQuery}%,contact_name.ilike.%${debouncedQuery}%,contact_email.ilike.%${debouncedQuery}%`
        );
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error loading conversations:', error);
        if (error.code === '42P01') {
          setConversations([]);
          return;
        }
        throw error;
      }

      setConversations(data || []);

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
        .order('sent_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Select conversation
  const handleSelectConversation = useCallback(async (conv: InboxConversation) => {
    setSelectedConversation(conv);
    setMobileView('detail');
    await loadMessages(conv.id);

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
  }, [loadMessages, currentUserId]);

  // Handle back to list on mobile
  const handleBackToList = useCallback(() => {
    setMobileView('list');
    setSelectedConversation(null);
  }, []);

  // Update conversation status
  const updateStatus = useCallback(async (conversationId: string, status: ConversationStatus) => {
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

      setSelectedConversation(prev =>
        prev?.id === conversationId ? { ...prev, status } : prev
      );

      toast.success(`Marked as ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  }, []);

  // Callback for ReplyForm after sending
  const handleReplySent = useCallback((conversationId: string) => {
    loadMessages(conversationId);
  }, [loadMessages]);

  // Filter change handlers
  const handleFilterChange = useCallback((f: FilterType) => {
    setFilter(f);
  }, []);

  const handleChannelFilterChange = useCallback((c: InboxChannel | 'all') => {
    setChannelFilter(c);
  }, []);

  const handleMobileFiltersClose = useCallback(() => {
    setShowMobileSidebar(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
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

      {/* Main Content */}
      <div className="flex-1 flex gap-4 lg:gap-6 min-h-0 overflow-hidden">
        {/* Filters Sidebar */}
        <InboxFilters
          filter={filter}
          onFilterChange={handleFilterChange}
          channelFilter={channelFilter}
          onChannelFilterChange={handleChannelFilterChange}
          stats={stats}
          conversationCount={conversations.length}
          isMobileOpen={showMobileSidebar}
          onMobileClose={handleMobileFiltersClose}
        />

        {/* Conversation List */}
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversation?.id || null}
          onSelectConversation={handleSelectConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          mobileView={mobileView}
        />

        {/* Conversation Detail */}
        <div className={cn(
          "flex-1 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col",
          mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        )}>
          {selectedConversation ? (
            <>
              <MessageThread
                conversation={selectedConversation}
                messages={messages}
                loadingMessages={loadingMessages}
                onStatusChange={updateStatus}
                onBackToList={handleBackToList}
              />
              <ReplyForm
                selectedConversation={selectedConversation}
                authProfile={authProfile!}
                authUserEmail={authUser?.email || ''}
                onReplySent={handleReplySent}
              />
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

      {/* Compose Modal */}
      {authProfile && authUser && (
        <ComposeModal
          open={showComposeModal}
          onOpenChange={setShowComposeModal}
          authProfile={authProfile}
          authUserEmail={authUser.email || ''}
          onMessageSent={loadConversations}
        />
      )}
    </div>
  );
}
