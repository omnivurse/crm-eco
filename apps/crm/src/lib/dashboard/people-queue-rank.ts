/**
 * People queue — PURE ranking / projection layer.
 *
 * Everything in here is deterministic and free of server imports (no Supabase,
 * no next/headers) so it can be unit-tested and, if ever needed, imported from
 * client components. The server builder (`people-queue.ts`) fetches bounded
 * candidate sets and hands them to `assemblePeopleQueue`.
 *
 * Responsibilities:
 *   - project a `crm_records` row the same way the record page does
 *     (`mergeCrmRecordRowIntoFormDefaults` → legacy keys, sharing bridges,
 *     canonical status) and pull the member-brief fields out of it;
 *   - compute deterministic attention signals (`lib/crm/ai/signals`);
 *   - dedupe candidates by record, merge reasons, rank, label, and pick a
 *     concrete next action.
 */

import { mergeCrmRecordRowIntoFormDefaults } from '@/lib/crm/record-form-defaults';
import { normalizeDateColumnValue } from '@/lib/crm/merge-crm-data-json-to-row';
import { resolveOwnershipName, cleanOwnershipValue } from '@/lib/crm/ownership-name';
import {
  attentionScore,
  computeRecordSignals,
  rankRulesRecommendations,
  topAttentionLabel,
} from '@/lib/crm/ai/signals';
import type { BriefingAction } from '@/lib/crm/ai/types';
import type {
  PeopleQueue,
  PeopleQueueAction,
  PeopleQueueItem,
  PeopleQueueReason,
} from './people-queue-types';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Minimal `crm_records` row the builder selects (see people-queue.ts). */
export interface PeopleQueueRecordRow {
  id: string;
  module_id: string;
  title: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  stage?: string | null;
  market_type?: string | null;
  normalized_advisor_name?: string | null;
  normalized_agent_name?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  data?: Record<string, unknown> | null;
}

export interface PeopleQueueTaskRef {
  id: string;
  title: string;
  dueAt: string | null;
}

/** One "hit" from a source: this record matched this reason. */
export interface PeopleQueueHit {
  recordId: string;
  reason: PeopleQueueReason;
  /** Only for overdue_task / task_today. */
  task?: PeopleQueueTaskRef | null;
  /** Only for recent — crm_recently_viewed.last_viewed_at. */
  viewedAt?: string | null;
}

export interface AssemblePeopleQueueInput {
  /** Every candidate row, keyed by id (deduped by the builder). */
  records: ReadonlyMap<string, { row: PeopleQueueRecordRow; moduleKey: string }>;
  hits: readonly PeopleQueueHit[];
  now?: Date;
  /** Max queue items (default 12). */
  limit?: number;
  /**
   * `recent` alone only earns a seat when the queue would otherwise be shorter
   * than this (default 5).
   */
  recentFillThreshold?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Lower = more urgent. Order mandated by the dashboard design. */
export const PEOPLE_QUEUE_REASON_PRIORITY: Record<PeopleQueueReason, number> = {
  overdue_task: 0,
  task_today: 1,
  starting_soon: 2,
  pending: 3,
  needs_attention: 4,
  new: 5,
  recent: 6,
};

/** Same threshold as `NeedsAttentionChip.tsx`. */
export const NEEDS_ATTENTION_THRESHOLD = 40;

/** Reasons that mean the record is genuinely due today (drive the "Today" framing). */
const STRONG_REASONS: ReadonlySet<PeopleQueueReason> = new Set([
  'overdue_task',
  'task_today',
  'starting_soon',
  'pending',
  'needs_attention',
  'new',
]);

const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_KEYS = [
  'product',
  'plan_name',
  'health_insurance_plan_name',
  'coverage_option',
  'member_tier',
] as const;
const CITY_KEYS = ['mailing_city', 'city'] as const;
const STATE_KEYS = ['mailing_state', 'state'] as const;
const REFERRING_KEYS = ['referring_member'] as const;
const MEMBER_ID_KEYS = [
  'member_number',
  'e123_member_id',
  'sharing_member_id',
  'dental_member_id',
] as const;
const EFFECTIVE_DATE_KEYS = [
  'sharing_effective_date',
  'start_date',
  'effective_date',
  'health_insurance_start_date',
] as const;
const STATUS_KEYS = ['contact_status', 'sharing_status', 'status'] as const;
const DOB_KEYS = ['date_of_birth', 'dob'] as const;

// ---------------------------------------------------------------------------
// Small pure helpers (exported for tests + UI reuse)
// ---------------------------------------------------------------------------

export function recordHref(recordId: string): string {
  return `/crm/r/${recordId}`;
}

/** Trim + reject placeholder strings; numbers are stringified. */
export function cleanText(value: unknown): string | null {
  return cleanOwnershipValue(value);
}

function firstText(data: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = cleanText(data[key]);
    if (v) return v;
  }
  return null;
}

/**
 * ISO `YYYY-MM-DD` or null. Accepts ISO (with optional time suffix) and US
 * `M/D/YYYY`; rejects sentinels (`01/00/2000`, `0000-00-00`).
 */
export function toIsoDate(value: unknown): string | null {
  return normalizeDateColumnValue(value);
}

/** Two-letter initials from a display name ("Jane Q. Doe" → "JD"; "Acme" → "AC"). */
export function initialsFor(name: string | null | undefined): string {
  const cleaned = (name ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Display name: title, else first+last from data, else email, else "Unnamed record". */
export function displayNameFor(row: PeopleQueueRecordRow, data: Record<string, unknown>): string {
  const title = cleanText(row.title);
  if (title) return title;
  const first = cleanText(data.first_name);
  const last = cleanText(data.last_name);
  const joined = [first, last].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  const full = cleanText(data.full_name) ?? cleanText(data.name);
  if (full) return full;
  return cleanText(row.email) ?? cleanText(data.email) ?? 'Unnamed record';
}

/** "Sep 1" / "Sep 1, 2027" when not the current year. Input is YYYY-MM-DD. */
export function shortDate(iso: string, now: Date = new Date()): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const base = `${months[(m ?? 1) - 1] ?? '?'} ${d ?? '?'}`;
  return y === now.getUTCFullYear() ? base : `${base}, ${y}`;
}

/** UTC calendar date of a timestamp / date string as YYYY-MM-DD, or null. */
export function isoDayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return toIsoDate(value);
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days from `iso` (YYYY-MM-DD) to today (UTC); positive = in the past. */
export function daysAgo(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(t)) return null;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const day = Date.parse(`${new Date(t).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((today - day) / DAY_MS);
}

/** Whole days from today (UTC) until `iso`; 0 = today, 1 = tomorrow. */
export function daysUntil(iso: string | null | undefined, now: Date): number | null {
  const ago = daysAgo(iso, now);
  return ago == null ? null : -ago;
}

/**
 * Project a raw row exactly like the record page (`withProjectedRecordData`):
 * JSONB → indexed-column overlays → sharing/insurance bridges → legacy keys.
 */
export function projectQueueRecordData(
  row: PeopleQueueRecordRow,
  moduleKey: string,
): Record<string, unknown> {
  return mergeCrmRecordRowIntoFormDefaults(
    row as unknown as Record<string, unknown> & {
      data?: Record<string, unknown> | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
    },
    { moduleKey },
  );
}

// ---------------------------------------------------------------------------
// Member brief
// ---------------------------------------------------------------------------

export interface PeopleQueueBrief {
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  marketType: string | null;
  city: string | null;
  state: string | null;
  dateOfBirth: string | null;
  plan: string | null;
  enrolledBy: string | null;
  referringMember: string | null;
  memberId: string | null;
  effectiveDate: string | null;
}

/**
 * Extract the at-a-glance brief. `data` must already be projected
 * (`projectQueueRecordData`) so `city` vs `mailing_city` etc. resolve the same
 * way the record page resolves them.
 */
export function extractBrief(
  row: PeopleQueueRecordRow,
  moduleKey: string,
  data: Record<string, unknown>,
): PeopleQueueBrief {
  const name = displayNameFor(row, data);
  const rawDob = firstText(data, DOB_KEYS);
  const rawEffective = firstText(data, EFFECTIVE_DATE_KEYS);
  const enrolledBy = resolveOwnershipName({
    market_type: row.market_type ?? null,
    normalized_advisor_name: row.normalized_advisor_name ?? null,
    normalized_agent_name: row.normalized_agent_name ?? null,
    data,
  }).name;

  return {
    name,
    initials: initialsFor(name),
    email: cleanText(row.email) ?? cleanText(data.email),
    phone: cleanText(row.phone) ?? cleanText(data.phone) ?? cleanText(data.mobile),
    status: firstText(data, STATUS_KEYS) ?? cleanText(row.status),
    marketType: cleanText(row.market_type) ?? cleanText(data.market_type),
    city: firstText(data, CITY_KEYS),
    state: firstText(data, STATE_KEYS),
    dateOfBirth: toIsoDate(rawDob),
    plan: firstText(data, PLAN_KEYS),
    enrolledBy,
    referringMember: firstText(data, REFERRING_KEYS),
    memberId: firstText(data, MEMBER_ID_KEYS),
    effectiveDate: toIsoDate(rawEffective),
  };
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export interface PeopleQueueSignalSummary {
  score: number;
  label: string | null;
  topAction: BriefingAction | null;
}

/**
 * Deterministic attention score + top rules recommendation for a projected row.
 * Mirrors `NeedsAttentionChip`: task counts are NOT fed in, so an attached
 * task never double-counts as "needs attention" (it already has its own reason).
 */
export function summarizeSignals(
  row: PeopleQueueRecordRow,
  moduleKey: string,
  data: Record<string, unknown>,
  now: Date,
): PeopleQueueSignalSummary {
  const input = {
    moduleKey,
    title: row.title ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    status: row.status ?? null,
    stage: row.stage ?? null,
    updatedAt: row.updated_at ?? null,
    data,
    now,
  };
  const signals = computeRecordSignals(input);
  const score = attentionScore(signals);
  const topAction = rankRulesRecommendations(signals, input)[0] ?? null;
  return { score, label: topAttentionLabel(signals), topAction };
}

// ---------------------------------------------------------------------------
// Labels + next action
// ---------------------------------------------------------------------------

function overdueDays(dueAt: string | null, now: Date): number {
  const d = daysAgo(dueAt, now);
  return d == null ? 0 : Math.max(d, 1);
}

/** Human fragment for a single reason. Null when nothing sensible can be said. */
export function reasonFragment(
  reason: PeopleQueueReason,
  ctx: {
    now: Date;
    task?: PeopleQueueTaskRef | null;
    effectiveDate?: string | null;
    updatedAt?: string | null;
    createdAt?: string | null;
    attentionLabel?: string | null;
    viewedAt?: string | null;
  },
): string | null {
  const { now } = ctx;
  switch (reason) {
    case 'overdue_task': {
      const days = overdueDays(ctx.task?.dueAt ?? null, now);
      return `Task overdue ${days}d`;
    }
    case 'task_today':
      return 'Task due today';
    case 'starting_soon': {
      if (!ctx.effectiveDate) return 'Starts soon';
      const until = daysUntil(ctx.effectiveDate, now);
      if (until === 0) return 'Starts today';
      if (until === 1) return 'Starts tomorrow';
      return `Starts ${shortDate(ctx.effectiveDate, now)}`;
    }
    case 'pending': {
      // Since CREATED, not updated — editing the record must not reset the
      // "how long have they been waiting" clock.
      const day = isoDayOf(ctx.createdAt);
      return day ? `Pending since ${shortDate(day, now)}` : 'Pending activation';
    }
    case 'needs_attention':
      return ctx.attentionLabel ? `Needs attention: ${ctx.attentionLabel}` : 'Needs attention';
    case 'new': {
      const ago = daysAgo(ctx.createdAt, now);
      if (ago == null) return 'Recently added';
      if (ago <= 0) return 'Added today';
      if (ago === 1) return 'Added yesterday';
      return `Added ${ago}d ago`;
    }
    case 'recent': {
      const ago = daysAgo(ctx.viewedAt, now);
      if (ago == null) return 'Recently viewed';
      if (ago <= 0) return 'Viewed today';
      if (ago === 1) return 'Viewed yesterday';
      return `Viewed ${ago}d ago`;
    }
    default:
      return null;
  }
}

/** Join up to two fragments in priority order: "Task overdue 3d · Starts Sep 1". */
export function buildReasonLabel(
  reasons: readonly PeopleQueueReason[],
  ctx: Parameters<typeof reasonFragment>[1],
): string {
  const ordered = sortReasons(reasons);
  const fragments: string[] = [];
  for (const r of ordered) {
    const f = reasonFragment(r, ctx);
    if (f) fragments.push(f);
    if (fragments.length >= 2) break;
  }
  return fragments.join(' · ');
}

export function sortReasons(reasons: readonly PeopleQueueReason[]): PeopleQueueReason[] {
  return [...new Set(reasons)].sort(
    (a, b) => PEOPLE_QUEUE_REASON_PRIORITY[a] - PEOPLE_QUEUE_REASON_PRIORITY[b],
  );
}

function briefingActionKind(action: BriefingAction['action']): PeopleQueueAction['kind'] {
  switch (action) {
    case 'call':
      return 'call';
    case 'email':
      return 'email';
    case 'task':
      return 'task';
    case 'review_coverage':
      return 'review';
    case 'fill_field':
      return 'open';
    default:
      return 'open';
  }
}

/**
 * Pick the one concrete next action.
 *   1. attached task → "Complete: <title>" on the record page (tasks live there;
 *      the record page has no ?tab deep-link today — only ?ai=email is real);
 *   2. reason fallbacks (starting_soon / pending / new / recent);
 *   3. top rules recommendation (needs_attention);
 *   4. open the record.
 * `call` kinds link to `tel:` when a phone is on file, `email` kinds use the
 * record's real `?ai=email` deep-link.
 */
export function pickNextAction(args: {
  recordId: string;
  primary: PeopleQueueReason;
  task?: PeopleQueueTaskRef | null;
  effectiveDate?: string | null;
  phone?: string | null;
  topAction?: BriefingAction | null;
  now: Date;
}): PeopleQueueAction {
  const href = recordHref(args.recordId);
  const callHref = args.phone ? `tel:${args.phone.replace(/[^\d+]/g, '')}` : href;
  const emailHref = `${href}?ai=email`;

  if (args.task) {
    return { label: `Complete: ${args.task.title}`, href, kind: 'task' };
  }

  switch (args.primary) {
    case 'starting_soon': {
      const when = args.effectiveDate ? shortDate(args.effectiveDate, args.now) : 'date';
      return { label: `Confirm coverage start ${when}`, href: callHref, kind: 'call' };
    }
    case 'pending':
      return { label: 'Follow up on activation', href: callHref, kind: 'call' };
    case 'new':
      return { label: 'Complete the profile', href, kind: 'open' };
    case 'recent':
      return { label: 'Pick up where you left off', href, kind: 'open' };
    default:
      break;
  }

  if (args.topAction) {
    const kind = briefingActionKind(args.topAction.action);
    const actionHref = kind === 'call' ? callHref : kind === 'email' ? emailHref : href;
    return { label: args.topAction.title, href: actionHref, kind };
  }

  return { label: 'Open record', href, kind: 'open' };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/** Internal sort keys carried alongside each item (not part of the public type). */
interface RankMeta {
  taskDueAt: string | null;
  createdAt: string | null;
  viewedAt: string | null;
}

const rankMeta = new WeakMap<PeopleQueueItem, RankMeta>();

function ts(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const t = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return t;
}

/** asc: NaN last. */
function cmpAsc(a: number, b: number): number {
  const an = Number.isNaN(a);
  const bn = Number.isNaN(b);
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  return a - b;
}

function metaFor(item: PeopleQueueItem): RankMeta {
  return (
    rankMeta.get(item) ?? {
      taskDueAt: item.task?.dueAt ?? null,
      createdAt: item.createdAt ?? null,
      viewedAt: item.lastViewedAt ?? null,
    }
  );
}

/**
 * Comparator implementing the approved order:
 *   overdue_task (oldest due first) > task_today (soonest first)
 *   > starting_soon (soonest first) > pending (oldest created first)
 *   > needs_attention (score desc) > new (newest first) > recent (latest first)
 * Ties: higher attention score, then most recently updated.
 */
export function comparePeopleQueueItems(a: PeopleQueueItem, b: PeopleQueueItem): number {
  const pa = PEOPLE_QUEUE_REASON_PRIORITY[a.reason];
  const pb = PEOPLE_QUEUE_REASON_PRIORITY[b.reason];
  if (pa !== pb) return pa - pb;

  const ma = metaFor(a);
  const mb = metaFor(b);
  let c = 0;
  switch (a.reason) {
    case 'overdue_task':
    case 'task_today':
      c = cmpAsc(ts(ma.taskDueAt), ts(mb.taskDueAt));
      break;
    case 'starting_soon':
      c = cmpAsc(ts(a.effectiveDate), ts(b.effectiveDate));
      break;
    case 'pending':
      c = cmpAsc(ts(ma.createdAt), ts(mb.createdAt));
      break;
    case 'needs_attention':
      c = b.attentionScore - a.attentionScore;
      break;
    case 'new':
      c = cmpAsc(ts(mb.createdAt), ts(ma.createdAt));
      break;
    case 'recent':
      c = cmpAsc(ts(mb.viewedAt), ts(ma.viewedAt));
      break;
  }
  if (c !== 0) return c;
  if (a.attentionScore !== b.attentionScore) return b.attentionScore - a.attentionScore;
  return cmpAsc(ts(b.updatedAt), ts(a.updatedAt));
}

/** Stable sort by `comparePeopleQueueItems`. Does not mutate the input. */
export function rankPeopleQueue(items: readonly PeopleQueueItem[]): PeopleQueueItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((x, y) => comparePeopleQueueItems(x.item, y.item) || x.i - y.i)
    .map((x) => x.item);
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Build one queue item from a row + its merged hits. Exported so the builder
 * can also shape "recently viewed" rail entries with the same brief logic.
 */
export function buildPeopleQueueItem(args: {
  row: PeopleQueueRecordRow;
  moduleKey: string;
  reasons: readonly PeopleQueueReason[];
  task?: PeopleQueueTaskRef | null;
  viewedAt?: string | null;
  now: Date;
}): PeopleQueueItem {
  const { row, moduleKey, now } = args;
  const data = projectQueueRecordData(row, moduleKey);
  const brief = extractBrief(row, moduleKey, data);
  const signals = summarizeSignals(row, moduleKey, data, now);

  const reasons = new Set<PeopleQueueReason>(args.reasons);
  if (signals.score >= NEEDS_ATTENTION_THRESHOLD) reasons.add('needs_attention');
  // A starting_soon hit that projects to a date outside the window (stale
  // legacy key won the coalesce) is dropped so the label never lies.
  if (reasons.has('starting_soon')) {
    const until = daysUntil(brief.effectiveDate, now);
    if (until == null || until < 0 || until > 30) reasons.delete('starting_soon');
  }
  const ordered = sortReasons([...reasons]);
  const primary = ordered[0] ?? 'recent';

  const task = args.task ?? null;
  const labelCtx = {
    now,
    task,
    effectiveDate: brief.effectiveDate,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
    attentionLabel: signals.label,
    viewedAt: args.viewedAt ?? null,
  };

  const item: PeopleQueueItem = {
    recordId: row.id,
    moduleKey,
    name: brief.name,
    initials: brief.initials,
    href: recordHref(row.id),
    email: brief.email,
    phone: brief.phone,
    status: brief.status,
    marketType: brief.marketType,
    city: brief.city,
    state: brief.state,
    dateOfBirth: brief.dateOfBirth,
    plan: brief.plan,
    enrolledBy: brief.enrolledBy,
    referringMember: brief.referringMember,
    memberId: brief.memberId,
    effectiveDate: brief.effectiveDate,
    reason: primary,
    reasons: ordered,
    reasonLabel: buildReasonLabel(ordered, labelCtx),
    nextAction: pickNextAction({
      recordId: row.id,
      primary,
      task,
      effectiveDate: brief.effectiveDate,
      phone: brief.phone,
      topAction: signals.topAction,
      now,
    }),
    task,
    attentionScore: signals.score,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
    lastViewedAt: args.viewedAt ?? null,
  };
  rankMeta.set(item, {
    taskDueAt: task?.dueAt ?? null,
    createdAt: row.created_at ?? null,
    viewedAt: args.viewedAt ?? null,
  });
  return item;
}

/** Task with the earliest due date wins when several are attached. */
function pickTask(a: PeopleQueueTaskRef | null, b: PeopleQueueTaskRef | null): PeopleQueueTaskRef | null {
  if (!a) return b;
  if (!b) return a;
  return cmpAsc(ts(a.dueAt), ts(b.dueAt)) <= 0 ? a : b;
}

/**
 * Dedupe hits by record, merge reasons, build items, rank, apply the
 * "recent only fills a short queue" rule, and cap at `limit`.
 */
export function assemblePeopleQueue(input: AssemblePeopleQueueInput): PeopleQueueItem[] {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 12;
  const fillThreshold = input.recentFillThreshold ?? 5;

  const merged = new Map<
    string,
    {
      reasons: Set<PeopleQueueReason>;
      task: PeopleQueueTaskRef | null;
      viewedAt: string | null;
    }
  >();

  for (const hit of input.hits) {
    if (!input.records.has(hit.recordId)) continue;
    let entry = merged.get(hit.recordId);
    if (!entry) {
      entry = { reasons: new Set(), task: null, viewedAt: null };
      merged.set(hit.recordId, entry);
    }
    entry.reasons.add(hit.reason);
    if (hit.task) entry.task = pickTask(entry.task, hit.task);
    if (hit.viewedAt && (!entry.viewedAt || ts(hit.viewedAt) > ts(entry.viewedAt))) {
      entry.viewedAt = hit.viewedAt;
    }
  }

  const strong: PeopleQueueItem[] = [];
  const recentOnly: PeopleQueueItem[] = [];
  for (const [recordId, entry] of merged) {
    const rec = input.records.get(recordId)!;
    const item = buildPeopleQueueItem({
      row: rec.row,
      moduleKey: rec.moduleKey,
      reasons: [...entry.reasons],
      task: entry.task,
      viewedAt: entry.viewedAt,
      now,
    });
    if (item.reasons.some((r) => STRONG_REASONS.has(r))) strong.push(item);
    else recentOnly.push(item);
  }

  const ranked = rankPeopleQueue(strong);
  if (ranked.length < fillThreshold && recentOnly.length > 0) {
    const fill = rankPeopleQueue(recentOnly).slice(0, fillThreshold - ranked.length);
    ranked.push(...fill);
  }
  return ranked.slice(0, limit);
}

/** True when there is nothing to show at all (queue, rail and chips). */
export function isPeopleQueueEmpty(queue: Pick<PeopleQueue, 'items' | 'recentlyViewed' | 'counts'>): boolean {
  const c = queue.counts;
  return (
    queue.items.length === 0 &&
    queue.recentlyViewed.length === 0 &&
    c.tasksToday === 0 &&
    c.overdue === 0 &&
    c.pending === 0 &&
    c.startingSoon === 0
  );
}
