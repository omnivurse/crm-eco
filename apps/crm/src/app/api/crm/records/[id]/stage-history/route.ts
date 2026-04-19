/**
 * GET /api/crm/records/[id]/stage-history
 *
 * Returns the chronological stage-transition history for a single CRM record
 * plus a lightweight velocity summary (time in current stage, avg duration,
 * last N transitions). Powers the V2 kanban "history" drawer.
 *
 * All queries are RLS-scoped through `createCrmClient`; users can only see
 * history for records their org and role policies expose.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';

export const dynamic = 'force-dynamic';

interface StageHistoryTransition {
  id: string;
  from_stage: string | null;
  to_stage: string;
  duration_seconds: number | null;
  changed_by: string | null;
  changed_by_name: string | null;
  reason: string | null;
  created_at: string;
}

interface StageHistoryResponse {
  record_id: string;
  current_stage: string | null;
  current_stage_since: string | null;
  current_stage_seconds: number | null;
  transitions: StageHistoryTransition[];
  average_duration_seconds: number | null;
  total_transitions: number;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createCrmClient();

  // Pre-flight: confirm the record exists AND RLS lets us see it. We also
  // pull the current stage so the drawer can show "time in current stage"
  // even when the latest transition timestamp has drifted.
  const { data: record, error: recordErr } = await supabase
    .from('crm_records')
    .select('id, stage, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (recordErr) {
    return NextResponse.json({ error: recordErr.message }, { status: 500 });
  }
  if (!record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  // Pull up to 100 most recent transitions with the actor's display name.
  // 100 is a generous cap; most deals never transition more than ~10 times.
  const { data: rawHistory, error: historyErr } = await supabase
    .from('crm_deal_stage_history')
    .select(
      `
      id,
      from_stage,
      to_stage,
      duration_seconds,
      changed_by,
      reason,
      created_at
      `,
    )
    .eq('record_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (historyErr) {
    return NextResponse.json({ error: historyErr.message }, { status: 500 });
  }

  type RawRow = {
    id: string;
    from_stage: string | null;
    to_stage: string;
    duration_seconds: number | null;
    changed_by: string | null;
    reason: string | null;
    created_at: string;
  };

  const rows = (rawHistory ?? []) as RawRow[];

  // Resolve actor display names in a single round-trip. We do this as a
  // separate query instead of a PostgREST embedded join because the FK
  // relationship name differs across environments and the embedded syntax
  // is brittle to rename; a batched `in()` lookup is trivially fast.
  const actorIds = Array.from(
    new Set(rows.map((r) => r.changed_by).filter((v): v is string => !!v)),
  );
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds);
    if (!profilesErr && profiles) {
      for (const p of profiles as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
      }>) {
        const name =
          p.full_name || (p.email ? p.email.split('@')[0] : null);
        if (name) actorMap.set(p.id, name);
      }
    }
  }

  const transitions: StageHistoryTransition[] = rows.map((row) => ({
    id: row.id,
    from_stage: row.from_stage,
    to_stage: row.to_stage,
    duration_seconds: row.duration_seconds,
    changed_by: row.changed_by,
    changed_by_name: row.changed_by ? actorMap.get(row.changed_by) ?? null : null,
    reason: row.reason,
    created_at: row.created_at,
  }));

  // Average stage duration across *completed* transitions
  // (those with a measured `duration_seconds`). The most-recent transition's
  // duration is time spent in the *previous* stage, so this captures real
  // throughput cleanly.
  const durations = transitions
    .map((t) => t.duration_seconds)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const averageDurationSeconds =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  // Time-in-current-stage is the gap between now and the most recent
  // transition into `record.stage`. If there's no matching transition
  // (e.g., the record was imported already in that stage) we fall back
  // to `updated_at` so the drawer still shows a sensible number.
  const latestIntoCurrent = record.stage
    ? transitions.find((t) => t.to_stage === record.stage)
    : null;
  const currentStageSince =
    latestIntoCurrent?.created_at ?? record.updated_at ?? null;
  const currentStageSeconds = currentStageSince
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(currentStageSince).getTime()) / 1000,
        ),
      )
    : null;

  const response: StageHistoryResponse = {
    record_id: id,
    current_stage: record.stage ?? null,
    current_stage_since: currentStageSince,
    current_stage_seconds: currentStageSeconds,
    transitions,
    average_duration_seconds: averageDurationSeconds,
    total_transitions: transitions.length,
  };

  return NextResponse.json(response);
}
