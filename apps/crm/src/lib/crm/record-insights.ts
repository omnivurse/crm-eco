/**
 * Record Insights
 *
 * Server-side query that powers the right-rail insights panel and the live
 * count badges on the left related-list nav in `RecordDetailShellV2`.
 *
 * The "best time to" heuristic is intentionally simple and defensive so that
 * (a) it never blocks record rendering and (b) it can evolve without
 * schema changes:
 *
 *   1. Pull completed activities for the record.
 *   2. Bucket their completion timestamps (or due date) by hour-of-day.
 *   3. The hour with the most completions becomes the suggested best time,
 *      as long as we have at least MIN_SIGNAL_POINTS data points.
 *   4. Any failure (missing tables, RLS, etc.) returns null — the UI shows
 *      "No best time for the day" which matches Zoho's empty state.
 *
 * All queries short-circuit to safe defaults if the underlying table is
 * absent. This matches the rest of the codebase where CRM tables may be
 * missing on staging envs that haven't run every migration.
 */

import { createCrmClient, resolveNoteSourceRecordIds } from './queries';
import { moduleKeyFromJoinedRelation } from './note-aggregate';
import type { ActivityType, CrmRecord } from './types';

export interface InsightBestTime {
  /** Channel the suggestion applies to. */
  channel: 'call' | 'email';
  /** Preformatted user-facing value like "2:00 PM" — null = insufficient data. */
  value: string | null;
  /** Underlying sample size so callers can decide how to display confidence. */
  samples: number;
  /** Human-readable tooltip ("Based on 7 completed calls"). */
  hint?: string;
}

export interface RecordInsightCounts {
  notes: number;
  emails: number;
  open_activities: number;
  closed_activities: number;
  attachments: number;
  related: number;
}

export interface RecordInsights {
  counts: RecordInsightCounts;
  bestTime: InsightBestTime[];
  /** Most recent meaningful interaction timestamp (task / note / attachment). */
  lastInteractionAt: string | null;
}

const MIN_SIGNAL_POINTS = 3;

/** Empty insights used as the fallback when the record cannot be read. */
export function emptyRecordInsights(): RecordInsights {
  return {
    counts: {
      notes: 0,
      emails: 0,
      open_activities: 0,
      closed_activities: 0,
      attachments: 0,
      related: 0,
    },
    bestTime: [
      { channel: 'call', value: null, samples: 0 },
      { channel: 'email', value: null, samples: 0 },
    ],
    lastInteractionAt: null,
  };
}

/**
 * Compute insights for a record. Always resolves — errors degrade to zero
 * counts and null best-time suggestions so the detail page never fails to
 * render because of insight query issues.
 */
export async function getRecordInsights(recordId: string): Promise<RecordInsights> {
  try {
    const supabase = await createCrmClient();

    let noteSourceIds: string[] = [recordId];
    try {
      const { data: row } = await supabase
        .from('crm_records')
        .select('id, data, module:crm_modules!crm_records_module_id_fkey(key)')
        .eq('id', recordId)
        .maybeSingle();
      if (row?.id) {
        const moduleKey = moduleKeyFromJoinedRelation(row.module);
        const record = { id: row.id, data: row.data } as CrmRecord;
        noteSourceIds = await resolveNoteSourceRecordIds(record, moduleKey);
      }
    } catch {
      noteSourceIds = [recordId];
    }

    const [
      notesCount,
      emailsCount,
      openActivitiesCount,
      closedActivitiesCount,
      attachmentsCount,
      linksOutCount,
      linksInCount,
      callSignal,
      emailSignal,
      recentInteractions,
    ] = await Promise.allSettled([
      headCountIn(supabase, 'crm_notes', {}, 'record_id', noteSourceIds),
      headCount(supabase, 'crm_tasks', { record_id: recordId, activity_type: 'email' }),
      // Anything not completed / cancelled counts as "open"
      headCountIn(supabase, 'crm_tasks', { record_id: recordId }, 'status', ['open', 'in_progress']),
      headCountIn(supabase, 'crm_tasks', { record_id: recordId }, 'status', ['completed']),
      headCount(supabase, 'crm_attachments', { record_id: recordId }),
      headCount(supabase, 'crm_record_links', { source_record_id: recordId }),
      headCount(supabase, 'crm_record_links', { target_record_id: recordId }),
      bestTimeForChannel(supabase, recordId, 'call'),
      bestTimeForChannel(supabase, recordId, 'email'),
      lastInteractionFor(supabase, recordId, noteSourceIds),
    ]);

    const notes = settleOrZero(notesCount);
    const emails = settleOrZero(emailsCount);
    const openActivities = settleOrZero(openActivitiesCount);
    const closedActivities = settleOrZero(closedActivitiesCount);
    const attachments = settleOrZero(attachmentsCount);
    const related = settleOrZero(linksOutCount) + settleOrZero(linksInCount);

    const bestCall: InsightBestTime =
      callSignal.status === 'fulfilled' && callSignal.value
        ? callSignal.value
        : { channel: 'call', value: null, samples: 0 };
    const bestEmail: InsightBestTime =
      emailSignal.status === 'fulfilled' && emailSignal.value
        ? emailSignal.value
        : { channel: 'email', value: null, samples: 0 };

    const lastInteractionAt =
      recentInteractions.status === 'fulfilled' ? recentInteractions.value : null;

    return {
      counts: {
        notes,
        emails,
        open_activities: openActivities,
        closed_activities: closedActivities,
        attachments,
        related,
      },
      bestTime: [bestCall, bestEmail],
      lastInteractionAt,
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[record-insights] failed, using empty defaults:', err);
    }
    return emptyRecordInsights();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Client = Awaited<ReturnType<typeof createCrmClient>>;

function settleOrZero(result: PromiseSettledResult<number>): number {
  return result.status === 'fulfilled' ? result.value : 0;
}

async function headCount(
  supabase: Client,
  table: string,
  eqs: Record<string, string>,
): Promise<number> {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(eqs)) q = q.eq(k, v);
    const { count, error } = await q;
    if (error) {
      if (error.code === '42P01') return 0; // table missing
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function headCountIn(
  supabase: Client,
  table: string,
  eqs: Record<string, string>,
  field: string,
  values: string[],
): Promise<number> {
  if (values.length === 0) return 0;
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(eqs)) q = q.eq(k, v);
    q = q.in(field, values);
    const { count, error } = await q;
    if (error) {
      if (error.code === '42P01') return 0;
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function bestTimeForChannel(
  supabase: Client,
  recordId: string,
  channel: Extract<ActivityType, 'call' | 'email'>,
): Promise<InsightBestTime> {
  try {
    const { data, error } = await supabase
      .from('crm_tasks')
      .select('completed_at, due_at, created_at')
      .eq('record_id', recordId)
      .eq('activity_type', channel)
      .eq('status', 'completed')
      .limit(200);

    if (error || !data?.length) {
      return { channel, value: null, samples: 0 };
    }

    const buckets = new Map<number, number>();
    for (const row of data as Array<{ completed_at: string | null; due_at: string | null; created_at: string }>) {
      const ts = row.completed_at || row.due_at || row.created_at;
      if (!ts) continue;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) continue;
      const hour = d.getHours();
      buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
    }

    if (buckets.size === 0) {
      return { channel, value: null, samples: 0 };
    }

    let topHour = 0;
    let topCount = 0;
    for (const [hour, count] of buckets.entries()) {
      if (count > topCount) {
        topHour = hour;
        topCount = count;
      }
    }

    const totalSamples = Array.from(buckets.values()).reduce((a, b) => a + b, 0);
    if (totalSamples < MIN_SIGNAL_POINTS) {
      return { channel, value: null, samples: totalSamples };
    }

    return {
      channel,
      value: formatHour(topHour),
      samples: totalSamples,
      hint: `Based on ${totalSamples} completed ${channel === 'call' ? 'call' : 'email'}${
        totalSamples === 1 ? '' : 's'
      }`,
    };
  } catch {
    return { channel, value: null, samples: 0 };
  }
}

async function lastInteractionFor(
  supabase: Client,
  recordId: string,
  noteRecordIds: string[],
): Promise<string | null> {
  try {
    const noteIds = noteRecordIds.length > 0 ? noteRecordIds : [recordId];
    const [tasks, notes, attachments] = await Promise.allSettled([
      supabase
        .from('crm_tasks')
        .select('created_at')
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('crm_notes')
        .select('created_at')
        .in('record_id', noteIds)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('crm_attachments')
        .select('created_at')
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    const candidates: string[] = [];
    if (tasks.status === 'fulfilled' && tasks.value.data?.[0]?.created_at) {
      candidates.push(tasks.value.data[0].created_at as string);
    }
    if (notes.status === 'fulfilled' && notes.value.data?.[0]?.created_at) {
      candidates.push(notes.value.data[0].created_at as string);
    }
    if (attachments.status === 'fulfilled' && attachments.value.data?.[0]?.created_at) {
      candidates.push(attachments.value.data[0].created_at as string);
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return candidates[0];
  } catch {
    return null;
  }
}

function formatHour(hour: number): string {
  // 24h -> 12h label, e.g. 14 -> "2:00 PM", 0 -> "12:00 AM".
  const clamped = ((hour % 24) + 24) % 24;
  const isPM = clamped >= 12;
  const twelve = clamped % 12 === 0 ? 12 : clamped % 12;
  return `${twelve}:00 ${isPM ? 'PM' : 'AM'}`;
}
