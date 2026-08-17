/**
 * People queue — SERVER builder for the dashboard "command desk".
 *
 * Server-only (uses the cookie-bound, RLS-scoped CRM client). Client
 * components must import `people-queue-types.ts` / `people-queue-rank.ts`
 * only — never this file (it pulls `next/headers` via lib/crm/queries).
 *
 * SOURCES (all org-scoped through RLS + explicit org_id, all bounded):
 *   1. crm_tasks — open (status ∉ completed/cancelled, deleted_at null) with a
 *      record_id, due before end of today (UTC). Overdue = due before start of
 *      today; today = within today. Org-wide (3 profiles share one desk today);
 *      counts are org-wide too. LIMIT 30. → overdue_task / task_today.
 *   2. crm_records pending — contacts + members modules where
 *      data->>contact_status / data->>sharing_status / status ILIKE 'pending'.
 *      Newest updated first, LIMIT 40; chip count via HEAD count. → pending.
 *   3. crm_records starting soon — contacts + members + leads where any of
 *      data->>sharing_effective_date / start_date / effective_date falls in
 *      [today, today+30] (ISO strings compare lexicographically; PostgREST
 *      `or(and(k.gte.a,k.lte.b),…)`), status not cancelled. LIMIT 40; the pure
 *      layer re-checks the COALESCE'd date and drops stale matches. → starting_soon.
 *   4. crm_records new — contacts + members + leads created in the last 30
 *      days, newest first, LIMIT 40; converted leads dropped in code. → new.
 *   5. crm_recently_viewed for THIS auth user (user_id = profiles.user_id, not
 *      profiles.id), LIMIT recentLimit+6 → right-rail "Recently viewed" and a
 *      weak `recent` reason (only fills a short queue).
 *   Referenced records not already loaded by 2-4 are fetched ONCE by id
 *   (`.in('id', …)`, ≤ 36 ids). Worst case ≈ 9 small indexed queries and
 *   ≤ ~160 record rows per dashboard render; nothing scans the table.
 *
 * Every source is isolated in try/catch: a failure sets `degraded = true` and
 * the rest of the queue still renders.
 */

import { createCrmClient, getCachedModules } from '@/lib/crm/queries';
import { isConvertedLeadRow } from '@/lib/crm/record-search';
import type { PeopleQueue, PeopleQueueCounts } from './people-queue-types';
import {
  assemblePeopleQueue,
  buildPeopleQueueItem,
  type PeopleQueueHit,
  type PeopleQueueRecordRow,
} from './people-queue-rank';

export interface PeopleQueueProfile {
  /** profiles.id (crm_tasks.assigned_to points here). */
  id: string;
  organization_id: string;
  crm_role?: string | null;
  /** auth.users.id — crm_recently_viewed.user_id. Looked up when omitted. */
  user_id?: string | null;
}

export interface BuildPeopleQueueOptions {
  /** Max queue items (default 12). */
  limit?: number;
  /** Max "recently viewed" rail entries (default 6). */
  recentLimit?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

const RECORD_COLUMNS =
  'id, module_id, title, email, phone, status, stage, market_type, normalized_advisor_name, normalized_agent_name, updated_at, created_at, data';

const PEOPLE_MODULE_KEYS = ['contacts', 'members', 'leads'] as const;
const PENDING_MODULE_KEYS = ['contacts', 'members'] as const;
const STARTING_SOON_KEYS = ['sharing_effective_date', 'start_date', 'effective_date'] as const;

const TASK_LIMIT = 30;
const SOURCE_LIMIT = 40;
const WINDOW_DAYS = 30;

interface TaskRow {
  id: string;
  title: string;
  due_at: string | null;
  record_id: string | null;
  assigned_to: string | null;
}

interface RecentRow {
  record_id: string;
  last_viewed_at: string;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export async function buildPeopleQueue(
  profile: PeopleQueueProfile,
  opts: BuildPeopleQueueOptions = {},
): Promise<PeopleQueue> {
  const limit = opts.limit ?? 12;
  const recentLimit = opts.recentLimit ?? 6;
  const now = opts.now ?? new Date();
  const orgId = profile.organization_id;

  const today = isoDay(now);
  const startOfToday = `${today}T00:00:00.000Z`;
  const endOfToday = `${isoDay(addDays(now, 1))}T00:00:00.000Z`;
  const windowEnd = isoDay(addDays(now, WINDOW_DAYS));
  const windowStartTs = addDays(now, -WINDOW_DAYS).toISOString();

  const empty: PeopleQueue = {
    items: [],
    counts: { tasksToday: 0, overdue: 0, pending: 0, startingSoon: 0 },
    recentlyViewed: [],
    degraded: false,
  };

  let degraded = false;
  const fail = (label: string, err: unknown) => {
    degraded = true;
    console.warn(`[PeopleQueue] ${label} failed:`, err instanceof Error ? err.message : err);
  };

  let supabase: Awaited<ReturnType<typeof createCrmClient>>;
  try {
    supabase = await createCrmClient();
  } catch (err) {
    fail('client', err);
    return { ...empty, degraded: true };
  }

  // -- Modules -------------------------------------------------------------
  const moduleKeyById = new Map<string, string>();
  const moduleIdByKey = new Map<string, string>();
  try {
    const modules = await getCachedModules(orgId);
    for (const m of modules) {
      moduleKeyById.set(m.id, m.key);
      moduleIdByKey.set(m.key, m.id);
    }
  } catch (err) {
    fail('modules', err);
  }
  const peopleModuleIds = PEOPLE_MODULE_KEYS.map((k) => moduleIdByKey.get(k)).filter(
    (id): id is string => Boolean(id),
  );
  const pendingModuleIds = PENDING_MODULE_KEYS.map((k) => moduleIdByKey.get(k)).filter(
    (id): id is string => Boolean(id),
  );

  const records = new Map<string, { row: PeopleQueueRecordRow; moduleKey: string }>();
  const hits: PeopleQueueHit[] = [];
  const counts: PeopleQueueCounts = { tasksToday: 0, overdue: 0, pending: 0, startingSoon: 0 };

  const remember = (rows: PeopleQueueRecordRow[] | null | undefined): PeopleQueueRecordRow[] => {
    const kept: PeopleQueueRecordRow[] = [];
    for (const row of rows ?? []) {
      const moduleKey = moduleKeyById.get(row.module_id);
      if (!moduleKey) continue;
      // Tasks / recently-viewed can point at deals, carriers, etc. — this is a
      // queue of PEOPLE, so anything outside the people modules is dropped.
      if (!(PEOPLE_MODULE_KEYS as readonly string[]).includes(moduleKey)) continue;
      if (isConvertedLeadRow({ module_key: moduleKey, status: row.status ?? null, data: row.data ?? null })) {
        continue;
      }
      if (!records.has(row.id)) records.set(row.id, { row, moduleKey });
      kept.push(row);
    }
    return kept;
  };

  const startingSoonOr = STARTING_SOON_KEYS.map(
    (k) => `and(data->>${k}.gte.${today},data->>${k}.lte.${windowEnd})`,
  ).join(',');
  const pendingOr =
    'data->>contact_status.ilike.pending,data->>sharing_status.ilike.pending,status.ilike.pending';

  // -- Fire every source in parallel; each settles independently ------------
  const [
    tasksRes,
    overdueCountRes,
    todayCountRes,
    pendingRes,
    pendingCountRes,
    startingRes,
    startingCountRes,
    newRes,
    userIdRes,
  ] = await Promise.allSettled([
    // 1. open tasks with a record, due before end of today (overdue + today)
    supabase
      .from('crm_tasks')
      .select('id, title, due_at, record_id, assigned_to')
      .eq('org_id', orgId)
      .is('deleted_at' as never, null)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .not('record_id', 'is', null)
      .lt('due_at', endOfToday)
      .order('due_at', { ascending: true })
      .limit(TASK_LIMIT),
    supabase
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at' as never, null)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .lt('due_at', startOfToday),
    supabase
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at' as never, null)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .gte('due_at', startOfToday)
      .lt('due_at', endOfToday),
    // 2. pending people
    pendingModuleIds.length
      ? supabase
          .from('crm_records')
          .select(RECORD_COLUMNS)
          .eq('org_id', orgId)
          .in('module_id', pendingModuleIds)
          .is('deleted_at' as never, null)
          .or(pendingOr)
          // Oldest-updated first: the ranker surfaces the longest-waiting
          // pending people, so the LIMIT must keep those rows, not the newest.
          .order('updated_at', { ascending: true })
          .limit(SOURCE_LIMIT)
      : Promise.resolve({ data: [], error: null, count: null }),
    pendingModuleIds.length
      ? supabase
          .from('crm_records')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('module_id', pendingModuleIds)
          .is('deleted_at' as never, null)
          .or(pendingOr)
      : Promise.resolve({ data: null, error: null, count: 0 }),
    // 3. starting soon
    peopleModuleIds.length
      ? supabase
          .from('crm_records')
          .select(RECORD_COLUMNS)
          .eq('org_id', orgId)
          .in('module_id', peopleModuleIds)
          .is('deleted_at' as never, null)
          .or(startingSoonOr)
          .or('status.is.null,status.not.ilike.cancel%')
          .order('updated_at', { ascending: false })
          .limit(SOURCE_LIMIT)
      : Promise.resolve({ data: [], error: null, count: null }),
    peopleModuleIds.length
      ? supabase
          .from('crm_records')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('module_id', peopleModuleIds)
          .is('deleted_at' as never, null)
          .or(startingSoonOr)
          .or('status.is.null,status.not.ilike.cancel%')
      : Promise.resolve({ data: null, error: null, count: 0 }),
    // 4. new in the last 30 days
    peopleModuleIds.length
      ? supabase
          .from('crm_records')
          .select(RECORD_COLUMNS)
          .eq('org_id', orgId)
          .in('module_id', peopleModuleIds)
          .is('deleted_at' as never, null)
          .gte('created_at', windowStartTs)
          .order('created_at', { ascending: false })
          .limit(SOURCE_LIMIT)
      : Promise.resolve({ data: [], error: null, count: null }),
    // 5a. auth user id for recently-viewed (only when not supplied)
    profile.user_id
      ? Promise.resolve({ data: { user_id: profile.user_id }, error: null })
      : supabase.from('profiles').select('user_id').eq('id', profile.id).maybeSingle(),
  ]);

  // -- Tasks ---------------------------------------------------------------
  const taskRows: TaskRow[] = [];
  if (tasksRes.status === 'fulfilled' && !tasksRes.value.error) {
    taskRows.push(...((tasksRes.value.data ?? []) as unknown as TaskRow[]));
  } else {
    fail('tasks', tasksRes.status === 'rejected' ? tasksRes.reason : tasksRes.value.error);
  }
  if (overdueCountRes.status === 'fulfilled' && !overdueCountRes.value.error) {
    counts.overdue = overdueCountRes.value.count ?? 0;
  } else {
    fail('overdue count', overdueCountRes.status === 'rejected' ? overdueCountRes.reason : overdueCountRes.value.error);
  }
  if (todayCountRes.status === 'fulfilled' && !todayCountRes.value.error) {
    counts.tasksToday = todayCountRes.value.count ?? 0;
  } else {
    fail('today count', todayCountRes.status === 'rejected' ? todayCountRes.reason : todayCountRes.value.error);
  }

  // -- Pending -------------------------------------------------------------
  let pendingRows: PeopleQueueRecordRow[] = [];
  if (pendingRes.status === 'fulfilled' && !pendingRes.value.error) {
    pendingRows = remember((pendingRes.value.data ?? []) as unknown as PeopleQueueRecordRow[]);
    for (const row of pendingRows) hits.push({ recordId: row.id, reason: 'pending' });
  } else {
    fail('pending', pendingRes.status === 'rejected' ? pendingRes.reason : pendingRes.value.error);
  }
  if (pendingCountRes.status === 'fulfilled' && !pendingCountRes.value.error) {
    counts.pending = pendingCountRes.value.count ?? pendingRows.length;
  } else {
    counts.pending = pendingRows.length;
    fail('pending count', pendingCountRes.status === 'rejected' ? pendingCountRes.reason : pendingCountRes.value.error);
  }

  // -- Starting soon -------------------------------------------------------
  let startingRows: PeopleQueueRecordRow[] = [];
  if (startingRes.status === 'fulfilled' && !startingRes.value.error) {
    startingRows = remember((startingRes.value.data ?? []) as unknown as PeopleQueueRecordRow[]);
    for (const row of startingRows) hits.push({ recordId: row.id, reason: 'starting_soon' });
  } else {
    fail('starting soon', startingRes.status === 'rejected' ? startingRes.reason : startingRes.value.error);
  }
  if (startingCountRes.status === 'fulfilled' && !startingCountRes.value.error) {
    // When the page fits in one fetch, prefer the in-code count (converted
    // leads and stale-date matches removed); otherwise trust the DB count.
    const dbCount = startingCountRes.value.count ?? 0;
    counts.startingSoon = dbCount <= SOURCE_LIMIT ? startingRows.length : dbCount;
  } else {
    counts.startingSoon = startingRows.length;
    fail('starting soon count', startingCountRes.status === 'rejected' ? startingCountRes.reason : startingCountRes.value.error);
  }

  // -- New -----------------------------------------------------------------
  if (newRes.status === 'fulfilled' && !newRes.value.error) {
    const rows = remember((newRes.value.data ?? []) as unknown as PeopleQueueRecordRow[]);
    for (const row of rows) hits.push({ recordId: row.id, reason: 'new' });
  } else {
    fail('new records', newRes.status === 'rejected' ? newRes.reason : newRes.value.error);
  }

  // -- Recently viewed (needs the auth user id) ----------------------------
  let recentRows: RecentRow[] = [];
  let authUserId: string | null = null;
  if (userIdRes.status === 'fulfilled' && !userIdRes.value.error) {
    authUserId = (userIdRes.value.data as { user_id?: string | null } | null)?.user_id ?? null;
  } else {
    fail('profile user id', userIdRes.status === 'rejected' ? userIdRes.reason : userIdRes.value.error);
  }
  if (authUserId) {
    try {
      const { data, error } = await supabase
        .from('crm_recently_viewed')
        .select('record_id, last_viewed_at')
        .eq('user_id', authUserId)
        .eq('organization_id', orgId)
        .order('last_viewed_at', { ascending: false })
        .limit(recentLimit + 6);
      if (error) throw error;
      recentRows = (data ?? []) as unknown as RecentRow[];
    } catch (err) {
      fail('recently viewed', err);
    }
  }

  // -- Fetch referenced records not yet loaded (tasks + recent) ------------
  const missingIds = new Set<string>();
  for (const t of taskRows) if (t.record_id && !records.has(t.record_id)) missingIds.add(t.record_id);
  for (const r of recentRows) if (!records.has(r.record_id)) missingIds.add(r.record_id);
  if (missingIds.size > 0) {
    try {
      const { data, error } = await supabase
        .from('crm_records')
        .select(RECORD_COLUMNS)
        .eq('org_id', orgId)
        .in('id', [...missingIds].slice(0, 60))
        .is('deleted_at' as never, null);
      if (error) throw error;
      remember((data ?? []) as unknown as PeopleQueueRecordRow[]);
    } catch (err) {
      fail('referenced records', err);
    }
  }

  // Task hits (record must exist and be visible).
  for (const t of taskRows) {
    if (!t.record_id || !records.has(t.record_id)) continue;
    // Numeric compare: PostgREST emits '+00:00' offsets, so a lexicographic
    // compare against '...000Z' misclassifies same-day timestamps.
    const overdue = t.due_at != null && Date.parse(t.due_at) < Date.parse(startOfToday);
    hits.push({
      recordId: t.record_id,
      reason: overdue ? 'overdue_task' : 'task_today',
      task: { id: t.id, title: t.title, dueAt: t.due_at },
    });
  }

  // Recent hits (weak reason) + rail.
  const recentlyViewed: PeopleQueue['recentlyViewed'] = [];
  for (const r of recentRows) {
    const rec = records.get(r.record_id);
    if (!rec) continue;
    hits.push({ recordId: r.record_id, reason: 'recent', viewedAt: r.last_viewed_at });
    if (recentlyViewed.length < recentLimit) {
      const item = buildPeopleQueueItem({
        row: rec.row,
        moduleKey: rec.moduleKey,
        reasons: ['recent'],
        viewedAt: r.last_viewed_at,
        now,
      });
      recentlyViewed.push({
        recordId: item.recordId,
        moduleKey: item.moduleKey,
        name: item.name,
        initials: item.initials,
        href: item.href,
        status: item.status,
        city: item.city,
        plan: item.plan,
      });
    }
  }

  const items = assemblePeopleQueue({ records, hits, now, limit });

  return { items, counts, recentlyViewed, degraded };
}
