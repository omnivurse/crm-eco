/**
 * GET/POST /api/cron/habits-aggregate
 *
 * Nightly (0 tokens): aggregate crm_recently_viewed + crm_user_signals
 * into profiles.ui_preferences.habits for active users. Purges signals >90d.
 *
 * Auth: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  buildHabitsForUser,
  listActiveHabitUsers,
  persistHabitsProfile,
  purgeOldSignals,
} from '@/lib/crm/habits/aggregate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Service role unavailable' }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const users = await listActiveHabitUsers(supabase, { sinceIso: since7d, limit: 500 });

  let updated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const habits = await buildHabitsForUser(
        supabase,
        user.user_id,
        user.organization_id,
      );
      const result = await persistHabitsProfile(
        supabase,
        user.profile_id,
        user.ui_preferences,
        habits,
      );
      if (result.ok) updated += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error('[habits-aggregate] user failed', user.user_id, err);
    }
  }

  const purged = await purgeOldSignals(supabase, 90);

  return NextResponse.json({
    ok: true,
    candidates: users.length,
    updated,
    failed,
    purged_signals: purged,
  });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
