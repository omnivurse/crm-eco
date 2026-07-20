/**
 * Pure habit scoring (0 tokens). Recency-weighted frequency from
 * recently-viewed rows + raw signals + preference hints.
 */

import {
  emptyHabitsProfile,
  type CrmHabitsProfile,
  type HabitModuleScore,
  type HabitRecordScore,
  type HabitSignalType,
} from './types';

export interface RecentlyViewedInput {
  record_id: string;
  module_key: string | null;
  view_count: number;
  last_viewed_at: string;
  title?: string | null;
}

export interface SignalInput {
  signal_type: HabitSignalType | string;
  module_key: string | null;
  entity_id: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

export interface PreferenceViewHint {
  module_key: string;
  view_id: string;
}

const HALF_LIFE_DAYS = 14;
const MS_PER_DAY = 86_400_000;

/** Exponential decay: full weight today, ~0.5 at HALF_LIFE_DAYS. */
export function recencyWeight(isoDate: string, now = Date.now()): number {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return 0.1;
  const ageDays = Math.max(0, (now - t) / MS_PER_DAY);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

function normalizeScores<T extends { score: number }>(items: T[], limit: number): T[] {
  if (items.length === 0) return [];
  const max = Math.max(...items.map((i) => i.score), 1e-9);
  return items
    .map((i) => ({ ...i, score: Number((i.score / max).toFixed(4)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function aggregateHabits(params: {
  recentlyViewed: RecentlyViewedInput[];
  signals: SignalInput[];
  preferredViews?: PreferenceViewHint[];
  now?: Date;
}): CrmHabitsProfile {
  const nowDate = params.now ?? new Date();
  const now = nowDate.getTime();
  const moduleScores = new Map<string, { score: number; count: number }>();
  const recordScores = new Map<
    string,
    { score: number; module: string; title?: string }
  >();
  const hourBuckets = new Array<number>(24).fill(0);
  const actionCounts = new Map<string, number>();
  const preferredViews: Record<string, string> = {};

  const bumpModule = (key: string | null | undefined, weight: number) => {
    if (!key) return;
    const cur = moduleScores.get(key) ?? { score: 0, count: 0 };
    cur.score += weight;
    cur.count += 1;
    moduleScores.set(key, cur);
  };

  const bumpRecord = (
    id: string | null | undefined,
    module: string | null | undefined,
    weight: number,
    title?: string | null,
  ) => {
    if (!id || !module) return;
    const cur = recordScores.get(id) ?? { score: 0, module, title: title ?? undefined };
    cur.score += weight;
    if (title) cur.title = title;
    recordScores.set(id, cur);
  };

  for (const row of params.recentlyViewed) {
    const w = recencyWeight(row.last_viewed_at, now) * Math.max(1, row.view_count);
    bumpModule(row.module_key, w);
    bumpRecord(row.record_id, row.module_key, w, row.title);
    const hour = new Date(row.last_viewed_at).getHours();
    if (!Number.isNaN(hour)) hourBuckets[hour] += w;
  }

  for (const sig of params.signals) {
    const w = recencyWeight(sig.created_at, now);
    const hour = new Date(sig.created_at).getHours();
    if (!Number.isNaN(hour)) hourBuckets[hour] += w;

    switch (sig.signal_type) {
      case 'module_visit':
        bumpModule(sig.module_key, w * 1.2);
        break;
      case 'view_selected': {
        bumpModule(sig.module_key, w);
        const viewId =
          typeof sig.meta?.view_id === 'string' ? sig.meta.view_id : null;
        if (sig.module_key && viewId) {
          preferredViews[sig.module_key] = viewId;
        }
        break;
      }
      case 'record_opened':
        bumpModule(sig.module_key, w);
        bumpRecord(sig.entity_id, sig.module_key, w * 1.1);
        break;
      case 'search_query':
        bumpModule(sig.module_key, w * 0.4);
        break;
      case 'nba_accepted': {
        const channel =
          typeof sig.meta?.channel === 'string' ? sig.meta.channel : 'other';
        actionCounts.set(channel, (actionCounts.get(channel) ?? 0) + w);
        bumpModule(sig.module_key, w * 0.5);
        break;
      }
      case 'nba_dismissed':
        // Soft negative — slight module bump only so we still know they saw it.
        bumpModule(sig.module_key, w * 0.1);
        break;
      default:
        bumpModule(sig.module_key, w * 0.3);
    }
  }

  for (const hint of params.preferredViews ?? []) {
    if (hint.module_key && hint.view_id && !preferredViews[hint.module_key]) {
      preferredViews[hint.module_key] = hint.view_id;
    }
  }

  const top_modules: HabitModuleScore[] = normalizeScores(
    [...moduleScores.entries()].map(([key, v]) => ({
      key,
      score: v.score,
      count: v.count,
    })),
    8,
  );

  const top_records: HabitRecordScore[] = normalizeScores(
    [...recordScores.entries()].map(([id, v]) => ({
      id,
      module: v.module,
      score: v.score,
      title: v.title,
    })),
    12,
  );

  const hourRanked = hourBuckets
    .map((score, hour) => ({ hour, score }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((h) => h.hour);

  const actionTotal = [...actionCounts.values()].reduce((a, b) => a + b, 0);
  const action_rates: Record<string, number> = {};
  if (actionTotal > 0) {
    for (const [k, v] of actionCounts) {
      action_rates[k] = Number((v / actionTotal).toFixed(4));
    }
  }

  const base = emptyHabitsProfile(nowDate);
  return {
    ...base,
    updated_at: nowDate.toISOString(),
    top_modules,
    top_records,
    preferred_views: preferredViews,
    active_hours: hourRanked,
    action_rates,
  };
}

/** Sort modules so habit favorites float to the top; preserve relative order otherwise. */
export function sortModulesByHabits<T extends { key: string }>(
  modules: T[],
  habits: CrmHabitsProfile | null | undefined,
): T[] {
  if (!habits?.top_modules?.length) return modules;
  const rank = new Map(habits.top_modules.map((m, i) => [m.key, i]));
  return [...modules].sort((a, b) => {
    const ra = rank.has(a.key) ? rank.get(a.key)! : 999;
    const rb = rank.has(b.key) ? rank.get(b.key)! : 999;
    if (ra !== rb) return ra - rb;
    return 0;
  });
}

/** Map top modules → preferred dashboard widget types for layout bias. */
const MODULE_WIDGET_BIAS: Record<string, string[]> = {
  leads: ['todays-tasks', 'at-risk-deals', 'pipeline-funnel', 'quick-actions'],
  deals: ['pipeline-funnel', 'at-risk-deals', 'todays-tasks'],
  contacts: ['recent-activity', 'advisor-contacts', 'quick-actions'],
  members: ['member-kpi-stats', 'recent-activity', 'quick-actions'],
  tasks: ['todays-tasks', 'upcoming-tasks'],
  activities: ['todays-tasks', 'upcoming-tasks', 'calendar-events'],
  tickets: ['todays-tasks', 'recent-activity'],
};

export function biasLayoutWidgetOrder<T extends { type: string; position: number }>(
  widgets: T[],
  habits: CrmHabitsProfile | null | undefined,
): T[] {
  if (!habits?.top_modules?.length || widgets.length === 0) return widgets;
  const preferred = new Set<string>();
  for (const mod of habits.top_modules.slice(0, 3)) {
    for (const w of MODULE_WIDGET_BIAS[mod.key] ?? []) preferred.add(w);
  }
  if (preferred.size === 0) return widgets;

  const scored = widgets.map((w, idx) => ({
    w,
    idx,
    boost: preferred.has(w.type) ? 0 : 1,
  }));
  scored.sort((a, b) => a.boost - b.boost || a.idx - b.idx);

  return scored.map((s, position) => ({
    ...s.w,
    position: Math.floor(position / 2), // keep rough row grouping
  }));
}

export interface NextBestActionHint {
  channel: string;
  label: string;
  reason: string;
}

/** Heuristic next-best-action from action_rates + optional stage. */
export function suggestNextBestActions(
  habits: CrmHabitsProfile | null | undefined,
  opts?: { stage?: string | null; limit?: number },
): NextBestActionHint[] {
  const rates = habits?.action_rates ?? {};
  const entries = Object.entries(rates).sort((a, b) => b[1] - a[1]);
  const limit = opts?.limit ?? 2;

  const labels: Record<string, string> = {
    call: 'Log a call',
    email: 'Send a follow-up email',
    meeting: 'Schedule a meeting',
    task: 'Create a follow-up task',
    other: 'Take a follow-up action',
  };

  if (entries.length === 0) {
    // Cold start defaults for sales CRM
    return [
      {
        channel: 'email',
        label: labels.email,
        reason: 'Common next step when learning your habits',
      },
      {
        channel: 'call',
        label: labels.call,
        reason: 'Calls convert well for early-stage records',
      },
    ].slice(0, limit);
  }

  return entries.slice(0, limit).map(([channel, score]) => ({
    channel,
    label: labels[channel] ?? `Follow up via ${channel}`,
    reason: `You use ${channel} ~${Math.round(score * 100)}% of the time${
      opts?.stage ? ` · stage: ${opts.stage}` : ''
    }`,
  }));
}
