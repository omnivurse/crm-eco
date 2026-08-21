/**
 * Default list-view columns for a module that has no saved crm_view (or whose
 * active view carries no column list).
 *
 * Without this, list surfaces fall back to *every* field of the module as a
 * column — e.g. members (91 fields, 0 views) renders a ~16,500px-wide table and
 * the horizontal scrollbar becomes unusable. This picks a small, sensible
 * subset instead. A real default view is the long-term fix; this is the safety
 * net.
 *
 * Pure module — safe to import from client and server code alike.
 */

import {
  isOwnershipListColumnKey,
  preferredOwnershipListColumnKey,
} from './ownership-field-dedupe';
import { isAddressLineListColumnKey } from './address-field-dedupe';

/** Minimal shape needed to rank fields (structural subset of CrmField). */
export interface DefaultColumnCandidate {
  key: string;
  is_title_field?: boolean | null;
  is_pinned?: boolean | null;
  display_order?: number | null;
}

export const DEFAULT_LIST_COLUMN_MAX = 8;

/** Well-known identity columns, in the order they should appear if present. */
export const DEFAULT_IDENTITY_KEYS = [
  'first_name',
  'last_name',
  'member_number',
  'email',
  'phone',
] as const;

const isStatusKey = (key: string) => key === 'status' || key.endsWith('_status');

/** Ascending display_order, then pinned first, then stable by original index. */
function byDisplayOrder<T extends DefaultColumnCandidate>(fields: T[]): T[] {
  return fields
    .map((f, index) => ({ f, index }))
    .sort((a, b) => {
      const ao = a.f.display_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.f.display_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      const ap = a.f.is_pinned ? 0 : 1;
      const bp = b.f.is_pinned ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.index - b.index;
    })
    .map(({ f }) => f);
}

/**
 * Pick up to `max` column keys for a module's default list view.
 *
 * Priority: title field(s) → well-known identity keys → status-like fields
 * (`status`, `*_status`) → remaining fields by display_order (pinned first).
 * Never returns an empty array when `fields` is non-empty; returns `[]` only
 * when there are no fields at all.
 */
export function pickDefaultListColumns(
  fields: readonly DefaultColumnCandidate[],
  max: number = DEFAULT_LIST_COLUMN_MAX,
): string[] {
  const limit = Math.max(1, Math.floor(max));
  if (fields.length === 0) return [];

  // Dedupe by key, keep first occurrence.
  const seen = new Set<string>();
  const unique = fields.filter((f) => {
    if (!f.key || seen.has(f.key)) return false;
    seen.add(f.key);
    return true;
  });
  const ordered = byDisplayOrder(unique);
  const keySet = new Set(ordered.map((f) => f.key));

  const picked: string[] = [];
  const ownershipKeep = preferredOwnershipListColumnKey(keySet);
  let seenAddressLine = false;
  const push = (key: string) => {
    if (picked.length >= limit || picked.includes(key)) return;
    if (isOwnershipListColumnKey(key) && key !== ownershipKeep) return;
    if (isAddressLineListColumnKey(key)) {
      if (seenAddressLine) return;
      seenAddressLine = true;
    }
    picked.push(key);
  };

  for (const f of ordered) if (f.is_title_field) push(f.key);
  for (const key of DEFAULT_IDENTITY_KEYS) if (keySet.has(key)) push(key);
  for (const f of ordered) if (isStatusKey(f.key)) push(f.key);
  for (const f of ordered) push(f.key);

  // `ordered` is non-empty here so `picked` always has at least one entry; the
  // explicit fallback keeps the contract obvious if the ranking ever changes.
  return picked.length > 0 ? picked : ordered.slice(0, limit).map((f) => f.key);
}
