/**
 * Habit-learning types stored in `profiles.ui_preferences.habits`.
 * Aggregates only — never include PHI / note bodies / emails.
 */

export const HABIT_SIGNAL_TYPES = [
  'module_visit',
  'view_selected',
  'record_opened',
  'search_query',
  'nba_accepted',
  'nba_dismissed',
] as const;

export type HabitSignalType = (typeof HABIT_SIGNAL_TYPES)[number];

export interface HabitModuleScore {
  key: string;
  score: number;
  count?: number;
}

export interface HabitRecordScore {
  id: string;
  module: string;
  score: number;
  title?: string;
}

export interface HabitAiTip {
  id: string;
  text: string;
  /** Optional module to deep-link. */
  module_key?: string;
  dismissed?: boolean;
}

export interface CrmHabitsProfile {
  version: 1;
  updated_at: string;
  top_modules: HabitModuleScore[];
  top_records: HabitRecordScore[];
  preferred_views: Record<string, string>;
  /** Local hours (0–23) where the user is most active. */
  active_hours: number[];
  /** Relative rates for activity channels, e.g. { call: 0.3, email: 0.5 }. */
  action_rates: Record<string, number>;
  ai_tips: HabitAiTip[] | null;
  ai_generated_at?: string | null;
  /** Soft opt-out for AI coach (heuristics still run). */
  ai_tips_enabled?: boolean;
  /** Tokens used in last AI tips run (observability). */
  ai_last_tokens?: number | null;
}

export function emptyHabitsProfile(now = new Date()): CrmHabitsProfile {
  return {
    version: 1,
    updated_at: now.toISOString(),
    top_modules: [],
    top_records: [],
    preferred_views: {},
    active_hours: [],
    action_rates: {},
    ai_tips: null,
    ai_generated_at: null,
    ai_tips_enabled: true,
    ai_last_tokens: null,
  };
}

export function parseHabitsProfile(raw: unknown): CrmHabitsProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  return {
    version: 1,
    updated_at: typeof obj.updated_at === 'string' ? obj.updated_at : new Date(0).toISOString(),
    top_modules: Array.isArray(obj.top_modules)
      ? (obj.top_modules as HabitModuleScore[])
      : [],
    top_records: Array.isArray(obj.top_records)
      ? (obj.top_records as HabitRecordScore[])
      : [],
    preferred_views:
      obj.preferred_views && typeof obj.preferred_views === 'object'
        ? (obj.preferred_views as Record<string, string>)
        : {},
    active_hours: Array.isArray(obj.active_hours)
      ? (obj.active_hours as number[]).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23)
      : [],
    action_rates:
      obj.action_rates && typeof obj.action_rates === 'object'
        ? (obj.action_rates as Record<string, number>)
        : {},
    ai_tips: Array.isArray(obj.ai_tips) ? (obj.ai_tips as HabitAiTip[]) : null,
    ai_generated_at:
      typeof obj.ai_generated_at === 'string' ? obj.ai_generated_at : null,
    ai_tips_enabled: obj.ai_tips_enabled !== false,
    ai_last_tokens:
      typeof obj.ai_last_tokens === 'number' ? obj.ai_last_tokens : null,
  };
}
