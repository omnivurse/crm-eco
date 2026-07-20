/**
 * Server-side habit aggregation (0 tokens).
 * Used by /api/cron/habits-aggregate.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateHabits, type PreferenceViewHint } from './score';
import {
  emptyHabitsProfile,
  parseHabitsProfile,
  type CrmHabitsProfile,
} from './types';

const SIGNAL_LOOKBACK_DAYS = 90;
const RECENT_LOOKBACK_DAYS = 90;

interface ActiveUserRow {
  user_id: string;
  organization_id: string;
  profile_id: string;
  ui_preferences: Record<string, unknown> | null;
}

/**
 * Find users who generated signals or recently-viewed rows in the lookback window.
 */
export async function listActiveHabitUsers(
  supabase: SupabaseClient,
  opts?: { sinceIso?: string; limit?: number },
): Promise<ActiveUserRow[]> {
  const since =
    opts?.sinceIso ??
    new Date(Date.now() - RECENT_LOOKBACK_DAYS * 86_400_000).toISOString();
  const limit = opts?.limit ?? 500;

  const { data: recentUsers, error: rvErr } = await supabase
    .from('crm_recently_viewed')
    .select('user_id, organization_id')
    .gte('last_viewed_at', since)
    .limit(2000);

  if (rvErr) {
    console.error('[habits-aggregate] recently_viewed scan:', rvErr);
  }

  const { data: signalUsers, error: sigErr } = await supabase
    .from('crm_user_signals')
    .select('user_id, organization_id')
    .gte('created_at', since)
    .limit(2000);

  if (sigErr && sigErr.code !== '42P01') {
    console.error('[habits-aggregate] signals scan:', sigErr);
  }

  const key = (u: string, o: string) => `${u}:${o}`;
  const seen = new Map<string, { user_id: string; organization_id: string }>();
  for (const row of [...(recentUsers ?? []), ...(signalUsers ?? [])]) {
    if (!row.user_id || !row.organization_id) continue;
    seen.set(key(row.user_id, row.organization_id), {
      user_id: row.user_id,
      organization_id: row.organization_id,
    });
  }

  const pairs = [...seen.values()].slice(0, limit);
  if (pairs.length === 0) return [];

  const userIds = [...new Set(pairs.map((p) => p.user_id))];
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, user_id, organization_id, ui_preferences')
    .in('user_id', userIds);

  if (profErr) {
    console.error('[habits-aggregate] profiles:', profErr);
    return [];
  }

  const out: ActiveUserRow[] = [];
  for (const pair of pairs) {
    const profile = (profiles ?? []).find(
      (p) =>
        p.user_id === pair.user_id &&
        (p.organization_id === pair.organization_id || !p.organization_id),
    );
    if (!profile) continue;
    out.push({
      user_id: pair.user_id,
      organization_id: pair.organization_id,
      profile_id: profile.id,
      ui_preferences: (profile.ui_preferences as Record<string, unknown>) ?? null,
    });
  }
  return out;
}

export async function buildHabitsForUser(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<CrmHabitsProfile> {
  const since = new Date(Date.now() - RECENT_LOOKBACK_DAYS * 86_400_000).toISOString();

  const { data: recentRows } = await supabase
    .from('crm_recently_viewed')
    .select(
      `record_id, view_count, last_viewed_at,
       module:crm_modules ( key ),
       record:crm_records ( title )`,
    )
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .gte('last_viewed_at', since)
    .order('last_viewed_at', { ascending: false })
    .limit(200);

  const { data: signals } = await supabase
    .from('crm_user_signals')
    .select('signal_type, module_key, entity_id, meta, created_at')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  // crm_user_preferences uses org_id in some schemas — try both.
  let prefHints: PreferenceViewHint[] = [];
  const { data: prefsByOrgId } = await supabase
    .from('crm_user_preferences')
    .select('module_key, preferences')
    .eq('user_id', userId)
    .eq('org_id', orgId);

  const prefRows =
    prefsByOrgId ??
    (
      await supabase
        .from('crm_user_preferences')
        .select('module_key, preferences')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
    ).data;

  for (const row of prefRows ?? []) {
    const viewId = (row.preferences as { viewId?: string } | null)?.viewId;
    if (row.module_key && viewId) {
      prefHints.push({ module_key: row.module_key, view_id: viewId });
    }
  }

  const recentlyViewed = (recentRows ?? []).map((row) => {
    const moduleRel = row.module as { key?: string } | { key?: string }[] | null;
    const moduleKey = Array.isArray(moduleRel)
      ? moduleRel[0]?.key ?? null
      : moduleRel?.key ?? null;
    const recordRel = row.record as { title?: string } | { title?: string }[] | null;
    const title = Array.isArray(recordRel)
      ? recordRel[0]?.title ?? null
      : recordRel?.title ?? null;
    return {
      record_id: row.record_id as string,
      module_key: moduleKey,
      view_count: Number(row.view_count) || 1,
      last_viewed_at: row.last_viewed_at as string,
      title,
    };
  });

  return aggregateHabits({
    recentlyViewed,
    signals: (signals ?? []).map((s) => ({
      signal_type: s.signal_type as string,
      module_key: s.module_key as string | null,
      entity_id: s.entity_id as string | null,
      meta: (s.meta as Record<string, unknown>) ?? {},
      created_at: s.created_at as string,
    })),
    preferredViews: prefHints,
  });
}

export async function persistHabitsProfile(
  supabase: SupabaseClient,
  profileId: string,
  existingPrefs: Record<string, unknown> | null,
  habits: CrmHabitsProfile,
): Promise<{ ok: boolean; error?: string }> {
  const prev = parseHabitsProfile(existingPrefs?.habits) ?? emptyHabitsProfile();
  const merged: CrmHabitsProfile = {
    ...habits,
    // Preserve AI tips / opt-out until the AI cron refreshes them.
    ai_tips: prev.ai_tips,
    ai_generated_at: prev.ai_generated_at,
    ai_tips_enabled: prev.ai_tips_enabled !== false,
    ai_last_tokens: prev.ai_last_tokens ?? null,
  };

  const nextPrefs = {
    ...(existingPrefs ?? {}),
    habits: merged,
  };

  const { error } = await supabase
    .from('profiles')
    .update({ ui_preferences: nextPrefs })
    .eq('id', profileId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function purgeOldSignals(
  supabase: SupabaseClient,
  olderThanDays = SIGNAL_LOOKBACK_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('crm_user_signals')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    if (error.code === '42P01') return 0;
    console.error('[habits-aggregate] purge:', error);
    return 0;
  }
  return data?.length ?? 0;
}
