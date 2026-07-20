/**
 * GET/POST /api/cron/habits-ai-tips
 *
 * Nightly budgeted OpenAI batch: turn aggregated habits into 3 coaching tips.
 * Never sends PHI. Skips users without recent activity / already refreshed today.
 * Soft org daily token ceiling via HABITS_AI_ORG_DAILY_TOKEN_BUDGET.
 *
 * Auth: x-vercel-cron or Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { listActiveHabitUsers } from '@/lib/crm/habits/aggregate';
import { parseHabitsProfile } from '@/lib/crm/habits/types';
import {
  DEFAULT_ORG_DAILY_TOKEN_BUDGET,
  generateHabitsAiTips,
  getOrgTokensUsedToday,
  persistAiTips,
  shouldRefreshAiTips,
} from '@/lib/crm/habits/ai-tips';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'AI_NOT_CONFIGURED',
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Service role unavailable' }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const orgBudget = Number(
    process.env.HABITS_AI_ORG_DAILY_TOKEN_BUDGET || DEFAULT_ORG_DAILY_TOKEN_BUDGET,
  );

  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const users = await listActiveHabitUsers(supabase, { sinceIso: since7d, limit: 200 });

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let tokensUsed = 0;
  const orgSpend = new Map<string, number>();

  for (const user of users) {
    try {
      const habits = parseHabitsProfile(user.ui_preferences?.habits);
      if (!habits || habits.top_modules.length === 0) {
        skipped += 1;
        continue;
      }
      if (!shouldRefreshAiTips(habits)) {
        skipped += 1;
        continue;
      }

      let spent = orgSpend.get(user.organization_id);
      if (spent === undefined) {
        spent = await getOrgTokensUsedToday(supabase, user.organization_id);
        orgSpend.set(user.organization_id, spent);
      }
      if (spent >= orgBudget) {
        skipped += 1;
        continue;
      }

      const result = await generateHabitsAiTips(habits);
      if (!result) {
        skipped += 1;
        continue;
      }

      await persistAiTips(
        supabase,
        user.profile_id,
        user.ui_preferences,
        result.tips,
        result.tokens,
      );

      generated += 1;
      tokensUsed += result.tokens;
      orgSpend.set(user.organization_id, spent + result.tokens);

      // Safe metadata audit — no prompt dump
      console.info('[habits-ai-tips]', {
        org: user.organization_id,
        profile: user.profile_id,
        tokens: result.tokens,
        model: result.model,
        tip_count: result.tips.length,
      });
    } catch (err) {
      failed += 1;
      console.error('[habits-ai-tips] user failed', user.user_id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: users.length,
    generated,
    skipped,
    failed,
    tokens_used: tokensUsed,
  });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
