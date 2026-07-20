/**
 * Budgeted OpenAI habit coach (nightly batch only).
 * Input: aggregated habit JSON — never PHI / note bodies / emails.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyHabitsProfile,
  parseHabitsProfile,
  type CrmHabitsProfile,
  type HabitAiTip,
} from './types';

export const HABITS_AI_MAX_INPUT_CHARS = 1200;
export const HABITS_AI_MAX_OUTPUT_TOKENS = 200;
export const DEFAULT_ORG_DAILY_TOKEN_BUDGET = 200_000;

const DEFAULT_MODEL = process.env.OPENAI_MODEL_HABITS || 'gpt-4o-mini';

const SYSTEM = `You coach CRM power users. Given ONLY aggregated usage stats \
(module keys, scores, active hours, action rates), return exactly 3 short, \
actionable tips (max 140 characters each). Rules:
- JSON only: {"tips":[{"id":"t1","text":"...","module_key":"leads"|null}, ...]}
- Use module_key only when it matches an input top_modules key; else null.
- No PHI, no names, no emails, no record IDs in tip text.
- Be concrete (which module to open, what cadence to keep).`;

export function buildHabitsAiPayload(habits: CrmHabitsProfile): string {
  const payload = {
    top_modules: habits.top_modules.slice(0, 5).map((m) => ({
      key: m.key,
      score: m.score,
    })),
    preferred_views: Object.keys(habits.preferred_views).slice(0, 6),
    active_hours: habits.active_hours.slice(0, 4),
    action_rates: habits.action_rates,
  };
  let json = JSON.stringify(payload);
  if (json.length > HABITS_AI_MAX_INPUT_CHARS) {
    json = json.slice(0, HABITS_AI_MAX_INPUT_CHARS);
  }
  return json;
}

export function parseAiTipsResponse(raw: string): HabitAiTip[] {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as { tips?: HabitAiTip[] };
    if (!Array.isArray(parsed.tips)) return [];
    return parsed.tips
      .filter((t) => t && typeof t.text === 'string' && t.text.trim().length > 0)
      .slice(0, 3)
      .map((t, i) => ({
        id: typeof t.id === 'string' && t.id ? t.id : `tip-${i + 1}`,
        text: String(t.text).trim().slice(0, 160),
        module_key:
          typeof t.module_key === 'string' && t.module_key ? t.module_key : undefined,
        dismissed: false,
      }));
  } catch {
    return [];
  }
}

export function shouldRefreshAiTips(habits: CrmHabitsProfile, now = Date.now()): boolean {
  if (habits.ai_tips_enabled === false) return false;
  if (!habits.ai_generated_at) return true;
  const last = Date.parse(habits.ai_generated_at);
  if (Number.isNaN(last)) return true;
  // At most once per day
  return now - last >= 20 * 60 * 60 * 1000;
}

/** Soft org budget tracker stored in a small org_settings JSON or in-memory per cron run. */
export async function getOrgTokensUsedToday(
  supabase: SupabaseClient,
  orgId: string,
): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('profiles')
    .select('ui_preferences')
    .eq('organization_id', orgId)
    .not('ui_preferences', 'is', null)
    .limit(200);

  let total = 0;
  for (const row of data ?? []) {
    const habits = parseHabitsProfile(
      (row.ui_preferences as Record<string, unknown> | null)?.habits,
    );
    if (!habits?.ai_generated_at?.startsWith(day)) continue;
    total += habits.ai_last_tokens ?? 0;
  }
  return total;
}

export async function generateHabitsAiTips(
  habits: CrmHabitsProfile,
): Promise<{ tips: HabitAiTip[]; tokens: number; model: string } | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userPayload = buildHabitsAiPayload(habits);

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.4,
    max_tokens: HABITS_AI_MAX_OUTPUT_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Usage pattern:\n${userPayload}\n\nReturn JSON tips now.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content ?? '';
  const tips = parseAiTipsResponse(text);
  const tokens = completion.usage?.total_tokens ?? 0;

  if (tips.length === 0) return null;
  return { tips, tokens, model: DEFAULT_MODEL };
}

export async function persistAiTips(
  supabase: SupabaseClient,
  profileId: string,
  existingPrefs: Record<string, unknown> | null,
  tips: HabitAiTip[],
  tokens: number,
): Promise<void> {
  const prev =
    parseHabitsProfile(existingPrefs?.habits) ?? emptyHabitsProfile();
  const next: CrmHabitsProfile = {
    ...prev,
    ai_tips: tips,
    ai_generated_at: new Date().toISOString(),
    ai_last_tokens: tokens,
    ai_tips_enabled: prev.ai_tips_enabled !== false,
  };
  await supabase
    .from('profiles')
    .update({
      ui_preferences: {
        ...(existingPrefs ?? {}),
        habits: next,
      },
    })
    .eq('id', profileId);
}
