/**
 * Coverage-snapshot field order — default + per-user organizer.
 *
 * Power users want referring member in the sharing-member-id glance slot
 * (who sent them, not a duplicate ID) and the ID itself at the bottom.
 * Custom order/hidden lists persist on `profiles.ui_preferences` with a
 * localStorage mirror so the first paint already matches.
 */

export const COVERAGE_SNAPSHOT_LAYOUT_STORAGE_PREFIX = 'crm.coverage-snapshot-layout.';
export const COVERAGE_SNAPSHOT_LAYOUT_VERSION = 1 as const;

export function coverageSnapshotLayoutStorageKey(moduleKey: string): string {
  return `${COVERAGE_SNAPSHOT_LAYOUT_STORAGE_PREFIX}${moduleKey.trim()}`;
}

export function coverageSnapshotModuleLabel(moduleKey: string): string {
  const key = moduleKey.trim().toLowerCase();
  if (key === 'contacts') return 'Contacts';
  if (key === 'members') return 'Members';
  if (key === 'leads') return 'Leads';
  if (!key) return 'records';
  return key.replace(/_/g, ' ');
}

/**
 * Default glance order. Referring member sits where sharing_member_id used
 * to (after tier). Sharing member ID is last — same number often already
 * shows as Member Number.
 */
export const COVERAGE_SNAPSHOT_DEFAULT_ORDER = [
  'product',
  'product_type',
  'plan_name',
  'health_insurance_plan_name',
  'insurance_plan_name',
  'monthly_contribution',
  'monthly_share',
  'monthly_premium',
  'monthly_amount',
  'iua_amount',
  'member_tier',
  'coverage_option',
  'referring_member',
  'sharing_status',
  'sharing_effective_date',
  'health_insurance_start_date',
  'insurance_effective_date',
  'effective_date',
  'start_date',
  'producer_name',
  'producer',
  'advisor_name',
  'advisor',
  'agent',
  'lead_owner',
  'member_number',
  'e123_member_id',
  'referral_source',
  'referral',
  'sharing_member_id',
] as const;

export interface CoverageSnapshotLayoutPrefs {
  v: typeof COVERAGE_SNAPSHOT_LAYOUT_VERSION;
  order: string[];
  hidden: string[];
  updated_at?: number;
}

/** `ui_preferences.coverage_snapshot_layout` — one layout per module. */
export type CoverageSnapshotLayoutMap = Record<string, CoverageSnapshotLayoutPrefs>;

export function parseCoverageSnapshotLayout(raw: unknown): CoverageSnapshotLayoutPrefs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const order = Array.isArray(rec.order)
    ? rec.order.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    : [];
  const hidden = Array.isArray(rec.hidden)
    ? rec.hidden.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    : [];
  if (order.length === 0 && hidden.length === 0) return null;
  return {
    v: COVERAGE_SNAPSHOT_LAYOUT_VERSION,
    order,
    hidden,
    updated_at: typeof rec.updated_at === 'number' ? rec.updated_at : undefined,
  };
}

function looksLikeModuleLayoutMap(raw: Record<string, unknown>): boolean {
  return Object.entries(raw).some(
    ([key, value]) =>
      key !== 'v' &&
      key !== 'order' &&
      key !== 'hidden' &&
      key !== 'updated_at' &&
      parseCoverageSnapshotLayout(value) !== null,
  );
}

/** Decode the per-module map. A legacy unscoped `{order,hidden}` blob is ignored. */
export function parseCoverageSnapshotLayoutMap(raw: unknown): CoverageSnapshotLayoutMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  if (!looksLikeModuleLayoutMap(rec)) return {};
  const out: CoverageSnapshotLayoutMap = {};
  for (const [key, value] of Object.entries(rec)) {
    const moduleKey = key.trim();
    if (!moduleKey) continue;
    const parsed = parseCoverageSnapshotLayout(value);
    if (parsed) out[moduleKey] = parsed;
  }
  return out;
}

export function mergeCoverageSnapshotLayoutMap(
  current: unknown,
  moduleKey: string,
  prefs: CoverageSnapshotLayoutPrefs | null,
): CoverageSnapshotLayoutMap {
  const map = parseCoverageSnapshotLayoutMap(current);
  const key = moduleKey.trim();
  if (!key) return map;
  if (!prefs || (prefs.order.length === 0 && prefs.hidden.length === 0)) {
    const next = { ...map };
    delete next[key];
    return next;
  }
  return { ...map, [key]: prefs };
}

export function readCoverageSnapshotLayout(moduleKey: string): CoverageSnapshotLayoutPrefs | null {
  if (typeof window === 'undefined' || !moduleKey.trim()) return null;
  try {
    return parseCoverageSnapshotLayout(
      JSON.parse(
        window.localStorage.getItem(coverageSnapshotLayoutStorageKey(moduleKey)) ?? 'null',
      ),
    );
  } catch {
    return null;
  }
}

export function writeCoverageSnapshotLayout(
  moduleKey: string,
  prefs: CoverageSnapshotLayoutPrefs | null,
): void {
  if (typeof window === 'undefined' || !moduleKey.trim()) return;
  try {
    const key = coverageSnapshotLayoutStorageKey(moduleKey);
    if (!prefs || (prefs.order.length === 0 && prefs.hidden.length === 0)) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(prefs));
    }
  } catch {
    /* quota / private mode */
  }
}

/** Merge stored order with keys actually on this card. Unknown keys append. */
export function normalizeCoverageSnapshotOrder(
  presentKeys: string[],
  storedOrder?: string[] | null,
  defaultOrder: readonly string[] = COVERAGE_SNAPSHOT_DEFAULT_ORDER,
): string[] {
  const present = presentKeys.filter(Boolean);
  const presentSet = new Set(present);
  const base = storedOrder?.length ? storedOrder : [...defaultOrder];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of base) {
    if (!presentSet.has(key) || seen.has(key)) continue;
    out.push(key);
    seen.add(key);
  }
  for (const key of present) {
    if (seen.has(key)) continue;
    out.push(key);
    seen.add(key);
  }
  return out;
}

export function applyCoverageSnapshotLayout<T extends { key: string }>(
  fields: T[],
  prefs: CoverageSnapshotLayoutPrefs | null,
): T[] {
  const hidden = new Set(prefs?.hidden ?? []);
  const visible = fields.filter((f) => !hidden.has(f.key));
  const order = normalizeCoverageSnapshotOrder(
    visible.map((f) => f.key),
    prefs?.order,
  );
  const rank = new Map(order.map((key, i) => [key, i]));
  return [...visible].sort((a, b) => {
    const ra = rank.get(a.key) ?? 1000;
    const rb = rank.get(b.key) ?? 1000;
    return ra - rb;
  });
}

export function moveCoverageSnapshotKey(
  order: string[],
  key: string,
  delta: -1 | 1,
): string[] {
  const idx = order.indexOf(key);
  if (idx < 0) return order;
  const next = idx + delta;
  if (next < 0 || next >= order.length) return order;
  const copy = [...order];
  const [item] = copy.splice(idx, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function toggleCoverageSnapshotHidden(hidden: string[], key: string): string[] {
  if (hidden.includes(key)) return hidden.filter((k) => k !== key);
  return [...hidden, key];
}
