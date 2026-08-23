/**
 * Status LANES — a READ-SIDE normaliser over the client's free-text CRM
 * statuses (≈83 distinct spellings on PIFH contacts alone).
 *
 * The stored values are never rewritten. `statusLane()` is a pure function
 * that buckets any spelling into one of seven lanes so "who is pending / who
 * is active" is one chip click, and `laneFilter()` turns a lane back into the
 * exact raw values that belong to it so the list query (`status IN (...)`)
 * returns precisely the rows the chip counted.
 *
 * Reuses the classifications that already exist rather than forking them:
 *   - PENDING_CONTACT_STATUSES  (resolve-effective-start-date — auto-activate cron)
 *   - ACTIVE_CONTACT_STATUSES / TERMINAL_CONTACT_STATUSES (resolve-effective-end-date — auto-cancel)
 *   - isActiveCoverageStatus    (member-terminology — green badge rule)
 * Pattern rules below only extend those exact-match lists to the long tail.
 * (`@crm-eco/ui` statusToTone is a COLOUR system, not a lifecycle bucket — it
 * is intentionally not the source of truth here.)
 *
 * PROD SPELLINGS → LANE (PIFH contacts/members/leads, 2026-08-16 snapshot):
 *
 *   active     : Active HS Member (3,972) · active (462) · Active (300) ·
 *                Enrolled-2016 · Enrolled - 2017…2026 (12 variants) · Enrolled Member ·
 *                Enrolled - Direct to MCS · Active ADVISOR · Active DPC · Active Member ·
 *                Active HS Member - Not in MyAHE backoffice · Active HS Member - LHS Not Paid ·
 *                Active Insurance Client
 *   pending    : Approved Pending (31) · Pending · Pending Activation · Pending HS Member ·
 *                Pending Member · Enrolled · Enrolled - Pending Start
 *   in_process : In process · In Process · Application in Process · Application In Process ·
 *                App. In Process (Liberty) · Sedera Application in Process · Sedera App in Process
 *   new        : New · Prospect · Agent - Prospect · Agent- PROSPECT · Future Prospect ·
 *                DPC Prospect · Hot Prospect - ready to move · Warm Prospect - Maybe ·
 *                Warm - Future Prospect · Cold Prospect - Released · Employee Prospect
 *   inactive   : In-Active (473) · Inactive · inactive · Agent- SPONSOR- InActive
 *   cancelled  : Cancelled (6,415) · Canceled · Cancelled Application · Cancelled - In New CRM ·
 *                Cancellation Pending · Terminated · Deceased
 *   other      : everything else — Contacted, Released, Lost Opportunity, PERSONAL,
 *                Group Policy, Decision Making Stage, Non Client, Attempted Contact *,
 *                Not Contacted, Dropout, Denied by Liberty, Liberty App. Declined, LIVE,
 *                Suspended, Junk Lead, Converted (leads), Complimentary, … and null/blank.
 *
 * JUDGMENT CALLS (documented on purpose):
 *   1. "Approved Pending" → pending. It is an approved application waiting on
 *      its coverage start; the auto-activate cron already treats it as pending
 *      (PENDING_CONTACT_STATUSES) and flips it to Active on the start date.
 *   2. "Cancellation Pending" → cancelled, NOT pending. It is a cancel in
 *      flight — the member is leaving, not arriving. The auto-cancel path already
 *      lists it as TERMINAL (TERMINAL_CONTACT_STATUSES), so grouping it with the
 *      pending members would put a departing member on the "waiting to
 *      activate" list. The cancel-first rule ordering below enforces this.
 *   3. Bare "Enrolled" / "Enrolled - Pending Start" → pending (existing cron
 *      semantics: enrolled but coverage has not started); "Enrolled - YYYY" and
 *      "Enrolled Member" → active (they are the year-stamped active roster).
 *   4. Anything containing the word "prospect" → new (a prospect is a
 *      not-yet-customer). "Converted" is deliberately left in `other`: it is a
 *      lead outcome, not a membership state, and the leads chip filters it
 *      by exact value.
 *
 * Client-safe: no server imports.
 */

import { statusToTone, type Tone } from '@crm-eco/ui/components/status-badge';
import { PENDING_CONTACT_STATUSES } from './resolve-effective-start-date';
import {
  ACTIVE_CONTACT_STATUSES,
  TERMINAL_CONTACT_STATUSES,
} from './resolve-effective-end-date';
import { isActiveCoverageStatus } from './member-terminology';

export type StatusLane =
  | 'active'
  | 'pending'
  | 'cancelled'
  | 'inactive'
  | 'in_process'
  | 'new'
  | 'other';

/** Display order for pickers / chips. */
export const STATUS_LANES: Array<{ id: StatusLane; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'in_process', label: 'In process' },
  { id: 'new', label: 'New' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'other', label: 'Other' },
];

export const STATUS_LANE_IDS: readonly StatusLane[] = STATUS_LANES.map((l) => l.id);

/** Human label for a lane. */
export function statusLaneLabel(lane: StatusLane): string {
  return STATUS_LANES.find((l) => l.id === lane)?.label ?? 'Other';
}

/** Case / whitespace / punctuation-insensitive key: "In-Active" → "inactive". */
export function normalizeStatusKey(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const PENDING_EXACT = new Set(PENDING_CONTACT_STATUSES.map(normalizeStatusKey));
const ACTIVE_EXACT = new Set(ACTIVE_CONTACT_STATUSES.map(normalizeStatusKey));
const TERMINAL_EXACT = new Set(TERMINAL_CONTACT_STATUSES.map(normalizeStatusKey));
// Vocabulary 2026-08-22: the closed outcomes belong with cancelled. The open
// pipeline words (Attempted, Contacted, Qualified, Converted …) deliberately
// stay in 'other' so they keep their canonical StatusBadge colours.
const CLOSED_VOCAB = new Set(['lost', 'declined', 'abandoned', 'unqualified']);

/**
 * Bucket a raw status into a lane. Pure; never throws; null/blank → 'other'.
 *
 * Rule order matters and is part of the contract:
 *   cancelled → inactive → in_process → pending → active → new → other
 * so "Cancellation Pending" is cancelled (not pending), "Agent- SPONSOR-
 * InActive" is inactive (not active) and "Pending Activation" is pending.
 */
export function statusLane(raw: string | null | undefined): StatusLane {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'other';
  const key = normalizeStatusKey(trimmed);

  // 1. Cancelled / terminal — checked FIRST so a cancel-in-flight never
  //    lands in pending (judgment call #2).
  if (
    TERMINAL_EXACT.has(key) ||
    CLOSED_VOCAB.has(key) ||
    key.startsWith('cancel') ||
    key === 'canceled' ||
    key === 'terminated' ||
    key === 'deceased'
  ) {
    return 'cancelled';
  }

  // 2. Inactive — before active, because "inactive" contains "active".
  if (key.includes('inactive')) return 'inactive';

  // 3. Application in process (leads + contacts mid-enrollment).
  if (key.includes('inprocess')) return 'in_process';

  // 4. Pending — exact cron list first (covers "Approved Pending", bare
  //    "Enrolled", "Enrolled - Pending Start"), then any remaining "pending"
  //    spelling ("Pending Activation", "Pending HS Member", …).
  if (PENDING_EXACT.has(key) || key.includes('pending')) return 'pending';

  // 5. Active — exact lists first (member-terminology + auto-cancel), then
  //    the long tail: "Active HS Member - LHS Not Paid", "Enrolled - 2024",
  //    "Enrolled Member", "active".
  if (
    ACTIVE_EXACT.has(key) ||
    isActiveCoverageStatus(trimmed) ||
    key.startsWith('active') ||
    key.startsWith('enrolled')
  ) {
    return 'active';
  }

  // 6. New / prospect (judgment call #4).
  if (key === 'new' || key === 'newlead' || key.includes('prospect')) return 'new';

  return 'other';
}

export interface StatusValueCount {
  value: string;
  count: number;
}

export type StatusValuesByLane = Record<StatusLane, StatusValueCount[]>;

/** Empty by-lane record (every lane present, so callers never null-check). */
export function emptyStatusValuesByLane(): StatusValuesByLane {
  return {
    active: [],
    pending: [],
    in_process: [],
    new: [],
    inactive: [],
    cancelled: [],
    other: [],
  };
}

/**
 * Group distinct status values (with counts) by lane. Values inside a lane
 * keep their input order (callers pass count-desc from the API). Blank
 * values are dropped — they cannot be filtered on with `in`.
 */
export function groupStatusValuesByLane(values: StatusValueCount[]): StatusValuesByLane {
  const out = emptyStatusValuesByLane();
  for (const v of values) {
    if (typeof v.value !== 'string' || !v.value.trim()) continue;
    out[statusLane(v.value)].push(v);
  }
  return out;
}

/** Sum of counts in a lane — the number to print on a chip. */
export function laneCount(values: StatusValueCount[], lane: StatusLane): number {
  return groupStatusValuesByLane(values)[lane].reduce((n, v) => n + v.count, 0);
}

/** Raw values (in input order, de-duplicated) that belong to a lane. */
export function laneValues(lane: StatusLane, values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (!t || seen.has(v)) continue;
    if (statusLane(v) === lane) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export interface LaneFilter {
  /** `contact_status` aliases to the canonical row `status` column in the
   *  list/report query builder (lib/crm/report-field-path.ts). */
  field: 'contact_status' | 'status';
  operator: 'in';
  value: string[];
}

/**
 * ModulePage `filters` JSON entry that selects exactly the rows in a lane.
 * `values` are the module's distinct raw statuses (from
 * GET /api/crm/records/status-values); only the ones in `lane` are kept.
 *
 * Both fields resolve to the same `crm_records.status` column, so a chip's
 * count and the list it opens always agree. Uses `contact_status` for the
 * people modules (contacts/members — matches how those modules name the
 * field in crm_fields) and `status` elsewhere.
 *
 * When no raw value belongs to the lane the filter is still emitted (with an
 * empty array → PostgREST `in.()` matches nothing) so a chip whose lane is
 * currently empty opens an honest empty list instead of the whole module.
 */
export function laneFilter(
  lane: StatusLane,
  values: string[],
  field: LaneFilter['field'] = 'contact_status',
): LaneFilter {
  return { field, operator: 'in', value: laneValues(lane, values) };
}

/** Which filter field a module uses for its status lane. */
export function laneFilterFieldForModule(moduleKey: string | null | undefined): LaneFilter['field'] {
  return moduleKey === 'contacts' || moduleKey === 'members' ? 'contact_status' : 'status';
}

/**
 * Arguments for the existing `execute_report_aggregation` RPC that produce
 * `[{ status, count_id }]` for one module (deleted rows excluded). Shared by
 * the status-values API route and the dashboard people queue so both count
 * the same way. Pure — the caller runs `supabase.rpc('execute_report_aggregation', args)`.
 *
 * `p_filters` / `p_grouping` / `p_aggregations` / `p_sorting` are `jsonb`
 * parameters: they MUST be passed as real arrays, never `JSON.stringify()`
 * strings. supabase-js serialises the args object once; a pre-stringified
 * value arrives as a jsonb *scalar string* and the function's
 * `jsonb_array_elements(...)` then fails with `22023 cannot extract elements
 * from a scalar` (reproduced on prod 2026-08-22 — it 500'd every lane-chip
 * count and the dashboard pending lane). See `assertJsonbRpcArgs`.
 */
export function statusValuesRpcArgs(orgId: string, moduleId: string) {
  return {
    p_org_id: orgId,
    p_table: 'crm_records',
    p_org_column: 'org_id',
    p_module_id: moduleId,
    p_filters: [{ field: 'deleted_at', operator: 'is_null' }],
    p_filter_logic: 'and',
    p_grouping: [{ field: 'status' }],
    p_aggregations: [{ field: 'id', function: 'count' }],
    p_sorting: [{ column: 'count_id', direction: 'desc' }],
    p_limit: 500,
    p_offset: 0,
    p_include_downline: false,
  };
}

/** The `execute_report_aggregation` params typed `jsonb` in Postgres. */
export const REPORT_AGGREGATION_JSONB_PARAMS = [
  'p_filters',
  'p_grouping',
  'p_aggregations',
  'p_sorting',
] as const;

/**
 * Guard for callers of `execute_report_aggregation`: every jsonb param that is
 * present must be an array (the function iterates each with
 * `jsonb_array_elements`). A string — the classic `JSON.stringify()` slip —
 * or a bare object would reach Postgres as a jsonb scalar/object and fail
 * with 22023. Throws so the mistake is caught by unit tests, not in prod.
 */
export function assertJsonbRpcArgs(args: Record<string, unknown>): void {
  for (const key of REPORT_AGGREGATION_JSONB_PARAMS) {
    if (!(key in args)) continue;
    const v = args[key];
    if (v === undefined || v === null) continue;
    if (!Array.isArray(v)) {
      throw new TypeError(
        `execute_report_aggregation.${key} must be a JSON array (got ${typeof v}); ` +
          'do not JSON.stringify() jsonb params',
      );
    }
  }
}

/** Parse the RPC payload into `{ value, count }` rows (null/blank statuses dropped). */
export function parseStatusValuesRpcResult(payload: unknown): StatusValueCount[] {
  const rows = (payload as { rows?: unknown } | null | undefined)?.rows;
  if (!Array.isArray(rows)) return [];
  const out: StatusValueCount[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const status = (r as { status?: unknown }).status;
    const count = Number((r as { count_id?: unknown }).count_id ?? 0);
    if (typeof status !== 'string' || !status.trim()) continue;
    out.push({ value: status, count: Number.isFinite(count) ? count : 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lane → colour tone (ONE status colour on record header, list rows, desk)
// ---------------------------------------------------------------------------

/**
 * Semantic tone names — a strict subset of `@crm-eco/ui` StatusBadge `Tone`
 * so callers can pass the result straight to `<StatusBadge tone={…}>`.
 * Kept as string literals here (no ui import) so this module stays
 * server/test safe.
 */
export type LaneTone = 'success' | 'attention' | 'progress' | 'info' | 'neutral' | 'danger';

const LANE_TONE: Record<StatusLane, LaneTone> = {
  active: 'success',
  pending: 'attention',
  in_process: 'progress',
  new: 'info',
  inactive: 'neutral',
  cancelled: 'danger',
  other: 'neutral',
};

/** Colour tone for a lane: active→success, pending→attention, in_process→progress, new→info, inactive→neutral, cancelled→danger, other→neutral. */
export function laneTone(lane: StatusLane): LaneTone {
  return LANE_TONE[lane] ?? 'neutral';
}

/**
 * Tone for a raw status spelling — `laneTone(statusLane(raw))`. Use this
 * everywhere a status pill is painted so "Active HS Member" and "Cancelled"
 * render one colour on the record header, the list rows and the dashboard.
 */
export function statusToneForValue(raw: string | null | undefined): Tone {
  const lane = statusLane(raw);
  // Lanes cover the health-share vocabulary; anything else (Contacted,
  // Qualified, Lost, Closed Won…) keeps the shared canonical StatusBadge
  // colours instead of collapsing to neutral grey.
  return lane === 'other' ? statusToTone(raw) : laneTone(lane);
}

// ---------------------------------------------------------------------------
// Filter chip collapse: `status in (…)` that IS a lane → one "Status: Active (n)" pill
// ---------------------------------------------------------------------------

export interface CollapsedLaneFilter {
  lane: StatusLane;
  label: string;
  /** Raw values in the filter (for the tooltip). */
  values: string[];
}

/**
 * Decide whether an `in` filter's value set reads as ONE lane.
 *
 * Rules (both required):
 *   1. every value buckets into the same lane (never `other`); and
 *   2. coverage — when the module's live status values are known
 *      (`moduleValues`, with or without counts), the filter must cover ≥ 90 %
 *      of that lane (by record count when counts are present, else by distinct
 *      value); without live values, the set must hold at least two spellings
 *      (a single raw value stays a plain "Status is Active" chip).
 *
 * Returns null when the set should render as the raw list.
 */
export function collapseStatusInFilter(
  values: unknown,
  moduleValues?: ReadonlyArray<string | StatusValueCount> | null,
): CollapsedLaneFilter | null {
  if (!Array.isArray(values)) return null;
  const raw = values.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (raw.length === 0) return null;
  const lane = statusLane(raw[0]);
  if (lane === 'other') return null;
  for (const v of raw) if (statusLane(v) !== lane) return null;

  if (moduleValues && moduleValues.length > 0) {
    const inFilter = new Set(raw);
    const weighted = moduleValues.some((mv) => typeof mv !== 'string');
    let laneTotal = 0;
    let covered = 0;
    for (const mv of moduleValues) {
      const value = typeof mv === 'string' ? mv : mv.value;
      if (typeof value !== 'string' || !value.trim()) continue;
      if (statusLane(value) !== lane) continue;
      const w = weighted && typeof mv !== 'string' ? Math.max(0, Number(mv.count) || 0) : 1;
      laneTotal += w;
      if (inFilter.has(value)) covered += w;
    }
    if (laneTotal === 0) return null;
    if (covered / laneTotal < 0.9) return null;
  } else {
    // Without the module's live values we cannot prove lane coverage, so a
    // hand-picked subset (e.g. 2 of ~20 active spellings) stays as raw chips
    // rather than masquerading as the whole lane.
    return null;
  }

  return { lane, label: statusLaneLabel(lane), values: raw };
}

// ---------------------------------------------------------------------------
// Back-to-list: `?returnTo=` plumbing shared by list rows and the dashboard
// ---------------------------------------------------------------------------

/**
 * Only same-app `/crm…` paths are honoured as a back target (no open
 * redirects, no protocol-relative `//host`). Mirrors the reader in
 * RecordDetailShellV2 so writers and the reader agree.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/crm')) return null;
  if (raw.startsWith('//')) return null;
  if (raw !== '/crm' && !raw.startsWith('/crm/') && !raw.startsWith('/crm?')) return null;
  return raw;
}

/**
 * Append `returnTo=<encoded>` to a record href, keeping any query it already
 * carries (`/crm/r/<id>?pane=notes` → `…?pane=notes&returnTo=%2Fcrm`). Invalid
 * or empty targets leave the href untouched; an existing `returnTo` is kept.
 */
export function withReturnTo(href: string, returnTo: string | null | undefined): string {
  const safe = sanitizeReturnTo(returnTo);
  // Only same-app paths get a returnTo. `tel:`/`mailto:`/`#`/absolute URLs
  // must pass through untouched — a dialer receiving "tel:555?returnTo=…"
  // is exactly the kind of regression this guard prevents.
  if (!safe || !href || !href.startsWith('/') || href.startsWith('//')) return href;
  const hashIdx = href.indexOf('#');
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : '';
  const base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  if (/[?&]returnTo=/.test(base)) return href;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}returnTo=${encodeURIComponent(safe)}${hash}`;
}

/** Current list location (`pathname + search`) as a returnTo target. */
export function currentListReturnTo(
  pathname: string | null | undefined,
  search: string | null | undefined,
): string | null {
  if (!pathname) return null;
  const qs = search ? (search.startsWith('?') ? search : `?${search}`) : '';
  return sanitizeReturnTo(`${pathname}${qs === '?' ? '' : qs}`);
}
