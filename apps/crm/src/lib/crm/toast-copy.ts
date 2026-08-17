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

export const toastCopy = { saved, added, updated, deleted, failed, sessionExpired };
