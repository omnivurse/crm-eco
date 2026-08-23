/**
 * CreateIntent — one decision for every "create a person" entry.
 *
 * Invariant: contacts / members / leads open the quick drawer; full form is
 * an explicit escape (`kind: 'full'`). Deal create is blocked when the org
 * has deals disabled.
 */

import {
  isQuickCreateModuleKey,
  type QuickCreateModuleKey,
} from '@/lib/crm/quick-create-config';
import { sanitizeReturnTo } from '@/lib/crm/status-lanes';

export type CreateIntent =
  | { kind: 'quick'; moduleKey: QuickCreateModuleKey }
  | { kind: 'full'; href: string }
  | { kind: 'blocked'; reason: 'deals-disabled' };

export function resolveCreateIntent(input: {
  moduleKey: string;
  dealsEnabled?: boolean;
}): CreateIntent {
  const key = input.moduleKey.trim().toLowerCase();
  if (key === 'deals' && input.dealsEnabled === false) {
    return { kind: 'blocked', reason: 'deals-disabled' };
  }
  if (key === 'members' || key === 'contacts') {
    return { kind: 'quick', moduleKey: 'contacts' };
  }
  if (isQuickCreateModuleKey(key)) {
    return { kind: 'quick', moduleKey: key };
  }
  return { kind: 'full', href: `/crm/modules/${encodeURIComponent(key)}/new` };
}

// ── Originating list (D1 / TE-4) ─────────────────────────────────────────────
//
// After a quick-create save the toast offers "View in list". THE list is the
// one the drawer was opened from — Contacts by default (the hand-entry
// module), Members when opened from /crm/modules/members (with the honest
// note that Members fills from enrollment, so the new Contacts row is not
// there yet). "Done" after a batch returns to the same place.

/** Module list root: `/crm/modules/<key>` (optionally with a query string). */
const LIST_PATH_RE = /^\/crm\/modules\/([^/?#]+)\/?(?:\?|$)/;

/**
 * Capture the originating list URL (`pathname + search`) when the drawer
 * opens. Returns null when the drawer was not opened from a module list
 * (record page, dashboard, settings, …); callers fall back to the record's
 * own module list via `resolveCreateReturnList`.
 */
export function captureCreateOrigin(
  pathname: string | null | undefined,
  search?: string | null,
): string | null {
  if (!pathname || !LIST_PATH_RE.test(pathname)) return null;
  const qs = search ? (search.startsWith('?') ? search : `?${search}`) : '';
  return sanitizeReturnTo(`${pathname}${qs === '?' ? '' : qs}`);
}

/** Module key of a list URL captured by `captureCreateOrigin`, else null. */
export function createOriginModuleKey(origin: string | null | undefined): string | null {
  if (!origin) return null;
  const m = LIST_PATH_RE.exec(origin);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

export interface CreateReturnList {
  /** Where "View in list" / "Done" go. */
  href: string;
  /** Module key of that list. */
  moduleKey: string;
  /**
   * True when the list is Members but the record was saved in Contacts —
   * the toast must say so (Members fills from enrollment).
   */
  membersNote: boolean;
}

/**
 * Decide the list a freshly created record is "seen on" (D1 option c):
 *   - opened from the record's own module list → that list, filters kept,
 *     `page` dropped so the newest-first default shows the new row;
 *   - opened from /crm/modules/members and saved in Contacts → Members, with
 *     the honest note (`membersNote`);
 *   - anywhere else → the record's own module list (Contacts by default).
 */
export function resolveCreateReturnList(input: {
  origin: string | null | undefined;
  createdModuleKey: string;
}): CreateReturnList {
  const created = input.createdModuleKey.trim().toLowerCase() || 'contacts';
  const origin = sanitizeReturnTo(input.origin);
  const originKey = createOriginModuleKey(origin);
  if (origin && originKey) {
    if (originKey === created) {
      return { href: dropPageParam(origin), moduleKey: created, membersNote: false };
    }
    if (originKey === 'members' && created === 'contacts') {
      return { href: dropPageParam(origin), moduleKey: 'members', membersNote: true };
    }
  }
  return {
    href: `/crm/modules/${encodeURIComponent(created)}`,
    moduleKey: created,
    membersNote: false,
  };
}

/** `/crm/modules/contacts?page=3&view=x` → `/crm/modules/contacts?view=x`. */
function dropPageParam(href: string): string {
  const q = href.indexOf('?');
  if (q < 0) return href;
  const params = new URLSearchParams(href.slice(q + 1));
  params.delete('page');
  const qs = params.toString();
  return qs ? `${href.slice(0, q)}?${qs}` : href.slice(0, q);
}
