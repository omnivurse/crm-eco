'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import { Mail, Plus, RefreshCw, PanelLeft, FolderOpen, X } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
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
import { ComposeDock } from './_components/ComposeDock';
import { InboxRibbon } from './_components/InboxRibbon';
import { NotificationSettings } from './_components/NotificationSettings';
import { InboxDensityMenu } from './_components/InboxDensityMenu';
import { buildPrintDocument, openPrintWindow } from './_components/inbox-print';
import { sanitizeEmailForReading } from './_components/inbox-reading';
import {
  buildForwardedBody,
  forwardSubject,
  forwardableAttachments,
} from './_components/inbox-forward';
import { attachUnreadForUser } from '@/lib/inbox/inbox-reads';
import { useInboxPrefs } from '@/hooks/useInboxPrefs';
import {
  togglePinned,
  type ConversationSort,
  type QuickFilterKey,
} from '@/lib/inbox/inbox-prefs';
import { shapeConversations, isFlagged } from '@/lib/inbox/inbox-view-model';
import {
  captureStatuses,
  groupByStatus,
  toggleFlagTags,
  type StatusSnapshot,
} from '@/lib/inbox/inbox-actions';

/**
 * How many messages of a thread to hold in memory. Deep enough that a normal
 * business thread is never clipped, bounded so a runaway auto-responder loop
 * cannot stall the pane. The window is anchored to the newest message.
 */
const MESSAGE_WINDOW = 200;

/** Conversations per page. "Load more" appends the next page by keyset. */
const PAGE_SIZE = 50;

/**
 * Realtime coalescing window. An inbound burst or a bulk archive emits one row
 * event per conversation; refetching the list plus its counters on each one
 * turned a 40-message morning into hundreds of requests from every open tab.
 */
const REFRESH_DEBOUNCE_MS = 400;

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <InboxPageContent />
    </Suspense>
  );
}

function InboxPageContent() {
  const { user: authUser, profile: authProfile } = useClientAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [hasMore, setHasMore] = useState(false);
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
  const [showCompose, setShowCompose] = useState(false);
  const [composeSessionId, setComposeSessionId] = useState(0);
  const [composeInitialSubject, setComposeInitialSubject] = useState<string | undefined>();
  const [composeInitialBody, setComposeInitialBody] = useState<string | undefined>();
  const [composeInitialTo, setComposeInitialTo] = useState<Array<{ email: string; name?: string }> | undefined>();
  const [composeInitialAttachments, setComposeInitialAttachments] = useState<EmailAttachment[] | undefined>();
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [replyExpand, setReplyExpand] = useState<{ token: number; mode: 'reply' | 'reply_all' }>({
    token: 0,
    mode: 'reply',
  });
  const [drafts, setDrafts] = useState<InboxDraft[]>([]);

  const { prefs, save: savePrefs } = useInboxPrefs();

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
    setShowCompose(true);
  }, []);

  // Auto-open compose from ?compose=true, then drop the flag. Leaving it in the
  // URL re-opened (and so re-mounted, discarding) the composer on every later
  // navigation inside the inbox — clicking a thread wiped a half-written email.
  useEffect(() => {
    if (searchParams?.get('compose') !== 'true') return;
    openCompose();
    const next = new URLSearchParams(searchParams.toString());
    next.delete('compose');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, openCompose, pathname, router]);

  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 300 });
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Mobile responsive state
  const [showMobileFolders, setShowMobileFolders] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  /** Desktop: the mail folder rail, collapsible independently of the CRM nav. */
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);

  /**
   * Only the newest list response may write state. Two loads can be in flight
   * after a fast folder switch, and the slower one used to land last and show
   * the previous folder's mail under the new folder's header.
   */
  const listToken = useRef(0);

  const loadConversations = useCallback(async (opts?: { append?: boolean; before?: InboxConversation | null }) => {
    if (!authProfile) return;
    const token = ++listToken.current;
    const append = opts?.append === true;

    try {
      const profile = authProfile;

      let query = supabase
        .from('inbox_conversations')
        .select('*')
        .eq('org_id', profile.organization_id)
        // id breaks ties so the keyset cursor below can never skip or repeat a
        // row when two threads share a timestamp.
        .order('last_message_at', { ascending: false })
        .order('id', { ascending: false });

      const { data: unreadRows } = await supabase.rpc('inbox_unread_conversation_ids', {
        p_org_id: profile.organization_id,
        p_limit: 500,
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
          setHasMore(false);
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
          .limit(500);
        if (outboundError) throw outboundError;
        const sentIds = [
          ...new Set(
            (outbound ?? []).map((row: { conversation_id: string }) => row.conversation_id).filter(Boolean),
          ),
        ];
        if (sentIds.length === 0) {
          setConversations([]);
          setHasMore(false);
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

      // Keyset cursor: strictly older than the last row we already hold, or
      // the same instant with a lower id. Offset paging would duplicate or
      // skip rows every time an inbound email re-sorted the list mid-scroll.
      const cursor = opts?.before;
      if (append && cursor) {
        query = query.or(
          `last_message_at.lt.${cursor.last_message_at},and(last_message_at.eq.${cursor.last_message_at},id.lt.${cursor.id})`,
        );
      }

      if (!skipListQuery) {
        // One extra row is the "is there another page" probe; it is dropped
        // before render so the count the user sees stays honest.
        const { data, error } = await query.limit(PAGE_SIZE + 1);

        if (error) {
          console.error('Error loading conversations:', error);
          if (error.code === '42P01') {
            setConversations([]);
            setHasMore(false);
            return;
          }
          throw error;
        }

        if (token !== listToken.current) return;

        const rows = (data ?? []) as InboxConversation[];
        const page = attachUnreadForUser(rows.slice(0, PAGE_SIZE), unreadIds);
        setHasMore(rows.length > PAGE_SIZE);
        setConversations((prev) => {
          if (!append) return page;
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...page.filter((c) => !seen.has(c.id))];
        });
      } else if (filter === 'drafts') {
        if (token !== listToken.current) return;
        setConversations([]);
        setHasMore(false);
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

      if (token !== listToken.current) return;

      setStats({
        total_open: openCount.count || 0,
        total_pending: pendingCount.count || 0,
        total_unread: typeof unreadCount.data === 'number' ? unreadCount.data : 0,
        assigned_to_me: assignedCount.count || 0,
        unassigned: unassignedCount.count || 0,
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      if (token === listToken.current && !append) {
        toast.error(toastCopy.failed('load the inbox', error, 'Refresh to retry'));
      }
    } finally {
      if (token === listToken.current) setLoading(false);
    }
  }, [authProfile, filter, channelFilter, statusFilter, mailboxFilter, debouncedQuery]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleLoadMore = useCallback(() => {
    const last = conversations[conversations.length - 1];
    if (!last) return;
    void loadConversations({ append: true, before: last });
  }, [conversations, loadConversations]);

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

  // Shared mailbox list + unread badges. Loaded once per session rather than
  // on every conversation event: the address registry is static between
  // Settings visits, and re-fetching it per inbound email was three extra
  // requests a message for data that had not changed.
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

  // Realtime, coalesced. Row events arrive one per conversation, so a bulk
  // archive of 40 threads used to fire 40 full reloads; the trailing timer
  // collapses a burst into a single refresh.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadConversationsRef = useRef(loadConversations);
  const loadMailboxesRef = useRef(loadMailboxes);
  useEffect(() => {
    loadConversationsRef.current = loadConversations;
    loadMailboxesRef.current = loadMailboxes;
  }, [loadConversations, loadMailboxes]);

  useEffect(() => {
    if (!authProfile) return;

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        void loadConversationsRef.current();
        void loadMailboxesRef.current();
      }, REFRESH_DEBOUNCE_MS);
    };

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
        (payload: { new?: unknown }) => {
          // Keep the open thread's header live from the payload itself, so a
          // teammate's status change is visible without waiting for (or
          // paying for) a refetch.
          const row = payload.new as InboxConversation | undefined;
          if (row?.id) {
            setSelectedConversation((prev) =>
              prev && prev.id === row.id ? { ...prev, ...row } : prev,
            );
          }
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(convChannel);
    };
  }, [authProfile]);

  /**
   * Guards the reading pane against a slow response landing after the reader
   * has already moved on: without it, thread A's messages could render under
   * thread B's header and the composer would quote the wrong email.
   */
  const selectedIdRef = useRef<string | null>(null);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      // Newest-first with the cap applied, then reversed for display. Reading
      // oldest-first meant a long thread was truncated at its *newest* end, so
      // the composer replied to a stale message — wrong recipient, wrong
      // In-Reply-To — while the reader saw history that stopped mid-thread.
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: false })
        .limit(MESSAGE_WINDOW);

      if (error) throw error;
      if (selectedIdRef.current !== conversationId) return;
      setMessages((data ?? []).slice().reverse());
    } catch (error) {
      console.error('Failed to load messages:', error);
      if (selectedIdRef.current === conversationId) {
        toast.error(toastCopy.failed('load this conversation', error, 'Try again'));
      }
    } finally {
      if (selectedIdRef.current === conversationId) setLoadingMessages(false);
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
    selectedIdRef.current = conv.id;
    setSelectedConversation(conv);
    setMessages([]);
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
    selectedIdRef.current = null;
    setMobileView('list');
    setSelectedConversation(null);
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.delete('c');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  /**
   * Every status write goes through here so three things are always true: the
   * organisation is named in the predicate (defence in depth behind RLS), a
   * rejected write is surfaced instead of being toasted as success, and the
   * optimistic row is put back the way it was when the database says no.
   */
  const applyStatus = useCallback(async (
    ids: string[],
    status: ConversationStatus,
    opts?: { silent?: boolean },
  ): Promise<StatusSnapshot[] | null> => {
    if (!authProfile || ids.length === 0) return null;
    const idSet = new Set(ids);
    const snapshot = captureStatuses(conversations, ids);

    const updates: Record<string, unknown> = { status };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    // Restoring to the inbox has to clear the snooze alarm, or the thread
    // reappears and then vanishes again the next time the list is read.
    if (status === 'open') updates.snoozed_until = null;

    setConversations((prev) => prev.map((c) => (idSet.has(c.id) ? { ...c, status } : c)));
    setSelectedConversation((prev) => (prev && idSet.has(prev.id) ? { ...prev, status } : prev));

    const { error } = await supabase
      .from('inbox_conversations')
      .update(updates)
      .in('id', ids)
      .eq('org_id', authProfile.organization_id);

    if (error) {
      // Put every row back exactly as it was — a half-applied list is worse
      // than a failed action, because the next refresh silently "undoes" it.
      const previous = new Map(snapshot.map((s) => [s.id, s.status]));
      setConversations((prev) =>
        prev.map((c) => (previous.has(c.id) ? { ...c, status: previous.get(c.id)! } : c)),
      );
      setSelectedConversation((prev) =>
        prev && previous.has(prev.id) ? { ...prev, status: previous.get(prev.id)! } : prev,
      );
      toast.error(toastCopy.failed('move the mail', error, 'Try again'));
      return null;
    }

    if (!opts?.silent) void loadConversations();
    return snapshot;
  }, [authProfile, conversations, loadConversations]);

  /** Restore a set of threads to the statuses they held before an action. */
  const restoreStatuses = useCallback(async (snapshot: StatusSnapshot[]) => {
    if (!authProfile || snapshot.length === 0) return;
    const groups = groupByStatus(snapshot);
    const results = await Promise.all(
      groups.map((group) =>
        supabase
          .from('inbox_conversations')
          .update({ status: group.status })
          .in('id', group.ids)
          .eq('org_id', authProfile.organization_id),
      ),
    );
    if (results.some((r) => r.error)) {
      toast.error(toastCopy.failed('undo that', undefined, 'Open the folder to move it back'));
    }
    void loadConversations();
  }, [authProfile, loadConversations]);

  const updateStatus = useCallback(async (conversationId: string, status: ConversationStatus) => {
    const snapshot = await applyStatus([conversationId], status);
    if (!snapshot) return;
    const undoable = status === 'trash' || status === 'archived' || status === 'spam';
    toast.success(status === 'trash' ? toastCopy.movedToTrash() : toastCopy.updated('Status'), {
      duration: undoable ? 8000 : 4000,
      action: undoable
        ? { label: 'Undo', onClick: () => void restoreStatuses(snapshot) }
        : undefined,
    });
  }, [applyStatus, restoreStatuses]);

  /**
   * Bulk move. Anything past a single row is confirmed first and undoable
   * after: one click used to move dozens of threads — including rows that had
   * scrolled out of view — with no way back except restoring them one by one.
   */
  const handleBulkStatus = useCallback(async (ids: string[], status: ConversationStatus) => {
    if (ids.length === 0) return;
    const label =
      status === 'trash' ? 'Move' : status === 'archived' ? 'Archive' : status === 'spam' ? 'Mark as junk' : 'Move';
    const destination =
      status === 'trash' ? 'Deleted Items' : status === 'archived' ? 'Archive' : status === 'spam' ? 'Junk' : status;
    if (ids.length > 1) {
      const ok = await confirmDialog({
        title: `${label} ${ids.length} conversations?`,
        description: `They move to ${destination}. You can move them back from that folder, or use Undo.`,
        confirmLabel: label,
        destructive: status === 'trash' || status === 'spam',
      });
      if (!ok) return;
    }

    const snapshot = await applyStatus(ids, status);
    if (!snapshot) return;
    toast.success(
      status === 'trash'
        ? toastCopy.movedToTrash(ids.length, { one: 'conversation', other: 'conversations' })
        : toastCopy.bulkTitle(status === 'spam' ? 'Marked as junk' : 'Archived', ids.length, {
            one: 'conversation',
            other: 'conversations',
          }),
      {
        duration: 8000,
        action: { label: 'Undo', onClick: () => void restoreStatuses(snapshot) },
      },
    );
  }, [applyStatus, restoreStatuses]);

  /** Read/unread for one or many threads, via the server's org-checked route. */
  const setReadState = useCallback(async (ids: string[], read: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const apply = (unread: boolean) => {
      setConversations((prev) =>
        prev.map((c) => (idSet.has(c.id) ? { ...c, is_unread_for_user: unread } : c)),
      );
      setSelectedConversation((prev) =>
        prev && idSet.has(prev.id) ? { ...prev, is_unread_for_user: unread } : prev,
      );
    };
    apply(!read);

    const res = read
      ? await fetch('/api/inbox/reads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_ids: ids, last_read_at: new Date().toISOString() }),
        })
      : await fetch(`/api/inbox/reads?conversation_ids=${ids.map(encodeURIComponent).join(',')}`, {
          method: 'DELETE',
        });

    if (!res.ok) {
      apply(read);
      toast.error(toastCopy.failed(read ? 'mark it read' : 'mark it unread', undefined, 'Try again'));
      return;
    }
    void loadConversations();
  }, [loadConversations]);

  const handleToggleRead = useCallback((conv: InboxConversation) => {
    void setReadState([conv.id], conv.is_unread_for_user === true);
  }, [setReadState]);

  const handleMarkAllRead = useCallback(async () => {
    const res = await fetch('/api/inbox/reads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        all_unread: true,
        mailbox: mailboxFilter === 'all' ? undefined : mailboxFilter,
        last_read_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      toast.error(toastCopy.failed('mark everything read', undefined, 'Try again'));
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { marked?: number };
    setConversations((prev) => prev.map((c) => ({ ...c, is_unread_for_user: false })));
    toast.success(
      body.marked
        ? toastCopy.counted('conversation', body.marked, 'Marked read')
        : toastCopy.updated('Read state'),
    );
    void loadConversations();
  }, [loadConversations, mailboxFilter]);

  /**
   * Flags live in the shared `tags` array, so a flag is visible to the whole
   * team — which is what a shared mailbox wants. The write only ever adds or
   * removes the flag value, never rewrites the array, so a category applied by
   * a colleague survives.
   */
  const handleToggleFlag = useCallback(async (conv: InboxConversation) => {
    if (!authProfile) return;
    const nextFlagged = !isFlagged(conv);
    const nextTags = toggleFlagTags(conv.tags, nextFlagged);
    const previousTags = conv.tags ?? [];

    const apply = (tags: string[]) => {
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, tags } : c)));
      setSelectedConversation((prev) => (prev && prev.id === conv.id ? { ...prev, tags } : prev));
    };
    apply(nextTags);

    const { error } = await supabase
      .from('inbox_conversations')
      .update({ tags: nextTags })
      .eq('id', conv.id)
      .eq('org_id', authProfile.organization_id);

    if (error) {
      apply([...previousTags]);
      toast.error(toastCopy.failed(nextFlagged ? 'flag it' : 'clear the flag', error, 'Try again'));
    }
  }, [authProfile]);

  const handleTogglePin = useCallback((conversationId: string) => {
    savePrefs({ pinned: togglePinned(prefs.pinned, conversationId) });
  }, [prefs.pinned, savePrefs]);

  const handleSnooze = useCallback(async (until: string) => {
    if (!selectedConversation || !authProfile) return;
    const { error } = await supabase
      .from('inbox_conversations')
      .update({ status: 'snoozed', snoozed_until: until })
      .eq('id', selectedConversation.id)
      .eq('org_id', authProfile.organization_id);
    if (error) {
      toast.error(toastCopy.failed('snooze this thread', error, 'Try again'));
      return;
    }
    toast.success(toastCopy.snoozedUntil(until));
    void loadConversations();
  }, [authProfile, loadConversations, selectedConversation]);

  const handlePrint = useCallback(() => {
    if (!selectedConversation) return;
    // Sanitized here, in the page, using the same policy the reading pane
    // applies — the print document is real HTML in a real window, so it must
    // never carry markup the thread itself would have stripped.
    const opened = openPrintWindow(
      buildPrintDocument(selectedConversation, messages, sanitizeEmailForReading),
    );
    if (!opened) {
      toast.error(toastCopy.failed('open the print view', undefined, 'Allow pop-ups for this site'));
    }
  }, [messages, selectedConversation]);

  // Callback for ReplyForm after sending
  const handleReplySent = useCallback((conversationId: string) => {
    loadMessages(conversationId);
    loadConversations();
    loadDrafts();
  }, [loadMessages, loadConversations, loadDrafts]);

  // Forward handler: open compose with forwarded content
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

  const startReply = useCallback((mode: 'reply' | 'reply_all' = 'reply') => {
    setReplyExpand((prev) => ({ token: prev.token + 1, mode }));
  }, []);

  const handleStartReply = useCallback(() => startReply('reply'), [startReply]);

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

  const handleMarkUnread = useCallback(() => {
    if (!selectedConversation) return;
    void setReadState([selectedConversation.id], false);
  }, [selectedConversation, setReadState]);

  const shaped = useMemo(
    () =>
      shapeConversations(conversations, {
        sort: prefs.sort,
        quickFilters: prefs.quick_filters,
        pinned: prefs.pinned,
        viewerProfileId: authProfile?.id ?? null,
      }),
    [conversations, prefs.sort, prefs.quick_filters, prefs.pinned, authProfile?.id],
  );

  const senderAddresses = useMemo(() => mailboxes.map((m) => m.email), [mailboxes]);

  const defaultSender = useMemo(
    () => mailboxes.find((m) => m.isDefault) ?? mailboxes[0] ?? null,
    [mailboxes],
  );

  /**
   * Reply-To for a compose that goes out as a no-reply address: the first
   * mailbox a human actually reads. Derived from the registry rather than a
   * hardcoded tenant address, so a second org does not inherit PIFH's support
   * queue.
   */
  const fallbackReplyTo = useMemo(() => {
    const monitored = mailboxes.find((m) => !m.email.toLowerCase().startsWith('noreply@'));
    return monitored?.email ?? defaultSender?.email ?? '';
  }, [mailboxes, defaultSender]);

  const handleSortChange = useCallback((sort: ConversationSort) => savePrefs({ sort }), [savePrefs]);
  const handleQuickFiltersChange = useCallback(
    (quick_filters: QuickFilterKey[]) => savePrefs({ quick_filters }),
    [savePrefs],
  );

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
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const listed = shaped.all;

      switch (e.key) {
        case 'c':
          e.preventDefault();
          openCompose();
          break;
        case 'r':
          if (selectedConversation) {
            e.preventDefault();
            startReply('reply');
          }
          break;
        case 'a':
          if (selectedConversation) {
            e.preventDefault();
            startReply('reply_all');
          }
          break;
        case 'f':
          if (selectedConversation && messages.length > 0) {
            e.preventDefault();
            handleForwardMessage(messages[messages.length - 1]);
          }
          break;
        case 'u':
          if (selectedConversation) {
            e.preventDefault();
            void setReadState([selectedConversation.id], selectedConversation.is_unread_for_user === true);
          }
          break;
        case 'e':
          if (selectedConversation) {
            e.preventDefault();
            void updateStatus(selectedConversation.id, 'archived');
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedConversation) {
            e.preventDefault();
            void updateStatus(selectedConversation.id, 'trash');
          }
          break;
        case 'j':
          if (listed.length > 0) {
            e.preventDefault();
            const currentIndex = selectedConversation
              ? listed.findIndex(c => c.id === selectedConversation.id)
              : -1;
            const nextIndex = Math.min(currentIndex + 1, listed.length - 1);
            handleSelectConversation(listed[nextIndex]);
          }
          break;
        case 'k':
          if (listed.length > 0) {
            e.preventDefault();
            const currentIndex = selectedConversation
              ? listed.findIndex(c => c.id === selectedConversation.id)
              : listed.length;
            const prevIndex = Math.max(currentIndex - 1, 0);
            handleSelectConversation(listed[prevIndex]);
          }
          break;
        case 'Escape':
          // Desktop keeps the thread open: Escape is a "close the thing on
          // top" reflex, and blanking the reading pane made it feel like the
          // email had been lost. Mobile still needs it to get back to the list.
          if (selectedConversation && mobileView === 'detail' && window.innerWidth < 1024) {
            handleBackToList();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedConversation,
    shaped.all,
    messages,
    mobileView,
    handleSelectConversation,
    handleBackToList,
    handleForwardMessage,
    updateStatus,
    openCompose,
    startReply,
    setReadState,
  ]);

  // Filter change handlers
  const handleFilterChange = useCallback((f: FilterType) => {
    setFilter(f);
    if (f === 'sent' || f === 'drafts') {
      selectedIdRef.current = null;
      setSelectedConversation(null);
      setMobileView('list');
    }
  }, []);

  const handleChannelFilterChange = useCallback((c: InboxChannel | 'all') => {
    setChannelFilter(c);
  }, []);

  const handleMobileFiltersClose = useCallback(() => {
    setShowMobileFolders(false);
  }, []);

  const activeMailbox = useMemo(
    () => (mailboxFilter === 'all' ? null : mailboxes.find((m) => m.email === mailboxFilter) ?? null),
    [mailboxFilter, mailboxes],
  );

  const readingMode = Boolean(selectedConversation);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-2 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setShowMobileFolders(true)}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
            aria-label="Mail folders"
            title="Mail folders"
          >
            {/* Deliberately not a hamburger: the CRM nav trigger next to it in
                the top bar already is one, and two identical icons opening two
                different drawers is a coin flip on a phone. */}
            <FolderOpen className="h-5 w-5" />
          </button>
          <button
            onClick={() => setFoldersCollapsed((open) => !open)}
            className="hidden rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-white lg:inline-flex"
            aria-expanded={!foldersCollapsed}
            aria-label={foldersCollapsed ? 'Show mail folders' : 'Hide mail folders'}
            title={foldersCollapsed ? 'Show mail folders' : 'Hide mail folders'}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
              {activeMailbox ? activeMailbox.label : 'Incoming'}
            </h1>
            <p className="hidden truncate text-[11px] leading-tight tabular-nums text-slate-500 dark:text-slate-400 sm:block">
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
        <div className="flex items-center gap-1">
          <InboxDensityMenu
            density={prefs.density}
            onDensityChange={(density) => savePrefs({ density })}
            threadOrder={prefs.thread_order}
            onThreadOrderChange={(thread_order) => savePrefs({ thread_order })}
            collapseNav={prefs.collapse_nav_on_inbox}
            onCollapseNavChange={(collapse_nav_on_inbox) => savePrefs({ collapse_nav_on_inbox })}
          />
          <NotificationSettings />
          <button
            onClick={() => loadConversations()}
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
          isMobileOpen={showMobileFolders}
          onMobileClose={handleMobileFiltersClose}
          collapsed={foldersCollapsed}
          onCollapsedChange={setFoldersCollapsed}
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
            conversations={shaped.all}
            pinnedIds={prefs.pinned}
            selectedConversationId={selectedConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            mobileView={mobileView}
            readingMode={readingMode}
            density={prefs.density}
            sort={prefs.sort}
            onSortChange={handleSortChange}
            quickFilters={prefs.quick_filters}
            onQuickFiltersChange={handleQuickFiltersChange}
            filteredOutCount={shaped.filteredOutCount}
            onTogglePin={handleTogglePin}
            onToggleFlag={handleToggleFlag}
            onToggleRead={handleToggleRead}
            onArchive={(conv) => void updateStatus(conv.id, 'archived')}
            onTrash={(conv) => void updateStatus(conv.id, conv.status === 'trash' ? 'open' : 'trash')}
            onBulkStatus={handleBulkStatus}
            onBulkRead={(ids, read) => void setReadState(ids, read)}
            onMarkAllRead={handleMarkAllRead}
            verifiedDomains={verifiedDomains}
            senderAddresses={senderAddresses}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
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
                threadOrder={prefs.thread_order}
                verifiedDomains={verifiedDomains}
                senderAddresses={senderAddresses}
                ribbon={
                  <InboxRibbon
                    status={selectedConversation.status}
                    flagged={isFlagged(selectedConversation)}
                    unread={selectedConversation.is_unread_for_user === true}
                    disabled={messages.length === 0}
                    onReply={() => startReply('reply')}
                    onReplyAll={() => startReply('reply_all')}
                    onForward={() => {
                      const source = messages[messages.length - 1];
                      if (source) handleForwardMessage(source);
                    }}
                    onArchive={() => void updateStatus(selectedConversation.id, 'archived')}
                    onTrash={() => void updateStatus(selectedConversation.id, 'trash')}
                    onSpam={() => void updateStatus(selectedConversation.id, 'spam')}
                    onRestore={() => void updateStatus(selectedConversation.id, 'open')}
                    onToggleFlag={() => void handleToggleFlag(selectedConversation)}
                    onToggleRead={() => handleToggleRead(selectedConversation)}
                    onSnooze={(until) => void handleSnooze(until)}
                    onMove={(status) => void updateStatus(selectedConversation.id, status)}
                    onPrint={handlePrint}
                  />
                }
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
                expandToken={replyExpand.token}
                expandMode={replyExpand.mode}
                drafts={drafts}
                onDraftsChanged={loadDrafts}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <Mail className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {filter === 'sent' ? 'Select a sent message' : 'Select a conversation'}
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Choose a thread on the left to read and reply.
              </p>
            </div>
          )}
        </div>
      </div>

      {authProfile && authUser && (
        <ComposeDock
          // Each compose session is a fresh sheet of paper: remounting is what
          // clears the last message's dirty flag, saved subject and draft id,
          // so none of that has to be re-derived from props.
          key={`compose-${composeSessionId}`}
          open={showCompose}
          composerKey={`compose-${composeSessionId}`}
          onOpenChange={(open) => {
            setShowCompose(open);
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
          onDraftsChanged={loadDrafts}
          initialTo={composeInitialTo}
          initialSubject={composeInitialSubject}
          initialBody={composeInitialBody}
          initialAttachments={composeInitialAttachments}
          initialDraftId={composeDraftId}
          fallbackEmail={defaultSender?.email ?? ''}
          fallbackName={defaultSender?.name ?? ''}
          fallbackReplyTo={fallbackReplyTo}
        />
      )}
    </div>
  );
}
