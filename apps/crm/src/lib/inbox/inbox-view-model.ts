/**
 * Pure list/thread shaping for the inbox workspace.
 *
 * The server returns one ordering (newest activity first) and one page of
 * rows. Everything an Outlook user expects on top of that — sort by sender or
 * subject, the Filter menu, a pinned band, newest-message-first threads — is
 * a view concern over rows already in memory, so it lives here rather than in
 * a component, and is unit-tested without mounting React.
 */

import type { QuickFilterKey, ConversationSort, ThreadOrder } from './inbox-prefs';

/** The conversation fields the view model reads. Structural so tests stay small. */
export interface ConversationView {
  id: string;
  subject?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  last_message_at?: string | null;
  first_message_at?: string | null;
  priority?: string | null;
  assigned_to?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  is_unread_for_user?: boolean;
}

/** The message fields the view model reads. */
export interface MessageView {
  id: string;
  direction: string;
  sent_at?: string | null;
  from_address?: string | null;
}

/** Tag value that has always meant "flagged". Kept for backward compatibility. */
export const FLAG_TAG = 'starred';

function timeOf(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * The activity time a thread should sort by.
 *
 * `inbox_conversations.last_message_at` is written by a trigger that assigns
 * `NEW.sent_at` unconditionally, so a message carrying an older Date header —
 * a delayed delivery, a provider retry, a sender whose clock is behind — drags
 * the whole thread down the list even though it just received mail. Taking the
 * high-water mark of everything we know about the thread keeps the list honest
 * on rows the database has already gotten wrong. The trigger is fixed
 * separately; this keeps existing rows sane without a backfill.
 */
export function effectiveLastActivity(
  conversation: ConversationView,
  messages?: readonly MessageView[] | null,
): number {
  let newest = Math.max(timeOf(conversation.last_message_at), timeOf(conversation.first_message_at));
  for (const message of messages ?? []) {
    newest = Math.max(newest, timeOf(message.sent_at));
  }
  return newest;
}

/** Outlook groups "Re: Invoice" with "Invoice" when sorting by subject. */
export function normalizeSubjectForSort(subject: string | null | undefined): string {
  return (subject ?? '')
    .replace(/^(\s*(re|fwd?|aw|sv|vs|antw)\s*(\[\d+\])?\s*:\s*)+/i, '')
    .trim()
    .toLowerCase();
}

export function senderLabel(conversation: ConversationView): string {
  return (conversation.contact_name || conversation.contact_email || '').trim().toLowerCase();
}

export function isFlagged(conversation: ConversationView): boolean {
  return (conversation.tags ?? []).includes(FLAG_TAG);
}

export function hasAttachments(conversation: ConversationView): boolean {
  const value = (conversation.metadata ?? {})['has_attachments'];
  return value === true || value === 'true';
}

const PRIORITY_RANK: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 };

export function priorityRank(conversation: ConversationView): number {
  return PRIORITY_RANK[(conversation.priority ?? 'normal').toLowerCase()] ?? 1;
}

export function isImportant(conversation: ConversationView): boolean {
  return priorityRank(conversation) >= 2;
}

/**
 * Does this thread pass every active quick filter?
 *
 * Outlook's Filter menu intersects: picking Unread and Flagged shows threads
 * that are both, not either.
 */
export function matchesQuickFilters(
  conversation: ConversationView,
  filters: readonly QuickFilterKey[],
  viewerProfileId?: string | null,
): boolean {
  for (const filter of filters) {
    switch (filter) {
      case 'unread':
        if (conversation.is_unread_for_user !== true) return false;
        break;
      case 'flagged':
        if (!isFlagged(conversation)) return false;
        break;
      case 'attachments':
        if (!hasAttachments(conversation)) return false;
        break;
      case 'important':
        if (!isImportant(conversation)) return false;
        break;
      case 'to_me':
        if (!viewerProfileId || conversation.assigned_to !== viewerProfileId) return false;
        break;
    }
  }
  return true;
}

/**
 * Every key below is written in DESCENDING orientation: a negative result puts
 * `a` first under `desc`, and one `flip` at the end handles `asc`. Writing them
 * the other way round is how "sort by importance" quietly lists Low first.
 */
function compareBy(sort: ConversationSort, messagesById?: ReadonlyMap<string, readonly MessageView[]>) {
  const flip = sort.direction === 'asc' ? -1 : 1;
  const recency = (a: ConversationView, b: ConversationView) =>
    effectiveLastActivity(b, messagesById?.get(b.id)) -
    effectiveLastActivity(a, messagesById?.get(a.id));

  return (a: ConversationView, b: ConversationView): number => {
    let result = 0;
    switch (sort.field) {
      case 'from':
        result = senderLabel(b).localeCompare(senderLabel(a));
        break;
      case 'subject':
        result = normalizeSubjectForSort(b.subject).localeCompare(normalizeSubjectForSort(a.subject));
        break;
      case 'unread':
        result = Number(b.is_unread_for_user === true) - Number(a.is_unread_for_user === true);
        break;
      case 'attachments':
        result = Number(hasAttachments(b)) - Number(hasAttachments(a));
        break;
      case 'importance':
        result = priorityRank(b) - priorityRank(a);
        break;
      case 'date':
      default:
        return recency(a, b) * flip || a.id.localeCompare(b.id);
    }
    if (result !== 0) return result * flip;
    // Equal keys fall back to recency — always newest first, never inverted by
    // the flip, so "sort by sender ascending" still reads newest-per-sender.
    return recency(a, b) || a.id.localeCompare(b.id);
  };
}

export interface ShapeConversationsOptions {
  sort: ConversationSort;
  quickFilters?: readonly QuickFilterKey[];
  pinned?: readonly string[];
  viewerProfileId?: string | null;
  /** Loaded messages per conversation, used to correct a rewound activity time. */
  messagesById?: ReadonlyMap<string, readonly MessageView[]>;
}

export interface ShapedConversations<T extends ConversationView> {
  pinned: T[];
  rest: T[];
  /** Pinned band first, then the rest — what the list renders. */
  all: T[];
  /** Rows hidden by the Filter menu, so the UI can say so instead of looking empty. */
  filteredOutCount: number;
}

/**
 * Apply the Filter menu, the Sort menu and the pinned band in one pass.
 *
 * Pinned rows deliberately ignore the sort field (they keep pin order, newest
 * pin first) because a pin is a manual override — re-sorting it defeats the
 * point of pinning.
 */
export function shapeConversations<T extends ConversationView>(
  conversations: readonly T[],
  options: ShapeConversationsOptions,
): ShapedConversations<T> {
  const { sort, quickFilters = [], pinned = [], viewerProfileId, messagesById } = options;

  const visible = conversations.filter((c) => matchesQuickFilters(c, quickFilters, viewerProfileId));
  const filteredOutCount = conversations.length - visible.length;

  const pinRank = new Map(pinned.map((id, index) => [id, index]));
  const pinnedRows: T[] = [];
  const restRows: T[] = [];
  for (const conversation of visible) {
    if (pinRank.has(conversation.id)) pinnedRows.push(conversation);
    else restRows.push(conversation);
  }

  pinnedRows.sort((a, b) => (pinRank.get(a.id) ?? 0) - (pinRank.get(b.id) ?? 0));
  restRows.sort(compareBy(sort, messagesById));

  return {
    pinned: pinnedRows,
    rest: restRows,
    all: [...pinnedRows, ...restRows],
    filteredOutCount,
  };
}

/**
 * Order a thread's messages for display.
 *
 * The caller keeps its own chronological array for reply targeting — the
 * newest message decides In-Reply-To and the recipient, and reversing that
 * array would answer the wrong email.
 */
export function orderThreadForDisplay<T extends MessageView>(
  messages: readonly T[],
  order: ThreadOrder,
): T[] {
  const chronological = [...messages].sort((a, b) => timeOf(a.sent_at) - timeOf(b.sent_at));
  return order === 'newest_first' ? chronological.reverse() : chronological;
}

/**
 * Is this sender outside the organisation?
 *
 * Outlook badges external mail because a member reading a shared mailbox
 * cannot otherwise tell a colleague's forward from a stranger's request, and
 * that distinction is what stops a phishing reply. Domains come from the
 * verified sending registry, so no hardcoded tenant domain is involved.
 */
export function isExternalSender(
  fromAddress: string | null | undefined,
  verifiedDomains: readonly string[],
  senderAddresses: readonly string[] = [],
): boolean {
  const address = (fromAddress ?? '').trim().toLowerCase();
  if (!address || !address.includes('@')) return false;
  if (senderAddresses.some((sender) => sender.trim().toLowerCase() === address)) return false;
  const domain = address.slice(address.lastIndexOf('@') + 1);
  if (!domain) return false;
  return !verifiedDomains.some((verified) => {
    const candidate = verified.trim().toLowerCase();
    if (!candidate) return false;
    // A verified apex also vouches for its mail subdomain (mail.example.com),
    // which is where inbound for these tenants actually lands.
    return domain === candidate || domain.endsWith(`.${candidate}`);
  });
}
