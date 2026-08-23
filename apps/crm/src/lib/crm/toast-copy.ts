/**
 * Toast copy templates — one phrasing per outcome.
 *
 * The CRM has ~700 toast calls with five wordings for "note added" and four
 * for "record saved", plus ~180 errors that begin "Failed to …" and never say
 * what to do next. These templates make the words stop drifting:
 *
 *   toast.success(toastCopy.added('Note'))              → "Note added"
 *   toast.success(toastCopy.saved('Changes'))           → "Changes saved"
 *   toast.error(toastCopy.failed('save the note', reason, 'Try again'))
 *                                                       → "Couldn't save the note — <reason>. Try again."
 *   toast.error(...toastCopy.sessionExpired(pathname))  → title + Sign in action
 *
 * Pure + isomorphic: no React, no sonner import, so it is unit-testable and
 * usable from server components that build messages for the client. Callers
 * pass the result to `toast.*` themselves.
 *
 * Adoption pattern for the remaining files (do NOT mass-edit; migrate as you
 * touch a file):
 *   - success after create   → added(noun)
 *   - success after edit     → updated(noun) (or saved('Changes') for form saves)
 *   - success after delete   → deleted(noun) (prefer undo-delete helpers when
 *                              a trash batch exists)
 *   - any caught error       → failed(action, reason?, next?) — `action` is a
 *                              verb phrase ("save the note"), `next` is what
 *                              the user can do about it
 *   - missing auth/profile   → sessionExpired(currentPath) spread into
 *                              toast.error(title, { description, action })
 */

/** Capitalise the first character only; leaves the rest untouched. */
function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Strip a trailing period so we can compose sentences without "..". */
function unpunct(s: string): string {
  return s.trim().replace(/[.!]+$/, '');
}

/** "Changes saved" / "Record saved" — successful form save. */
export function saved(noun: string): string {
  return `${cap(unpunct(noun))} saved`;
}

/** "Note added" — successful create. */
export function added(noun: string): string {
  return `${cap(unpunct(noun))} added`;
}

/** "Note updated" — successful edit of an existing thing. */
export function updated(noun: string): string {
  return `${cap(unpunct(noun))} updated`;
}

/** "Note deleted" — successful delete without an undo affordance. */
export function deleted(noun: string): string {
  return `${cap(unpunct(noun))} deleted`;
}

/**
 * Error copy that names the action, the reason (if known) and a next step.
 *
 *   failed('save the note')                     → "Couldn't save the note."
 *   failed('save the note', 'network timeout')  → "Couldn't save the note — network timeout."
 *   failed('save the note', undefined, 'Try again')
 *                                               → "Couldn't save the note. Try again."
 *   failed('save the note', 'network timeout', 'Try again')
 *                                               → "Couldn't save the note — network timeout. Try again."
 *
 * `reason` accepts an Error (message is used) so callers can pass `err`
 * straight through; empty/undefined reasons are dropped, never printed as
 * "undefined".
 */
export function failed(action: string, reason?: unknown, next?: string): string {
  const verb = stripFailurePrefix(unpunct(action));
  const reasonText = usefulReason(reasonToText(reason), verb);
  const head = reasonText
    ? `Couldn't ${verb} — ${unpunct(reasonText)}.`
    : `Couldn't ${verb}.`;
  const tail = next ? ` ${cap(unpunct(next))}.` : '';
  return head + tail;
}

/** "Failed to save note" / "Couldn't save note" → "save note". */
function stripFailurePrefix(s: string): string {
  return s.replace(/^(failed to|couldn'?t)\s+/i, '');
}

/**
 * Comparison key: lower-cased, articles + punctuation removed, whitespace
 * collapsed — so "create the module" and "Create module." read as the same.
 */
function repeatKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|this|that|your)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Callers frequently pass a server error like "Failed to create module" as
 * the reason for the action "create the module", which would render
 * "Couldn't create the module — Failed to create module." Strip the failure
 * prefix from the reason and drop it entirely when what is left only repeats
 * the action (adds no information).
 */
function usefulReason(reasonText: string | null, verb: string): string | null {
  if (!reasonText) return null;
  const stripped = stripFailurePrefix(unpunct(reasonText));
  if (!stripped) return null;
  const verbKey = repeatKey(verb);
  const repeatsAction = (text: string): boolean => {
    const key = repeatKey(text);
    return !key || key === verbKey || verbKey.includes(key);
  };
  if (repeatsAction(stripped)) return null;
  // "create module: name already taken" → keep only the detail after the
  // separator when the lead-in just repeats the action.
  const sep = stripped.match(/^(.*?)\s*(?::|;|\s[-–—]\s)\s*(.+)$/);
  if (sep && repeatsAction(sep[1]) && sep[2].trim()) return sep[2].trim();
  return stripped;
}

function reasonToText(reason: unknown): string | null {
  if (reason == null) return null;
  if (typeof reason === 'string') {
    const t = reason.trim();
    return t.length > 0 ? t : null;
  }
  if (reason instanceof Error) {
    const t = reason.message.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

export interface SessionExpiredToast {
  /** Toast title. */
  title: string;
  /** Toast description (next step in words). */
  description: string;
  /** Sign-in URL that returns to `returnPath` after login. */
  href: string;
  /** Label for the toast action button. */
  actionLabel: string;
}

/**
 * Honest replacement for `toast.error('Not authenticated')` shown to a user who
 * *was* signed in: their session expired (or the profile fetch failed). The
 * href goes to `/crm-login?redirect=<returnPath>` — `redirect` is the query
 * param `apps/crm/src/app/crm-login/page.tsx` actually reads (via
 * `safeCrmRedirect`), so after signing in the user lands back where they were.
 * Non-/crm paths fall back to `/crm` (mirrors safeCrmRedirect).
 *
 * Usage:
 *   const s = sessionExpired(pathname);
 *   toast.error(s.title, { description: s.description,
 *     action: { label: s.actionLabel, onClick: () => router.push(s.href) } });
 */
export function sessionExpired(returnPath?: string | null): SessionExpiredToast {
  const safe =
    returnPath && returnPath.startsWith('/crm') && !returnPath.startsWith('//')
      ? returnPath
      : '/crm';
  return {
    title: 'Your session expired — sign in again',
    description: 'Nothing was saved. Sign in and you will land back here.',
    href: `/crm-login?redirect=${encodeURIComponent(safe)}`,
    actionLabel: 'Sign in',
  };
}

// ── Counted / bulk / offline / progress templates ───────────────────────────
//
// Used by list pages (ModuleShell) and the undo-delete helpers so every
// "did N things" toast reads the same way:
//
//   counted('record', 1200, 'Selected')         → "Selected 1,200 records"
//   counted({ one: 'member', other: 'members' }, 1, 'Exported')
//                                               → "Exported 1 member"
//   bulkTitle('Status updated', 12)             → "Status updated · 12 records"
//   partial('Status updated', { changed: 10, skipped: 2, failed: 0 })
//                                               → { title: 'Status updated · 10 records',
//                                                   description: '2 skipped — …', tone: 'warning' }
//   queued('record', 12).title                  → "Queued — will sync when reconnected"
//   loadingCopy('Building CSV')                 → "Building CSV…"
//   viewSaved('My leads', 2).title              → 'View "My leads" saved'

/** A noun with explicit singular/plural forms (module.name / module.name_plural). */
export interface CountNoun {
  one: string;
  other: string;
}

/** Deterministic thousands grouping ("1,200") regardless of the runtime locale. */
function fmt(n: number): string {
  return Math.trunc(n).toLocaleString('en-US');
}

/**
 * Naive English pluralisation for the short nouns we toast about
 * ("record" → "records", "match" → "matches", "entry" → "entries").
 * Pass a `CountNoun` when the plural is irregular or already known
 * (module.name_plural).
 */
export function pluralize(noun: string | CountNoun, n: number): string {
  if (typeof noun !== 'string') return n === 1 ? noun.one : noun.other;
  const base = unpunct(noun);
  if (n === 1) return base;
  if (/(s|x|z|ch|sh)$/i.test(base)) return `${base}es`;
  if (/[^aeiou]y$/i.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}

/** "Exported 12 members" / "Selected 1,200 records" / "Restored 1 record". */
export function counted(noun: string | CountNoun, n: number, verb: string): string {
  return `${cap(unpunct(verb))} ${fmt(n)} ${pluralize(noun, n)}`;
}

/**
 * Bulk-action title per the owner decision (D9): plain verb phrase, middle
 * dot, count — "Status updated · 12 records", "Owner cleared · 1 record".
 */
export function bulkTitle(title: string, n: number, unit: string | CountNoun = 'record'): string {
  return `${cap(unpunct(title))} · ${fmt(n)} ${pluralize(unit, n)}`;
}

export type ToastTone = 'success' | 'warning' | 'error';

export interface PartialCounts {
  /** Rows the server actually changed. */
  changed: number;
  /** Rows the server refused (RLS / other org / already deleted). */
  skipped?: number;
  /** Rows that errored. */
  failed?: number;
}

export interface PartialToast {
  title: string;
  description?: string;
  /** Which `toast.*` to call — escalates success → warning → error. */
  tone: ToastTone;
}

/**
 * Copy for the partial-failure shape `/api/crm/records/bulk` returns. Keeps the
 * escalation tiers: any failure → error, any skip → warning, else success.
 *
 *   partial('Status updated', { changed: 12 })
 *     → { title: 'Status updated · 12 records', tone: 'success' }
 *   partial('Status updated', { changed: 10, skipped: 2 })
 *     → { …, description: '2 skipped — skipped rows may be in another org or deleted.', tone: 'warning' }
 *   partial('Status updated', { changed: 9, skipped: 2, failed: 1 })
 *     → { …, description: '2 skipped · 1 failed — failed rows were not changed. Try again.', tone: 'error' }
 *
 * `detail` is shown as the description on a clean success (e.g. `Now "Active"`).
 */
export function partial(
  title: string,
  counts: PartialCounts,
  opts: { unit?: string | CountNoun; detail?: string } = {},
): PartialToast {
  const unit = opts.unit ?? 'record';
  const changed = Math.max(0, counts.changed);
  const skipped = Math.max(0, counts.skipped ?? 0);
  const failed = Math.max(0, counts.failed ?? 0);
  const fullTitle = bulkTitle(title, changed, unit);
  const parts: string[] = [];
  if (skipped > 0) parts.push(`${fmt(skipped)} skipped`);
  if (failed > 0) parts.push(`${fmt(failed)} failed`);
  if (failed > 0) {
    return {
      title: fullTitle,
      description: `${parts.join(' · ')} — failed rows were not changed. Try again.`,
      tone: 'error',
    };
  }
  if (skipped > 0) {
    return {
      title: fullTitle,
      description: `${parts.join(' · ')} — skipped rows may be in another org or deleted.`,
      tone: 'warning',
    };
  }
  const detail = opts.detail ? unpunct(opts.detail) : '';
  return detail
    ? { title: fullTitle, description: `${cap(detail)}.`, tone: 'success' }
    : { title: fullTitle, tone: 'success' };
}

export interface QueuedToast {
  title: string;
  description: string;
}

/**
 * The one offline wording. Replaces "Queued for 3 records — will sync…",
 * "Task saved offline — will sync…", "Tags saved offline — will sync…".
 *
 *   queued()               → description "Saved on this device — it will sync when you're back online."
 *   queued('task')         → description "Task saved on this device — it will sync when you're back online."
 *   queued('record', 12)   → description "12 records will update when you're back online."
 */
export function queued(noun?: string | CountNoun, n?: number): QueuedToast {
  const title = 'Queued — will sync when reconnected';
  if (typeof n === 'number' && noun) {
    return { title, description: `${fmt(n)} ${pluralize(noun, n)} will update when you're back online.` };
  }
  if (noun) {
    const label = typeof noun === 'string' ? unpunct(noun) : noun.one;
    return { title, description: `${cap(label)} saved on this device — it will sync when you're back online.` };
  }
  return { title, description: "Saved on this device — it will sync when you're back online." };
}

/** "Building CSV…" — progress/loading copy with the single-glyph ellipsis. */
export function loadingCopy(what: string): string {
  return `${cap(unpunct(what).replace(/(\.\.\.|…)$/, '').trimEnd())}…`;
}

export interface ViewSavedToast {
  title: string;
  description: string;
}

/** 'View "My leads" saved' + "2 filters applied" / "No filters — shows every record". */
export function viewSaved(name: string, filterCount: number): ViewSavedToast {
  const trimmed = name.trim();
  const title = trimmed ? `View "${trimmed}" saved` : 'View saved';
  const description =
    filterCount > 0
      ? `${fmt(filterCount)} ${pluralize('filter', filterCount)} applied`
      : 'No filters — shows every record';
  return { title, description };
}

/** "Choose an owner first" — validation copy for a bulk dialog with nothing picked. */
export function chooseFirst(what: string): string {
  return `Choose ${unpunct(what)} first`;
}

/**
 * Select-all hit the server cap: "Selected first 5,000 of 12,340 matches" +
 * how to act on the rest.
 */
export function cappedSelection(n: number, total: number): { title: string; description: string } {
  return {
    title: `Selected first ${fmt(n)} of ${fmt(total)} ${pluralize('match', total)}`,
    description: 'Narrow your filters to act on all rows.',
  };
}

/** "Exported all matching members" + the scope reminder. */
export function exportedAll(noun: string | CountNoun): { title: string; description: string } {
  const plural = typeof noun === 'string' ? pluralize(noun, 2) : noun.other;
  return {
    title: `Exported all matching ${plural}`,
    description: 'Same filters and sort as this list (up to 100k rows).',
  };
}

/** "Moved to Trash" / "Moved to Trash · 12 records" (undo-delete title). */
export function movedToTrash(n = 1, unit: string | CountNoun = 'record'): string {
  return n > 1 ? bulkTitle('Moved to Trash', n, unit) : 'Moved to Trash';
}

/** "Record restored" — successful Undo of a delete. */
export function restored(noun: string): string {
  return `${cap(unpunct(noun))} restored`;
}

export const toastCopy = {
  saved,
  added,
  updated,
  deleted,
  restored,
  failed,
  sessionExpired,
  counted,
  pluralize,
  bulkTitle,
  partial,
  queued,
  loadingCopy,
  viewSaved,
  chooseFirst,
  cappedSelection,
  exportedAll,
  movedToTrash,
};
