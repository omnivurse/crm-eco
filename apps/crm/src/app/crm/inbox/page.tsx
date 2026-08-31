'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import {
  Mail,
  Plus,
  Loader2,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import type {
  InboxConversation,
  InboxDraft,
  InboxMessage,
  InboxStats,
  InboxChannel,
  ConversationStatus,
} from '@/lib/inbox/types';
import type { SharedMailbox } from '@/lib/inbox/shared-mailboxes';

import { InboxFilters, type FilterType } from './_components/InboxFilters';
import { ConversationList } from './_components/ConversationList';
import { DraftsList } from './_components/DraftsList';
import { MessageThread } from './_components/MessageThread';
import { ReplyForm } from './_components/ReplyForm';
import { ComposeModal } from './_components/ComposeModal';
import { NotificationSettings } from './_components/NotificationSettings';

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <InboxPageContent />
    </Suspense>
  );
}

function InboxPageContent() {
  const { user: authUser, profile: authProfile, loading: authLoading } = useClientAuth();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<InboxConversation | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [channelFilter, setChannelFilter] = useState<InboxChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'active'>('active');
  const [mailboxFilter, setMailboxFilter] = useState<string | 'all'>('all');
  const [mailboxes, setMailboxes] = useState<SharedMailbox[]>([]);
  const [verifiedDomains, setVerifiedDomains] = useState<string[]>([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(true);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeSessionId, setComposeSessionId] = useState(0);
  const [composeInitialSubject, setComposeInitialSubject] = useState<string | undefined>();
  const [composeInitialBody, setComposeInitialBody] = useState<string | undefined>();
  const [composeInitialTo, setComposeInitialTo] = useState<Array<{ email: string; name?: string }> | undefined>();
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<InboxDraft[]>([]);

  const openCompose = useCallback((opts?: {
    subject?: string;
    body?: string;
    to?: Array<{ email: string; name?: string }>;
    draftId?: string | null;
  }) => {
    setComposeSessionId((n) => n + 1);
    setComposeInitialSubject(opts?.subject);
    setComposeInitialBody(opts?.body);
    setComposeInitialTo(opts?.to);
    setComposeDraftId(opts?.draftId ?? null);
    setShowComposeModal(true);
  }, []);

  // Auto-open compose when ?compose=true
  useEffect(() => {
    if (searchParams?.get('compose') === 'true') {
      openCompose();
    }
  }, [searchParams, openCompose]);

  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 300 });
  const [loadingMessages, setLoadingMessages] = useState(false);

  const currentUserId = authProfile?.id || null;

  // Mobile responsive state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  /** Desktop: user pinned folders open while a thread is selected. */
  const [foldersOpenWhileReading, setFoldersOpenWhileReading] = useState(false);

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

      if (mailboxFilter !== 'all') {
        query = query.eq('mailbox_address', mailboxFilter);
      }

      if (filter === 'assigned_to_me') {
        query = query.eq('assigned_to', profile.id);
      } else if (filter === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (filter === 'unread') {
        query = query.gt('unread_count', 0);
      }

      let skipListQuery = filter === 'drafts';
      if (filter === 'sent') {
        const { data: outbound, error: outboundError } = await supabase
          .from('inbox_messages')
          .select('conversation_id')
          .eq('org_id', profile.organization_id)
          .eq('direction', 'outbound')
          .order('sent_at', { ascending: false })
          .limit(200);
        if (outboundError) throw outboundError;
        const sentIds = [
          ...new Set(
            (outbound ?? []).map((row: { conversation_id: string }) => row.conversation_id).filter(Boolean),
          ),
        ];
        if (sentIds.length === 0) {
          setConversations([]);
          skipListQuery = true;
        } else {
          query = query.in('id', sentIds);
        }
      }

      if (debouncedQuery && !skipListQuery) {
        query = query.or(
          `subject.ilike.%${debouncedQuery}%,preview.ilike.%${debouncedQuery}%,contact_name.ilike.%${debouncedQuery}%,contact_email.ilike.%${debouncedQuery}%`
        );
      }

      if (!skipListQuery) {
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
      } else if (filter === 'drafts') {
        setConversations([]);
      }

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
  }, [authProfile, filter, channelFilter, statusFilter, mailboxFilter, debouncedQuery]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadDrafts = useCallback(async () => {
    if (!authProfile) return;
    try {
      const res = await fetch('/api/inbox/drafts');
      if (!res.ok) throw new Error(`drafts request failed: ${res.status}`);
      const json = await res.json();
      setDrafts(json.drafts || []);
    } catch (error) {
      console.error('Failed to load drafts:', error);
      setDrafts([]);
    }
  }, [authProfile]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (!showComposeModal) loadDrafts();
  }, [showComposeModal, loadDrafts]);

  // Shared mailbox list + unread badges. Kept separate from loadConversations
  // so switching queues does not refetch the sidebar on every click.
  const loadMailboxes = useCallback(async () => {
    if (!authProfile) return;
    try {
      const res = await fetch('/api/inbox/mailboxes');
      if (!res.ok) throw new Error(`mailboxes request failed: ${res.status}`);
      const json = await res.json();
      setMailboxes(json.mailboxes || []);
      setVerifiedDomains(json.domains || []);
    } catch (error) {
      console.error('Failed to load shared mailboxes:', error);
      setMailboxes([]);
      setVerifiedDomains([]);
    } finally {
      setMailboxesLoading(false);
    }
  }, [authProfile]);

  useEffect(() => {
    loadMailboxes();
  }, [loadMailboxes]);

  // Realtime subscriptions for live inbox updates
  useEffect(() => {
    if (!authProfile) return;

    const convChannel = supabase
      .channel('inbox-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inbox_conversations',
          filter: `org_id=eq.${authProfile.organization_id}`,
        },
        () => {
          loadConversations();
          // Keep the per-mailbox unread badges honest as mail arrives or is read.
          loadMailboxes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, [authProfile, loadConversations, loadMailboxes]);

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

  // Realtime for messages in the selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const msgChannel = supabase
      .channel(`inbox-messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        () => {
          loadMessages(selectedConversation.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedConversation, loadMessages]);

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
    setFoldersOpenWhileReading(false);
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
    loadConversations();
  }, [loadMessages, loadConversations]);

  // Forward handler: open compose modal with forwarded content
  const handleForward = useCallback((subject: string, body: string) => {
    openCompose({ subject, body });
  }, [openCompose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas/editors
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[role="textbox"]') ||
        target.closest('.tiptap')
      ) {
        return;
      }

      switch (e.key) {
        case 'c': // Compose
          e.preventDefault();
          openCompose();
          break;
        case 'e': // Archive
          if (selectedConversation) {
            e.preventDefault();
            updateStatus(selectedConversation.id, 'archived');
          }
          break;
        case 'j': // Next conversation
          if (conversations.length > 0) {
            e.preventDefault();
            const currentIndex = selectedConversation
              ? conversations.findIndex(c => c.id === selectedConversation.id)
              : -1;
            const nextIndex = Math.min(currentIndex + 1, conversations.length - 1);
            handleSelectConversation(conversations[nextIndex]);
          }
          break;
        case 'k': // Previous conversation
          if (conversations.length > 0) {
            e.preventDefault();
            const currentIndex = selectedConversation
              ? conversations.findIndex(c => c.id === selectedConversation.id)
              : conversations.length;
            const prevIndex = Math.max(currentIndex - 1, 0);
            handleSelectConversation(conversations[prevIndex]);
          }
          break;
        case 'Escape': // Back to list
          if (selectedConversation) {
            handleBackToList();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConversation, conversations, handleSelectConversation, handleBackToList, updateStatus, openCompose]);

  // Filter change handlers
  const handleFilterChange = useCallback((f: FilterType) => {
    setFilter(f);
    if (f === 'sent' || f === 'drafts') {
      setSelectedConversation(null);
      setFoldersOpenWhileReading(false);
      setMobileView('list');
    }
  }, []);

  const handleChannelFilterChange = useCallback((c: InboxChannel | 'all') => {
    setChannelFilter(c);
  }, []);

  const handleMobileFiltersClose = useCallback(() => {
    setShowMobileSidebar(false);
  }, []);

  const activeMailbox = useMemo(
    () => (mailboxFilter === 'all' ? null : mailboxes.find((m) => m.email === mailboxFilter) ?? null),
    [mailboxFilter, mailboxes],
  );

  const readingMode = Boolean(selectedConversation);
  const foldersCollapsed = readingMode && !foldersOpenWhileReading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="h-[var(--crm-page-h)] flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {activeMailbox ? activeMailbox.label : 'Inbox'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block truncate">
              {activeMailbox
                ? activeMailbox.email
                : stats
                ? `${stats.total_unread} unread, ${stats.total_open + stats.total_pending} active`
                : 'Unified communications inbox'}
            </p>
          </div>
          {activeMailbox && (
            <button
              onClick={() => setMailboxFilter('all')}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
            >
              Filtered to this mailbox
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <NotificationSettings />
          <button
            onClick={loadConversations}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-slate-500" />
          </button>
          <button
            onClick={() => openCompose()}
            className="inline-flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm lg:text-base"
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
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          mailboxFilter={mailboxFilter}
          onMailboxFilterChange={setMailboxFilter}
          mailboxes={mailboxes}
          mailboxesLoading={mailboxesLoading}
          stats={stats}
          conversationCount={
            stats ? stats.total_open + stats.total_pending : conversations.length
          }
          draftsCount={drafts.length}
          isMobileOpen={showMobileSidebar}
          onMobileClose={handleMobileFiltersClose}
          collapsed={foldersCollapsed}
          onCollapsedChange={
            readingMode
              ? (next) => setFoldersOpenWhileReading(!next)
              : undefined
          }
        />

        {filter === 'drafts' ? (
          <DraftsList
            drafts={drafts}
            mobileView={mobileView}
            onSelectDraft={(draft) =>
              openCompose({
                subject: draft.subject ?? undefined,
                body: draft.body_html ?? draft.body_text ?? undefined,
                to: draft.to_addresses,
                draftId: draft.id,
              })
            }
          />
        ) : (
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            mobileView={mobileView}
            onBulkAction={loadConversations}
            readingMode={readingMode}
            emptyTitle={filter === 'sent' ? 'No sent mail' : undefined}
            emptyDescription={
              filter === 'sent'
                ? 'Messages you send will show up here'
                : undefined
            }
          />
        )}

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
                messages={messages}
                authProfile={authProfile!}
                authUserEmail={authUser?.email || ''}
                mailboxes={mailboxes}
                verifiedDomains={verifiedDomains}
                onReplySent={handleReplySent}
                onForward={handleForward}
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
          composerKey={`compose-${composeSessionId}`}
          onOpenChange={(open) => {
            setShowComposeModal(open);
            if (!open) {
              setComposeInitialSubject(undefined);
              setComposeInitialBody(undefined);
              setComposeInitialTo(undefined);
              setComposeDraftId(null);
            }
          }}
          authProfile={authProfile}
          authUserEmail={authUser.email || ''}
          onMessageSent={() => {
            loadConversations();
            loadDrafts();
          }}
          initialTo={composeInitialTo}
          initialSubject={composeInitialSubject}
          initialBody={composeInitialBody}
          initialDraftId={composeDraftId}
        />
      )}
    </div>
  );
}
