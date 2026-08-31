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

/** "Template applied" — successful apply of an existing thing. */
export function applied(noun: string): string {
  return `${cap(unpunct(noun))} applied`;
}

/**
 * Error copy that names the action, the reason (if known) and a next step.
 *
 *   failed('save the note')                     → "Couldn't save the note."
 *   failed('save the note', 'name already taken')
 *                                               → "Couldn't save the note — name already taken."
 *   failed('save the note', undefined, 'Try again')
 *                                               → "Couldn't save the note. Try again."
 *   failed('save the note', new TypeError('Failed to fetch'), 'Try again')
 *                                               → "Couldn't save the note — no connection. Try again."
 *
 * `reason` accepts an Error, a Supabase/Postgrest error object (`{ message,
 * code?, status? }`) or a string so callers can pass `err` straight through;
 * empty/undefined reasons are dropped, never printed as "undefined".
 *
 * Reasons are humanised (FB-9): RLS / permission / 403 / 42501 read "you
 * don't have access to this record", network failures "no connection",
 * timeouts "the request timed out", HTTP 5xx / HTML error pages "server
 * error"; PGRST/SQLSTATE codes and stack prefixes are dropped, useful server
 * validation text is kept, and the result is capped at ≈80 chars with '…'.
 */
export function failed(action: string, reason?: unknown, next?: string): string {
  const verb = stripFailurePrefix(unpunct(action));
  const reasonText = usefulReason(reasonToInput(reason), verb);
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

/** Longest reason we will print after the em dash before trimming with '…'. */
export const FAILED_REASON_MAX_CHARS = 80;

/**
 * The human wording for each error family `failed()` recognises. Exported so
 * tests (and any caller that wants to special-case a family) share one string.
 */
export const FAILED_REASON = {
  noAccess: "you don't have access to this record",
  offline: 'no connection',
  timedOut: 'the request timed out',
  serverError: 'server error',
  sessionExpired: 'your session expired — sign in again',
  notFound: "that record wasn't found",
  duplicate: 'that value is already in use',
} as const;

/** What `reason` boils down to once Error / Postgrest / string shapes are unwrapped. */
interface ReasonInput {
  text: string | null;
  /** SQLSTATE / PGRST / app error code when the object carried one. */
  code: string | null;
  /** HTTP status when the object carried one (AuthApiError, fetch wrappers). */
  status: number | null;
}

const EMPTY_REASON: ReasonInput = { text: null, code: null, status: null };

function nonEmpty(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/**
 * Accepts a string, an Error (message; `code`/`status` read when present, as
 * on Supabase's AuthApiError / FunctionsHttpError) or a plain error object
 * such as PostgrestError `{ message, code, details, hint }` or an API body
 * `{ error: string }`. Anything else is treated as "no reason".
 */
function reasonToInput(reason: unknown): ReasonInput {
  if (reason == null) return EMPTY_REASON;
  if (typeof reason === 'string') return { text: nonEmpty(reason), code: null, status: null };
  if (typeof reason !== 'object') return EMPTY_REASON;
  const obj = reason as Record<string, unknown>;
  const text =
    nonEmpty(obj.message) ??
    nonEmpty(obj.error_description) ??
    nonEmpty(obj.error) ??
    nonEmpty(obj.details) ??
    null;
  const code =
    typeof obj.code === 'string'
      ? nonEmpty(obj.code)
      : typeof obj.code === 'number'
        ? String(obj.code)
        : null;
  const statusRaw = obj.status ?? obj.statusCode;
  const status =
    typeof statusRaw === 'number' && Number.isFinite(statusRaw) ? statusRaw : null;
  return { text, code, status };
}

/** `{"error":"Name is required"}` → "Name is required"; non-JSON passes through. */
function unwrapJsonBody(text: string): string {
  if (!/^\s*[{[]/.test(text)) return text;
  try {
    const parsed = JSON.parse(text) as unknown;
    const inner = reasonToInput(parsed).text;
    return inner ?? text;
  } catch {
    return text;
  }
}

/**
 * Map an error onto one of the FAILED_REASON families, or null when it is
 * free text worth showing (server validation such as "Email is required").
 * Checks run in precedence order: offline → timed out → no access → session →
 * not found → duplicate → server error. Patterns are deliberately narrow so
 * validation text that merely mentions a word ("Timeout must be…") survives.
 */
function classifyReason(text: string, code: string | null, status: number | null): string | null {
  const t = text;
  // Network: the browser never got an answer.
  if (
    /\b(failed to fetch|networkerror|network error|network request failed|load failed|reach the server|could not connect|connection refused|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|net::ERR_)/i.test(t) ||
    /\b(you are|you're|you appear to be) offline\b/i.test(t)
  ) {
    return FAILED_REASON.offline;
  }
  // Timeouts: whole-message "timeout" forms, "timed out", gateway/statement timeouts.
  if (
    status === 504 ||
    status === 408 ||
    code === '57014' ||
    /\b(timed out|statement timeout|gateway timeout|request timeout|upstream timeout|ETIMEDOUT)\b/i.test(t) ||
    /^(?:(?:network|connection|request|fetch|gateway|upstream)\s+)?time\s?out$/i.test(t) ||
    /\b(?:HTTP|status(?: code)?|error)\s*:?\s*(?:504|408)\b/i.test(t)
  ) {
    return FAILED_REASON.timedOut;
  }
  // Permissions: RLS, SQLSTATE 42501, HTTP 403, server-side "not allowed" phrasings.
  if (
    status === 403 ||
    code === '42501' ||
    code === 'PGRST301' ||
    /\b(row[- ]level security|permission denied|insufficient[_ ]privilege|insufficient permissions?|access denied|forbidden|42501|not (?:allowed|authori[sz]ed|permitted) to|do(?:es)?n'?t have (?:permission|access)|no (?:permission|access) to)\b/i.test(t) ||
    /\b(?:HTTP|status(?: code)?|error)\s*:?\s*403\b/i.test(t)
  ) {
    return FAILED_REASON.noAccess;
  }
  // Session: the server no longer knows who we are.
  if (
    status === 401 ||
    /\b(jwt expired|invalid jwt|not authenticated|session expired|auth session missing|refresh token not found)\b/i.test(t) ||
    /^unauthori[sz]ed$/i.test(t) ||
    /\b(?:HTTP|status(?: code)?|error)\s*:?\s*401\b/i.test(t)
  ) {
    return FAILED_REASON.sessionExpired;
  }
  // PostgREST `.single()` miss — the raw message is meaningless to a person.
  if (code === 'PGRST116' || /\bPGRST116\b|JSON object requested, multiple \(or no\) rows/i.test(t)) {
    return FAILED_REASON.notFound;
  }
  // Unique-constraint violation: "duplicate key value violates unique constraint "x"".
  if (code === '23505' || /duplicate key value violates unique constraint/i.test(t)) {
    return FAILED_REASON.duplicate;
  }
  // Server errors: HTTP 5xx (status, "HTTP 500", bare "500 …") or an HTML error page.
  if (
    (status != null && status >= 500 && status <= 599) ||
    /^\s*<(?:!doctype|html)/i.test(t) ||
    /\b(internal server error|bad gateway|service unavailable)\b/i.test(t) ||
    /\b(?:HTTP|status(?: code)?|error)\s*:?\s*5\d\d\b/i.test(t) ||
    /^5\d\d\b/.test(t)
  ) {
    return FAILED_REASON.serverError;
  }
  return null;
}

/** Drop "Error: ", "PostgrestError: ", "[PGRST301] ", "23505: ", "(code 42501)" noise around free text. */
function stripCodeNoise(text: string): string {
  let t = text;
  // Error-class prefixes from stringified errors / stack first lines.
  t = t.replace(/^(?:[A-Za-z]*Error|Exception)\s*:\s+/, '');
  // Leading code tokens: "PGRST116: …", "[23505] …", "HTTP 400: …", "400 - …".
  // A bare code needs a separator after it so "100 rows skipped" survives;
  // a bracketed one does not.
  t = t.replace(
    /^(?:(?:\[(?:PGRST\d{3}|\d{2}[0-9A-Z]{3}|HTTP\s*\d{3}|\d{3})\]\s*(?::|;|[-–—])?|(?:PGRST\d{3}|\d{2}[0-9A-Z]{3}|HTTP\s*\d{3}|\d{3})\s*(?::|;|[-–—]))\s*)+/i,
    '',
  );
  // Trailing "(code PGRST116)" / "[23505]" / "(HTTP 500)".
  t = t.replace(/\s*[[(]\s*(?:code[:\s]*)?(?:PGRST\d{3}|\d{2}[0-9A-Z]{3}|HTTP\s*\d{3})\s*[\])]\s*$/i, '');
  // A reason that is only a code carries nothing for the reader.
  if (/^\[?(?:PGRST\d{3}|\d{2}[0-9A-Z]{3}|HTTP\s*\d{3}|\d{3})\]?$/i.test(t.trim())) return '';
  return t.trim();
}

/** Keep the first line, collapse whitespace, and trim to the cap on a word boundary with '…'. */
function tidyAndCap(text: string): string {
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const collapsed = firstLine.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= FAILED_REASON_MAX_CHARS) return collapsed;
  const cut = collapsed.slice(0, FAILED_REASON_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  const head = lastSpace > FAILED_REASON_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s,;:–—-]+$/, '')}…`;
}

/**
 * Callers frequently pass a server error like "Failed to create module" as
 * the reason for the action "create the module", which would render
 * "Couldn't create the module — Failed to create module." Strip the failure
 * prefix from the reason and drop it entirely when what is left only repeats
 * the action (adds no information). Recognised error families are replaced by
 * their human wording (see FAILED_REASON); everything else is de-noised and
 * capped.
 */
function usefulReason(input: ReasonInput, verb: string): string | null {
  const raw = input.text ? unwrapJsonBody(input.text) : null;
  // Classify on the full raw text first so "Failed to save note: new row
  // violates row-level security…" lands on the family, not the lead-in.
  const family = classifyReason(raw ?? '', input.code, input.status);
  if (family) return family;
  if (!raw) return null;
  const stripped = stripCodeNoise(stripFailurePrefix(unpunct(raw)));
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
  const detail = sep && repeatsAction(sep[1]) && sep[2].trim() ? sep[2].trim() : stripped;
  const tidy = tidyAndCap(stripCodeNoise(detail));
  return tidy.length > 0 ? tidy : null;
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

export interface AddedWithActionToast {
  /** "Member added" */
  title: string;
  /** Optional honest note under the title (e.g. the Members/enrollment caveat). */
  description?: string;
  /** Label for the sonner `action` button — "View in list" by default. */
  actionLabel: string;
}

/** The one wording for "saved in Contacts, but you are looking at Members" (D1). */
export const MEMBERS_FILLS_FROM_ENROLLMENT =
  'Saved in Contacts — Members fills from enrollment, so it is not listed there yet.';

/**
 * Create success with a follow-up action (D1 / TE-4): "Member added" + a
 * sonner `action` labelled "View in list" that returns to the originating
 * list. Title stays exactly `added(noun)` so every "<Noun> added" toast still
 * reads the same; the action is additive.
 *
 *   const c = addedWithAction('Member');
 *   toast.success(c.title, { description: c.description,
 *     action: { label: c.actionLabel, onClick: () => router.push(href) } });
 */
export function addedWithAction(
  noun: string,
  opts: { actionLabel?: string; note?: string } = {},
): AddedWithActionToast {
  const label = opts.actionLabel ? cap(unpunct(opts.actionLabel)) : 'View in list';
  const note = opts.note?.trim();
  return note
    ? { title: added(noun), description: note, actionLabel: label }
    : { title: added(noun), actionLabel: label };
}

export interface MergedIntoToast {
  /** 'That record was merged into "Jane Doe"' — or just 'That record was merged'. */
  title: string;
  /** What happened next, so the URL change is never a surprise. */
  description: string;
}

/**
 * The one wording for a stale record URL that has since been merged away.
 * Two callers, one voice: the edit page's stale-URL recovery (still
 * navigating → `navigating: true`) and MergedFromToast (already landed on the
 * keeper). The keeper's name is quoted when known and dropped when not — it
 * is never printed as "undefined".
 *
 *   mergedInto('Jane Doe', { navigating: true })
 *     → { title: 'That record was merged into "Jane Doe"',
 *         description: 'Opening the current version…' }
 *   mergedInto(null)
 *     → { title: 'That record was merged',
 *         description: "You're viewing the current version." }
 */
export function mergedInto(
  keeperTitle?: string | null,
  opts: { navigating?: boolean } = {},
): MergedIntoToast {
  const name = keeperTitle?.trim();
  return {
    title: name ? `That record was merged into "${name}"` : 'That record was merged',
    description: opts.navigating
      ? 'Opening the current version…'
      : "You're viewing the current version.",
  };
}

/** Imported Members twin opened — notes live on the Contact. */
export function openedContactTwin(keeperTitle?: string | null): MergedIntoToast {
  const name = keeperTitle?.trim();
  return {
    title: name ? `Opened the Contact record for ${name}` : 'Opened the Contact record',
    description: 'Notes and history live here, not on the imported Member copy.',
  };
}

export const toastCopy = {
  saved,
  added,
  updated,
  deleted,
  applied,
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
  addedWithAction,
  mergedInto,
  openedContactTwin,
};
