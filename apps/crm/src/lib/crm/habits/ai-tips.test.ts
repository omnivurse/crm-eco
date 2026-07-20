import { describe, expect, it } from 'vitest';
import {
  buildHabitsAiPayload,
  HABITS_AI_MAX_INPUT_CHARS,
  parseAiTipsResponse,
  shouldRefreshAiTips,
} from './ai-tips';
import type { CrmHabitsProfile } from './types';

const sample: CrmHabitsProfile = {
  version: 1,
  updated_at: '2026-07-20T00:00:00.000Z',
  top_modules: [
    { key: 'leads', score: 1 },
    { key: 'contacts', score: 0.4 },
  ],
  top_records: [{ id: 'should-not-appear', module: 'leads', score: 1 }],
  preferred_views: { leads: 'v1' },
  active_hours: [9, 10, 14],
  action_rates: { email: 0.7, call: 0.3 },
  ai_tips: null,
  ai_generated_at: null,
};

describe('buildHabitsAiPayload', () => {
  it('includes aggregates but not record ids / titles', () => {
    const json = buildHabitsAiPayload(sample);
    expect(json.length).toBeLessThanOrEqual(HABITS_AI_MAX_INPUT_CHARS);
    expect(json).toContain('leads');
    expect(json).not.toContain('should-not-appear');
  });
});

describe('parseAiTipsResponse', () => {
  it('parses JSON tips and caps at 3', () => {
    const tips = parseAiTipsResponse(
      JSON.stringify({
        tips: [
          { id: 'a', text: 'Open Leads first thing', module_key: 'leads' },
          { id: 'b', text: 'Batch follow-up emails at 2pm', module_key: null },
          { id: 'c', text: 'Log calls after demos', module_key: 'leads' },
          { id: 'd', text: 'extra', module_key: null },
        ],
      }),
    );
    expect(tips).toHaveLength(3);
    expect(tips[0]?.module_key).toBe('leads');
  });

  it('returns empty on invalid JSON', () => {
    expect(parseAiTipsResponse('not-json')).toEqual([]);
  });
});

describe('shouldRefreshAiTips', () => {
  it('refreshes when never generated', () => {
    expect(shouldRefreshAiTips(sample)).toBe(true);
  });

  it('skips when generated within 20 hours', () => {
    const recent = {
      ...sample,
      ai_generated_at: new Date().toISOString(),
    };
    expect(shouldRefreshAiTips(recent)).toBe(false);
  });

  it('respects opt-out', () => {
    expect(shouldRefreshAiTips({ ...sample, ai_tips_enabled: false })).toBe(false);
  });
});
