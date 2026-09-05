/**
 * Per-user inbox preferences — "the mailbox looks the way I left it".
 *
 * Stored in `profiles.ui_preferences.inbox_prefs` through the existing
 * `/api/crm/ui-preferences` PATCH (it merges top-level keys and passes unknown
 * keys through), with a localStorage mirror so the first paint is already the
 * user's layout instead of the default one. Same contract as
 * `lib/crm/list-preferences.ts`; nothing here needs a migration.
 *
 * Everything is pure so it can be unit-tested. `useInboxPrefs` owns the React
 * half.
 */

export const INBOX_PREFS_VERSION = 1 as const;

/** Where the open email renders relative to the list. */
export type ReadingPanePosition = 'right' | 'bottom' | 'off';

/** Row height of the conversation list. */
export type InboxDensity = 'compact' | 'cozy' | 'comfortable';

/**
 * Order of messages inside an open thread.
 *
 * Outlook puts the newest message at the top and never makes you scroll to
 * find it; Gmail stacks oldest-first and anchors to the bottom. The inbox
 * shipped with the Gmail model, which is the "opposite of what it should be"
 * an Outlook user reports.
 */
export type ThreadOrder = 'newest_first' | 'oldest_first';

export type ConversationSortField =
  | 'date'
  | 'from'
  | 'subject'
  | 'unread'
  | 'attachments'
  | 'importance';

export type SortDirection = 'asc' | 'desc';

export interface ConversationSort {
  field: ConversationSortField;
  direction: SortDirection;
}

/** Outlook's list-header Filter menu. Multiple selections intersect. */
export type QuickFilterKey = 'unread' | 'flagged' | 'attachments' | 'to_me' | 'important';

export interface InboxPrefs {
  v?: typeof INBOX_PREFS_VERSION;
  reading_pane?: ReadingPanePosition;
  density?: InboxDensity;
  thread_order?: ThreadOrder;
  sort?: ConversationSort;
  quick_filters?: QuickFilterKey[];
  /** Conversation ids the user pinned to the top of the list. */
  pinned?: string[];
  /** Collapse the CRM navigation rail while the inbox is open. */
  collapse_nav_on_inbox?: boolean;
  /** ms epoch of the last write — lets the newer of server/local win. */
  updated_at?: number;
}

/**
 * Shipping defaults. `collapse_nav_on_inbox` is on because the mailbox is a
 * workspace: the CRM menu, the folder list, the conversation list and the
 * reading pane cannot all earn their width at once.
 */
export const INBOX_PREFS_DEFAULTS: Required<
  Pick<
    InboxPrefs,
    | 'reading_pane'
    | 'density'
    | 'thread_order'
    | 'sort'
    | 'quick_filters'
    | 'pinned'
    | 'collapse_nav_on_inbox'
  >
> = {
  reading_pane: 'right',
  density: 'cozy',
  thread_order: 'newest_first',
  sort: { field: 'date', direction: 'desc' },
  quick_filters: [],
  pinned: [],
  collapse_nav_on_inbox: true,
};

/** Above this many pins the "pinned" band stops being a shortcut. */
export const MAX_PINNED_CONVERSATIONS = 50;

const READING_PANES: ReadonlySet<string> = new Set<ReadingPanePosition>(['right', 'bottom', 'off']);
const DENSITIES: ReadonlySet<string> = new Set<InboxDensity>(['compact', 'cozy', 'comfortable']);
const THREAD_ORDERS: ReadonlySet<string> = new Set<ThreadOrder>(['newest_first', 'oldest_first']);
const SORT_FIELDS: ReadonlySet<string> = new Set<ConversationSortField>([
  'date',
  'from',
  'subject',
  'unread',
  'attachments',
  'importance',
]);
const DIRECTIONS: ReadonlySet<string> = new Set<SortDirection>(['asc', 'desc']);
const QUICK_FILTERS: ReadonlySet<string> = new Set<QuickFilterKey>([
  'unread',
  'flagged',
  'attachments',
  'to_me',
  'important',
]);

export const isReadingPanePosition = (v: unknown): v is ReadingPanePosition =>
  typeof v === 'string' && READING_PANES.has(v);
export const isInboxDensity = (v: unknown): v is InboxDensity =>
  typeof v === 'string' && DENSITIES.has(v);
export const isThreadOrder = (v: unknown): v is ThreadOrder =>
  typeof v === 'string' && THREAD_ORDERS.has(v);
export const isConversationSortField = (v: unknown): v is ConversationSortField =>
  typeof v === 'string' && SORT_FIELDS.has(v);
export const isSortDirection = (v: unknown): v is SortDirection =>
  typeof v === 'string' && DIRECTIONS.has(v);
export const isQuickFilterKey = (v: unknown): v is QuickFilterKey =>
  typeof v === 'string' && QUICK_FILTERS.has(v);

function normalizeSort(value: unknown): ConversationSort | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (!isConversationSortField(raw.field)) return undefined;
  return {
    field: raw.field,
    direction: isSortDirection(raw.direction) ? raw.direction : 'desc',
  };
}

/**
 * Coerce whatever is in the profile blob into a shape the UI can trust.
 *
 * Unknown or malformed keys are dropped rather than defaulted in place, so a
 * caller can still tell "the user has no opinion" from "the user chose the
 * default" — that distinction is what lets defaults change later without
 * overriding a deliberate choice.
 */
export function normalizeInboxPrefs(value: unknown): InboxPrefs {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const out: InboxPrefs = { v: INBOX_PREFS_VERSION };

  if (isReadingPanePosition(raw.reading_pane)) out.reading_pane = raw.reading_pane;
  if (isInboxDensity(raw.density)) out.density = raw.density;
  if (isThreadOrder(raw.thread_order)) out.thread_order = raw.thread_order;

  const sort = normalizeSort(raw.sort);
  if (sort) out.sort = sort;

  if (Array.isArray(raw.quick_filters)) {
    const filters = [...new Set(raw.quick_filters.filter(isQuickFilterKey))];
    if (filters.length > 0) out.quick_filters = filters;
  }

  if (Array.isArray(raw.pinned)) {
    const pinned = [
      ...new Set(raw.pinned.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    ].slice(0, MAX_PINNED_CONVERSATIONS);
    if (pinned.length > 0) out.pinned = pinned;
  }

  if (typeof raw.collapse_nav_on_inbox === 'boolean') {
    out.collapse_nav_on_inbox = raw.collapse_nav_on_inbox;
  }

  if (typeof raw.updated_at === 'number' && Number.isFinite(raw.updated_at)) {
    out.updated_at = raw.updated_at;
  }

  return out;
}

/** Saved prefs over shipping defaults. Always safe to read. */
export function resolveInboxPrefs(saved: InboxPrefs | null | undefined): Required<
  Omit<InboxPrefs, 'v' | 'updated_at'>
> {
  const prefs = saved ?? {};
  return {
    reading_pane: prefs.reading_pane ?? INBOX_PREFS_DEFAULTS.reading_pane,
    density: prefs.density ?? INBOX_PREFS_DEFAULTS.density,
    thread_order: prefs.thread_order ?? INBOX_PREFS_DEFAULTS.thread_order,
    sort: prefs.sort ?? INBOX_PREFS_DEFAULTS.sort,
    quick_filters: prefs.quick_filters ?? INBOX_PREFS_DEFAULTS.quick_filters,
    pinned: prefs.pinned ?? INBOX_PREFS_DEFAULTS.pinned,
    collapse_nav_on_inbox:
      prefs.collapse_nav_on_inbox ?? INBOX_PREFS_DEFAULTS.collapse_nav_on_inbox,
  };
}

/** Merge a partial change, stamping the write clock. */
export function mergeInboxPrefs(current: InboxPrefs | null | undefined, patch: InboxPrefs): InboxPrefs {
  return normalizeInboxPrefs({
    ...(current ?? {}),
    ...patch,
    v: INBOX_PREFS_VERSION,
    updated_at: Date.now(),
  });
}

/**
 * Same layout? Compared ignoring the write clock, so a no-op save never fires
 * a PATCH and never re-renders the list.
 */
export function inboxPrefsEqual(a: InboxPrefs | null | undefined, b: InboxPrefs | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const left = resolveInboxPrefs(a);
  const right = resolveInboxPrefs(b);
  return (
    left.reading_pane === right.reading_pane &&
    left.density === right.density &&
    left.thread_order === right.thread_order &&
    left.sort.field === right.sort.field &&
    left.sort.direction === right.sort.direction &&
    left.collapse_nav_on_inbox === right.collapse_nav_on_inbox &&
    left.quick_filters.length === right.quick_filters.length &&
    left.quick_filters.every((f, i) => f === right.quick_filters[i]) &&
    left.pinned.length === right.pinned.length &&
    left.pinned.every((id, i) => id === right.pinned[i])
  );
}

/** Newer wins, so a second tab cannot resurrect a layout the user just changed. */
export function pickFresherInboxPrefs(
  a: InboxPrefs | null | undefined,
  b: InboxPrefs | null | undefined,
): InboxPrefs {
  if (!a) return b ?? {};
  if (!b) return a;
  return (b.updated_at ?? 0) > (a.updated_at ?? 0) ? b : a;
}

/**
 * localStorage key, scoped by profile so user B never hydrates user A's
 * layout on a shared browser. Without a profile id there is no safe key.
 */
export function inboxPrefsStorageKey(profileId: string): string {
  return `crm:inbox-prefs:v${INBOX_PREFS_VERSION}:u:${profileId}`;
}

/** Toggle one pin, keeping the newest pin first and honouring the cap. */
export function togglePinned(pinned: readonly string[], conversationId: string): string[] {
  if (pinned.includes(conversationId)) {
    return pinned.filter((id) => id !== conversationId);
  }
  return [conversationId, ...pinned].slice(0, MAX_PINNED_CONVERSATIONS);
}

/** Toggle one quick filter; order is irrelevant because they intersect. */
export function toggleQuickFilter(
  filters: readonly QuickFilterKey[],
  key: QuickFilterKey,
): QuickFilterKey[] {
  return filters.includes(key) ? filters.filter((f) => f !== key) : [...filters, key];
}
