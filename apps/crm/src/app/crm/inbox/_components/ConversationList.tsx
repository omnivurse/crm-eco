'use client';

/**
 * The conversation list — Outlook's message list, not Gmail's.
 *
 * Three deliberate departures from what shipped:
 *
 * 1. It writes nothing. The list used to `supabase.from('inbox_conversations')
 *    .update(...)` for the star and for bulk archive/trash and ignored the
 *    returned error, so a row rejected by RLS still toasted "Archived". Every
 *    action here is a callback; the page owns the write, the error, the undo
 *    and the org scoping, and it is the only place that knows whether the
 *    write landed.
 * 2. It never mutates a conversation. The old star handler assigned
 *    `conv.tags = newTags` on the prop object, which mutates the page's state
 *    array in place — React cannot see that, so the row only "moved" when
 *    something else re-rendered it.
 * 3. Rows are three lines, and the always-on status pill is gone. A column of
 *    identical "open" badges costs a line of vertical rhythm and tells the
 *    reader nothing; the badge now appears only when the status is worth
 *    interrupting for.
 *
 * Ordering, filtering and the pin band are decided by the page (see
 * `shapeConversations` in lib/inbox/inbox-view-model) and rendered here as
 * given. This component does not re-sort.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckSquare,
  Flag,
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  Paperclip,
  Pin,
  PinOff,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Avatar, AvatarFallback } from '@crm-eco/ui/components/avatar';
import { InboxListHeader } from './InboxListHeader';
import {
  hasAttachments,
  isExternalSender,
  isFlagged,
  isImportant,
} from '@/lib/inbox/inbox-view-model';
// The repo's one English pluraliser. It lives in toast-copy but is pure and
// has no sonner dependency, so reusing it beats a second copy of the rules.
import { pluralize } from '@/lib/crm/toast-copy';
import type { InboxConversation, InboxChannel, ConversationStatus } from '@/lib/inbox/types';
import type { ConversationSort, InboxDensity, QuickFilterKey } from '@/lib/inbox/inbox-prefs';

/** How many skeleton rows stand in for the first page while it loads. */
const SKELETON_ROWS = 6;

/** Beyond this a thread's labels start eating the subject, so they collapse to "+n". */
const MAX_VISIBLE_LABELS = 2;

/**
 * Email is the default channel of this mailbox, so its glyph is suppressed —
 * a column of identical envelopes is the same noise as a column of "open"
 * badges. Anything that is *not* email is worth a marker.
 */
const CHANNEL_GLYPHS: Record<InboxChannel, string | null> = {
  email: null,
  sms: '💬',
  whatsapp: '📱',
  phone: '📞',
  video: '🎥',
  chat: '💭',
  social: '🔗',
  support: '❓',
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

/** 'open' is present for completeness but never rendered — see the file header. */
const STATUS_STYLES: Record<ConversationStatus, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  snoozed: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  trash: 'bg-slate-200 text-slate-700 dark:bg-slate-500/30 dark:text-slate-300',
  spam: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  snoozed: 'Snoozed',
  resolved: 'Resolved',
  archived: 'Archived',
  trash: 'Deleted',
  spam: 'Junk',
};

interface DensityStyle {
  /** Row padding — the whole point of the setting. */
  row: string;
  gap: string;
  /** Leading slot size; also the checkbox hit area. */
  lead: string;
  avatar: boolean;
  preview: boolean;
}

/**
 * Six rows on a laptop was the complaint. Compact drops the avatar and the
 * preview line to fit roughly twice that; cozy keeps the preview because it is
 * what makes a list triageable without opening anything.
 */
const DENSITY: Record<InboxDensity, DensityStyle> = {
  compact: { row: 'px-2 py-1.5', gap: 'gap-2', lead: 'mt-0.5 h-5 w-5', avatar: false, preview: false },
  cozy: { row: 'px-2.5 py-2', gap: 'gap-2.5', lead: 'h-9 w-9', avatar: true, preview: true },
  comfortable: { row: 'px-3 py-3', gap: 'gap-3', lead: 'h-10 w-10', avatar: true, preview: true },
};

const BULK_BUTTON =
  'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';

const ROW_ACTION =
  'pointer-events-auto rounded p-1 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white';

function conversationLooksUnread(conv: InboxConversation): boolean {
  return conv.is_unread_for_user === true;
}

/** Distinct from the view model's `senderLabel`, which lower-cases for sorting. */
function displaySender(conv: InboxConversation): string {
  return conv.contact_name || conv.contact_email || conv.contact_phone || 'Unknown';
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
  /** Already filtered, sorted and pin-ordered by the page. Render in this order. */
  conversations: InboxConversation[];
  /** Ids in the pinned band; used for the band boundary and the pin button state. */
  pinnedIds: readonly string[];
  selectedConversationId: string | null;
  onSelectConversation: (conv: InboxConversation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  mobileView: 'list' | 'detail';
  readingMode?: boolean;
  density: InboxDensity;
  sort: ConversationSort;
  onSortChange: (sort: ConversationSort) => void;
  quickFilters: readonly QuickFilterKey[];
  onQuickFiltersChange: (filters: QuickFilterKey[]) => void;
  /** Rows the Filter menu hid — surface it so an empty list is never a mystery. */
  filteredOutCount: number;
  onTogglePin: (conversationId: string) => void;
  onToggleFlag: (conv: InboxConversation) => void;
  onToggleRead: (conv: InboxConversation) => void;
  onArchive: (conv: InboxConversation) => void;
  onTrash: (conv: InboxConversation) => void;
  /** Bulk actions: the PAGE owns the database write, the undo toast and the org scoping. */
  onBulkStatus: (ids: string[], status: ConversationStatus) => void;
  onBulkRead: (ids: string[], read: boolean) => void;
  onMarkAllRead: () => void;
  verifiedDomains: readonly string[];
  senderAddresses: readonly string[];
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export const ConversationList = React.memo(function ConversationList({
  conversations,
  pinnedIds,
  selectedConversationId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  mobileView,
  readingMode = false,
  density,
  sort,
  onSortChange,
  quickFilters,
  onQuickFiltersChange,
  filteredOutCount,
  onTogglePin,
  onToggleFlag,
  onToggleRead,
  onArchive,
  onTrash,
  onBulkStatus,
  onBulkRead,
  onMarkAllRead,
  verifiedDomains,
  senderAddresses,
  emptyTitle = 'No conversations',
  emptyDescription = 'Conversations will appear here when you receive messages',
  loading = false,
  hasMore = false,
  onLoadMore,
}: ConversationListProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const rowStyle = DENSITY[density] ?? DENSITY.cozy;

  const pinnedSet = useMemo(() => new Set<string>(pinnedIds), [pinnedIds]);

  /**
   * Where the pinned band stops. The page already ordered pins first and pin
   * order is a manual override, so the boundary is *found*, never re-derived —
   * re-sorting here would quietly fight the order the user pinned things in.
   */
  const pinnedCount = useMemo(() => {
    if (pinnedSet.size === 0) return 0;
    let count = 0;
    while (count < conversations.length && pinnedSet.has(conversations[count].id)) count += 1;
    return count;
  }, [conversations, pinnedSet]);

  /**
   * Selection intersected with what is on screen right now. A filter change or
   * a refetch can strip rows out from under a selection, and acting on an id
   * the user can no longer see is how a bulk delete hits the wrong thread.
   */
  const selectedVisible = useMemo(
    () => conversations.filter((conv) => selectedIds.has(conv.id)),
    [conversations, selectedIds],
  );
  const selectionActive = selectedVisible.length > 0;
  const allSelected = conversations.length > 0 && selectedVisible.length === conversations.length;

  const clearSelection = useCallback(() => setSelectedIds(new Set<string>()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set<string>() : new Set(conversations.map((c) => c.id)));
  }, [allSelected, conversations]);

  const handleRowActivate = useCallback(
    (conv: InboxConversation) => {
      // Mid-selection a row click extends the batch instead of navigating —
      // opening the thread would throw away the set the user is building.
      if (selectionActive) toggleSelect(conv.id);
      else onSelectConversation(conv);
    },
    [onSelectConversation, selectionActive, toggleSelect],
  );

  const bulkStatus = useCallback(
    (status: ConversationStatus) => {
      if (selectedVisible.length === 0) return;
      onBulkStatus(
        selectedVisible.map((conv) => conv.id),
        status,
      );
      // These rows leave this list, so a surviving selection would refer to
      // whatever slid into their place.
      clearSelection();
    },
    [clearSelection, onBulkStatus, selectedVisible],
  );

  const bulkRead = useCallback(
    (read: boolean) => {
      if (selectedVisible.length === 0) return;
      onBulkRead(
        selectedVisible.map((conv) => conv.id),
        read,
      );
      // Read state does not remove a row, so the batch stays selected and can
      // be flagged or filed next.
    },
    [onBulkRead, selectedVisible],
  );

  const bulkFlag = useCallback(() => {
    // There is no bulk-flag callback in the contract, and the per-thread one
    // toggles, so already-flagged rows are skipped: the outcome is "all of
    // these are flagged" rather than "half of these changed".
    for (const conv of selectedVisible) {
      if (!isFlagged(conv)) onToggleFlag(conv);
    }
  }, [onToggleFlag, selectedVisible]);

  const stop = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-[#f7f8fa] dark:border-white/10 dark:bg-[#0a1118] lg:flex-none',
        readingMode ? 'lg:w-80' : 'lg:w-[22rem] xl:w-96',
        mobileView === 'detail' ? 'hidden lg:flex' : 'flex',
      )}
    >
      <div className="shrink-0 border-b border-slate-200/80 p-2 dark:border-white/10">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full rounded-md border border-slate-200/80 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-[#0d1620] dark:text-white"
          />
        </div>
      </div>

      {selectionActive ? (
        <div
          role="toolbar"
          aria-label="Selected conversations"
          className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-slate-200/80 bg-teal-50/60 px-2 py-1 dark:border-white/10 dark:bg-teal-500/10"
        >
          <button
            type="button"
            onClick={toggleSelectAll}
            aria-label={allSelected ? 'Deselect all' : 'Select all'}
            aria-pressed={allSelected}
            className={BULK_BUTTON}
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-teal-600" aria-hidden />
            ) : (
              <Square className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">Select all</span>
          </button>
          <span className="px-1 text-[12px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
            {selectedVisible.length} selected
          </span>
          <span className="mx-0.5 h-4 w-px bg-slate-300 dark:bg-white/15" aria-hidden />
          <button type="button" onClick={() => bulkRead(true)} className={BULK_BUTTON} aria-label="Mark read">
            <MailOpen className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">Read</span>
          </button>
          <button type="button" onClick={() => bulkRead(false)} className={BULK_BUTTON} aria-label="Mark unread">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">Unread</span>
          </button>
          <button type="button" onClick={bulkFlag} className={BULK_BUTTON} aria-label="Flag selected">
            <Flag className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">Flag</span>
          </button>
          <button
            type="button"
            onClick={() => bulkStatus('archived')}
            className={BULK_BUTTON}
            aria-label="Archive selected"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">Archive</span>
          </button>
          <button
            type="button"
            onClick={() => bulkStatus('trash')}
            className={cn(BULK_BUTTON, 'hover:text-red-600 dark:hover:text-red-400')}
            aria-label="Delete selected"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">Delete</span>
          </button>
          <button type="button" onClick={clearSelection} className={cn(BULK_BUTTON, 'ml-auto')}>
            Cancel
          </button>
        </div>
      ) : (
        <InboxListHeader
          sort={sort}
          onSortChange={onSortChange}
          quickFilters={quickFilters}
          onQuickFiltersChange={onQuickFiltersChange}
          onMarkAllRead={onMarkAllRead}
          filteredOutCount={filteredOutCount}
        />
      )}

      {/* A refresh over an already-populated list stays readable: the rows keep
          their place and only this hairline says work is in flight. */}
      {loading && conversations.length > 0 && (
        <div className="h-0.5 shrink-0 animate-pulse bg-teal-500/60" aria-hidden />
      )}

      <div className="flex-1 overflow-y-auto" aria-busy={loading || undefined}>
        {loading && conversations.length === 0 ? (
          <div aria-hidden>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start border-b border-slate-200/60 dark:border-white/5',
                  rowStyle.row,
                  rowStyle.gap,
                )}
              >
                {rowStyle.avatar && (
                  <div className={cn('shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700', rowStyle.lead)} />
                )}
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  {rowStyle.preview && (
                    <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  )}
                </div>
              </div>
            ))}
            <span className="sr-only">Loading conversations…</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500">
            <InboxIcon className="mb-3 h-10 w-10 opacity-50" aria-hidden />
            {filteredOutCount > 0 ? (
              <>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nothing matches these filters
                </p>
                <p className="mt-1 text-xs">
                  {filteredOutCount} {pluralize('conversation', filteredOutCount)} hidden by the
                  Filter menu.
                </p>
                <button
                  type="button"
                  onClick={() => onQuickFiltersChange([])}
                  className="mt-3 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">{emptyTitle}</p>
                <p className="mt-1 text-xs">{emptyDescription}</p>
              </>
            )}
          </div>
        ) : (
          <>
            {conversations.map((conv, index) => {
              const unread = conversationLooksUnread(conv);
              const active = selectedConversationId === conv.id;
              const checked = selectedIds.has(conv.id);
              const pinned = pinnedSet.has(conv.id);
              const flagged = isFlagged(conv);
              const attachments = hasAttachments(conv);
              const important = isImportant(conv);
              const external = isExternalSender(conv.contact_email, verifiedDomains, senderAddresses);
              const sender = displaySender(conv);
              const channelGlyph = CHANNEL_GLYPHS[conv.channel];
              const labels = conv.labels ?? [];

              return (
                <React.Fragment key={conv.id}>
                  {pinnedCount > 0 && index === 0 && (
                    <h3 className="flex items-center gap-1.5 border-b border-slate-200/60 bg-slate-100/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400">
                      <Pin className="h-3 w-3" aria-hidden />
                      Pinned
                    </h3>
                  )}
                  {pinnedCount > 0 && index === pinnedCount && (
                    <h3 className="border-b border-slate-200/60 bg-slate-100/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400">
                      Everything else
                    </h3>
                  )}

                  <div
                    data-conversation-id={conv.id}
                    data-last-message-at={conv.last_message_at}
                    className={cn(
                      'group relative border-b border-slate-200/60 transition-colors duration-150 dark:border-white/5',
                      active
                        ? 'bg-white before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-teal-500 dark:bg-[#101820]'
                        : 'hover:bg-white/80 dark:hover:bg-white/[0.04]',
                      unread && !active && 'bg-teal-50/40 dark:bg-teal-500/[0.06]',
                      checked && 'bg-teal-50/80 dark:bg-teal-900/30',
                    )}
                  >
                    {/* The row's click target is an overlay sibling rather than a
                        wrapper, because every quick action is a real <button> and a
                        button inside a button is invalid HTML that breaks
                        hydration. This was fixed once already — keep the shape. */}
                    <button
                      type="button"
                      onClick={() => handleRowActivate(conv)}
                      aria-current={active ? 'true' : undefined}
                      className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                    >
                      <span className="sr-only">
                        {selectionActive
                          ? `${checked ? 'Deselect' : 'Add to selection'}: ${sender}`
                          : `Open conversation from ${sender}: ${conv.subject || 'No subject'}${
                              unread ? ' — unread' : ''
                            }`}
                      </span>
                    </button>

                    <div
                      className={cn(
                        'pointer-events-none relative z-10 flex items-start text-left',
                        rowStyle.row,
                        rowStyle.gap,
                      )}
                    >
                      <div className={cn('relative shrink-0', rowStyle.lead)}>
                        {rowStyle.avatar && !checked && !selectionActive && (
                          <Avatar className={cn('absolute inset-0', rowStyle.lead)}>
                            <AvatarFallback
                              className={cn('text-xs font-medium', CHANNEL_COLORS[conv.channel])}
                            >
                              {getInitials(conv.contact_name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            stop(e);
                            toggleSelect(conv.id);
                          }}
                          aria-label={`${checked ? 'Deselect' : 'Select'}: ${sender}`}
                          aria-pressed={checked}
                          className={cn(
                            'pointer-events-auto absolute inset-0 flex items-center justify-center rounded-md transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
                            // An unchecked column of empty boxes reads as a form,
                            // not a mailbox, so it only shows on hover/focus until
                            // the user is actually selecting.
                            checked || selectionActive
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                            // Only mask when there is really an avatar behind it.
                            rowStyle.avatar &&
                              !checked &&
                              !selectionActive &&
                              'bg-white/85 dark:bg-slate-900/85',
                          )}
                        >
                          {checked ? (
                            <CheckSquare className="h-4 w-4 text-teal-600" aria-hidden />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400" aria-hidden />
                          )}
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          {unread && (
                            <span
                              className="mb-px h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                              aria-hidden
                            />
                          )}
                          <span
                            className={cn(
                              // leading-tight across all three lines is what
                              // turns "six emails fit" into eleven.
                              'truncate text-[13px] leading-tight',
                              unread
                                ? 'font-bold text-slate-900 dark:text-white'
                                : 'font-medium text-slate-700 dark:text-slate-300',
                            )}
                          >
                            {sender}
                          </span>
                          {external && (
                            <span
                              className="shrink-0 rounded border border-slate-300/80 bg-slate-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-400"
                              title="Sender is outside your organisation"
                            >
                              External
                            </span>
                          )}
                          {channelGlyph && (
                            <span
                              className={cn('shrink-0 rounded px-1 text-[9px]', CHANNEL_COLORS[conv.channel])}
                              aria-hidden
                            >
                              {channelGlyph}
                            </span>
                          )}
                          <span className="ml-auto flex shrink-0 items-center gap-1">
                            {important && (
                              <span className="text-red-500 dark:text-red-400" title="High importance">
                                <AlertCircle className="h-3 w-3" aria-hidden />
                                <span className="sr-only">High importance</span>
                              </span>
                            )}
                            {attachments && (
                              <span className="text-slate-400" title="Has attachments">
                                <Paperclip className="h-3 w-3" aria-hidden />
                                <span className="sr-only">Has attachments</span>
                              </span>
                            )}
                            <span className="text-[11px] tabular-nums text-slate-500">
                              {formatTime(conv.last_message_at)}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          <p
                            className={cn(
                              'truncate text-[13px] leading-tight',
                              unread
                                ? 'font-semibold text-slate-800 dark:text-slate-100'
                                : 'text-slate-600 dark:text-slate-400',
                            )}
                          >
                            {conv.subject || 'No subject'}
                          </p>
                          <span className="ml-auto flex shrink-0 items-center gap-1">
                            {/* Only a status worth interrupting for gets a chip. */}
                            {conv.status !== 'open' && (
                              <span
                                className={cn(
                                  'rounded-full px-1.5 text-[9px] font-medium uppercase tracking-wide',
                                  STATUS_STYLES[conv.status],
                                )}
                              >
                                {STATUS_LABELS[conv.status]}
                              </span>
                            )}
                            {labels.slice(0, MAX_VISIBLE_LABELS).map((label, i) => (
                              <span
                                key={`${label.name}-${i}`}
                                className="max-w-[5rem] truncate rounded-full px-1.5 text-[9px] font-medium"
                                style={{ backgroundColor: `${label.color}20`, color: label.color }}
                              >
                                {label.name}
                              </span>
                            ))}
                            {labels.length > MAX_VISIBLE_LABELS && (
                              <span className="text-[9px] font-medium text-slate-500">
                                +{labels.length - MAX_VISIBLE_LABELS}
                              </span>
                            )}
                            {flagged && (
                              <span className="text-amber-500" title="Flagged">
                                <Flag className="h-3 w-3 fill-current" aria-hidden />
                                <span className="sr-only">Flagged</span>
                              </span>
                            )}
                          </span>
                        </div>

                        {rowStyle.preview && (
                          <p className="truncate text-[12px] leading-tight text-slate-500 dark:text-slate-500">
                            {conv.preview || 'No preview'}
                          </p>
                        )}
                      </div>

                      <div
                        className={cn(
                          'pointer-events-auto absolute right-1 top-1 z-20 flex items-center gap-0.5 rounded-md border border-slate-200/80 bg-white/95 p-0.5 shadow-sm dark:border-white/10 dark:bg-[#0e1720]/95',
                          // Hover is a desktop-only affordance, so on touch and
                          // narrow screens the cluster is simply always there.
                          'transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100',
                        )}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            stop(e);
                            onTogglePin(conv.id);
                          }}
                          aria-label={`${pinned ? 'Unpin' : 'Pin'}: ${sender}`}
                          aria-pressed={pinned}
                          title={pinned ? 'Unpin' : 'Pin to top'}
                          className={cn(ROW_ACTION, pinned && 'text-teal-600 dark:text-teal-400')}
                        >
                          {pinned ? (
                            <PinOff className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Pin className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            stop(e);
                            onToggleFlag(conv);
                          }}
                          aria-label={`${flagged ? 'Clear flag' : 'Flag'}: ${sender}`}
                          aria-pressed={flagged}
                          title={flagged ? 'Clear flag' : 'Flag'}
                          className={cn(ROW_ACTION, flagged && 'text-amber-500')}
                        >
                          <Flag className={cn('h-3.5 w-3.5', flagged && 'fill-current')} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            stop(e);
                            onToggleRead(conv);
                          }}
                          aria-label={`${unread ? 'Mark read' : 'Mark unread'}: ${sender}`}
                          title={unread ? 'Mark read' : 'Mark unread'}
                          className={ROW_ACTION}
                        >
                          {unread ? (
                            <MailOpen className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Mail className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            stop(e);
                            onArchive(conv);
                          }}
                          aria-label={`Archive: ${sender}`}
                          title="Archive"
                          className={ROW_ACTION}
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            stop(e);
                            onTrash(conv);
                          }}
                          aria-label={`Delete: ${sender}`}
                          title="Delete"
                          className={cn(ROW_ACTION, 'hover:text-red-600 dark:hover:text-red-400')}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {hasMore && onLoadMore && (
              <div className="p-2">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loading}
                  className="w-full rounded-md border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:border-white/10 dark:bg-[#0d1620] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  {loading ? 'Loading…' : 'Load older conversations'}
                </button>
              </div>
            )}

            {filteredOutCount > 0 && (
              <p className="px-3 pb-3 text-center text-[11px] text-slate-500">
                {filteredOutCount} {pluralize('conversation', filteredOutCount)} hidden by the
                Filter menu.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
});
