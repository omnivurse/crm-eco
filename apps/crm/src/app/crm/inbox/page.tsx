'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { toastCopy } from '@/lib/crm/toast-copy';
import type {
  InboxConversation,
  InboxDraft,
  InboxMessage,
  InboxStats,
  InboxChannel,
  ConversationStatus,
} from '@/lib/inbox/types';
import type { SharedMailbox } from '@/lib/inbox/shared-mailboxes';
import type { EmailAttachment } from '@/components/email/EmailAttachments';

import { InboxFilters, type FilterType } from './_components/InboxFilters';
import { ConversationList } from './_components/ConversationList';
import { DraftsList } from './_components/DraftsList';
import { MessageThread } from './_components/MessageThread';
import { ReplyForm } from './_components/ReplyForm';
import { ComposeModal } from './_components/ComposeModal';
import { NotificationSettings } from './_components/NotificationSettings';
import {
  buildForwardedBody,
  forwardSubject,
  forwardableAttachments,
} from './_components/inbox-forward';
import { attachUnreadForUser } from '@/lib/inbox/inbox-reads';

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
  const router = useRouter();
  const pathname = usePathname();

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
  const [composeInitialAttachments, setComposeInitialAttachments] = useState<EmailAttachment[] | undefined>();
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [replyExpandToken, setReplyExpandToken] = useState(0);
  const [drafts, setDrafts] = useState<InboxDraft[]>([]);

  const openCompose = useCallback((opts?: {
    subject?: string;
    body?: string;
    to?: Array<{ email: string; name?: string }>;
    attachments?: EmailAttachment[];
    draftId?: string | null;
  }) => {
    setComposeSessionId((n) => n + 1);
    setComposeInitialSubject(opts?.subject);
    setComposeInitialBody(opts?.body);
    setComposeInitialTo(opts?.to);
    setComposeInitialAttachments(opts?.attachments);
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

      const { data: unreadRows } = await supabase.rpc('inbox_unread_conversation_ids', {
        p_org_id: profile.organization_id,
        p_limit: 200,
      });
      const unreadIds = (unreadRows ?? []).map((row: { conversation_id: string }) => row.conversation_id);

      if (filter === 'sent') {
        query = query.not('status', 'in', '(trash,spam)');
      } else if (statusFilter === 'active') {
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

      let skipListQuery = filter === 'drafts';
      if (filter === 'assigned_to_me') {
        query = query.eq('assigned_to', profile.id);
      } else if (filter === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (filter === 'unread') {
        if (unreadIds.length === 0) {
          setConversations([]);
          skipListQuery = true;
        } else {
          query = query.in('id', unreadIds);
        }
      }
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

        setConversations(attachUnreadForUser(data || [], unreadIds));
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
        supabase.rpc('inbox_unread_count_for_user', { p_org_id: profile.organization_id }),
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
        total_unread: typeof unreadCount.data === 'number' ? unreadCount.data : 0,
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
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.set('c', conv.id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    await loadMessages(conv.id);
  }, [loadMessages, pathname, router, searchParams]);

  const conversationFromUrl = searchParams?.get('c');

  useEffect(() => {
    if (!authProfile || !conversationFromUrl) return;
    if (selectedConversation?.id === conversationFromUrl) return;

    const listed = conversations.find((c) => c.id === conversationFromUrl);
    if (listed) {
      void handleSelectConversation(listed);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('inbox_conversations')
        .select('*')
        .eq('id', conversationFromUrl)
        .eq('org_id', authProfile.organization_id)
        .maybeSingle();
      if (cancelled || !data) return;
      void handleSelectConversation(data as InboxConversation);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authProfile,
    conversationFromUrl,
    conversations,
    selectedConversation?.id,
    handleSelectConversation,
  ]);

  // Handle back to list on mobile
  const handleBackToList = useCallback(() => {
    setMobileView('list');
    setSelectedConversation(null);
    setFoldersOpenWhileReading(false);
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.delete('c');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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

      toast.success(status === 'trash' ? toastCopy.movedToTrash() : toastCopy.updated('Status'));
    } catch (error) {
      toast.error(toastCopy.failed('update the status', error, 'Try again'));
    }
  }, []);

  // Callback for ReplyForm after sending
  const handleReplySent = useCallback((conversationId: string) => {
    loadMessages(conversationId);
    loadConversations();
  }, [loadMessages, loadConversations]);

  // Forward handler: open compose modal with forwarded content
  const handleForward = useCallback((subject: string, body: string, attachments?: EmailAttachment[]) => {
    openCompose({ subject, body, attachments });
  }, [openCompose]);

  const handleForwardMessage = useCallback((msg: InboxMessage) => {
    openCompose({
      subject: forwardSubject(selectedConversation?.subject || msg.subject),
      body: buildForwardedBody(msg, ''),
      attachments: forwardableAttachments(msg),
    });
  }, [openCompose, selectedConversation?.subject]);

  const handleStartReply = useCallback(() => {
    setReplyExpandToken((n) => n + 1);
  }, []);

  const handleLatestInboundVisible = useCallback(async (message: InboxMessage) => {
    if (!authProfile) return;
    const res = await fetch('/api/inbox/reads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: message.conversation_id,
        last_seen_message_id: message.id,
        last_read_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === message.conversation_id ? { ...c, is_unread_for_user: false } : c)),
    );
    setSelectedConversation((prev) =>
      prev?.id === message.conversation_id ? { ...prev, is_unread_for_user: false } : prev,
    );
  }, [authProfile]);

  const handleMarkUnread = useCallback(async () => {
    if (!selectedConversation) return;
    const res = await fetch(
      `/api/inbox/reads?conversation_id=${encodeURIComponent(selectedConversation.id)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      toast.error(toastCopy.failed('mark the thread unread', undefined, 'Try again'));
      return;
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversation.id ? { ...c, is_unread_for_user: true } : c)),
    );
    setSelectedConversation((prev) =>
      prev ? { ...prev, is_unread_for_user: true } : prev,
    );
    toast.success(toastCopy.markedUnread());
  }, [selectedConversation]);

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
  const foldersCollapsed = false;

  if (loading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-3 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {activeMailbox ? activeMailbox.label : 'Incoming'}
            </h1>
            <p className="hidden truncate text-[11px] tabular-nums text-slate-500 dark:text-slate-400 sm:block">
              {activeMailbox
                ? activeMailbox.email
                : stats
                ? `${stats.total_unread} unread, ${stats.total_open + stats.total_pending} active`
                : 'Mail and messages'}
            </p>
          </div>
          {activeMailbox && (
            <button
              onClick={() => setMailboxFilter('all')}
              className="hidden items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 transition-colors hover:bg-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:hover:bg-teal-500/20 sm:inline-flex"
            >
              This mailbox
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <NotificationSettings />
          <button
            onClick={loadConversations}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label="Refresh inbox"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => openCompose()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Compose</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
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
                // Only files with a stored object can be re-sent; metadata-only
                // rows would fail resolution at send time.
                attachments: (draft.attachments ?? [])
                  .filter((att) => att.file_path)
                  .map((att, i) => ({
                    id: `draft-${draft.id}-${i}`,
                    file_name: att.filename,
                    file_size: att.size ?? 0,
                    mime_type: att.content_type || 'application/octet-stream',
                    file_path: att.file_path as string,
                  })),
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

        <div className={cn(
          'flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#071018]',
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
                onReply={handleStartReply}
                onForward={handleForwardMessage}
                onLatestInboundVisible={handleLatestInboundVisible}
                onMarkUnread={handleMarkUnread}
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
                expandToken={replyExpandToken}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <Mail className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Select a conversation</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Choose a thread on the left to read and reply.
              </p>
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
              setComposeInitialAttachments(undefined);
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
          initialAttachments={composeInitialAttachments}
          initialDraftId={composeDraftId}
        />
      )}
    </div>
  );
}
