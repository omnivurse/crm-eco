import { describe, expect, it } from 'vitest';
import {
  aggregateHabits,
  biasLayoutWidgetOrder,
  recencyWeight,
  sortModulesByHabits,
  suggestNextBestActions,
} from './score';

describe('recencyWeight', () => {
  it('weights recent events higher than old ones', () => {
    const now = Date.parse('2026-07-20T12:00:00.000Z');
    const today = recencyWeight('2026-07-20T10:00:00.000Z', now);
    const twoWeeks = recencyWeight('2026-07-06T12:00:00.000Z', now);
    expect(today).toBeGreaterThan(twoWeeks);
    expect(twoWeeks).toBeCloseTo(0.5, 1);
  });
});

describe('aggregateHabits', () => {
  it('ranks modules by recency-weighted frequency', () => {
    const habits = aggregateHabits({
      now: new Date('2026-07-20T12:00:00.000Z'),
      recentlyViewed: [
        {
          record_id: 'r1',
          module_key: 'leads',
          view_count: 5,
          last_viewed_at: '2026-07-20T11:00:00.000Z',
          title: 'Lead A',
        },
        {
          record_id: 'r2',
          module_key: 'contacts',
          view_count: 1,
          last_viewed_at: '2026-07-10T11:00:00.000Z',
          title: 'Contact B',
        },
      ],
      signals: [
        {
          signal_type: 'module_visit',
          module_key: 'leads',
          entity_id: null,
          created_at: '2026-07-20T09:00:00.000Z',
        },
        {
          signal_type: 'view_selected',
          module_key: 'leads',
          entity_id: null,
          meta: { view_id: 'view-123' },
          created_at: '2026-07-19T09:00:00.000Z',
        },
      ],
    });

    expect(habits.top_modules[0]?.key).toBe('leads');
    expect(habits.top_modules[0]?.score).toBe(1);
    expect(habits.preferred_views.leads).toBe('view-123');
    expect(habits.top_records.some((r) => r.id === 'r1')).toBe(true);
    expect(habits.version).toBe(1);
  });

  it('tracks nba_accepted into action_rates', () => {
    const habits = aggregateHabits({
      now: new Date('2026-07-20T12:00:00.000Z'),
      recentlyViewed: [],
      signals: [
        {
          signal_type: 'nba_accepted',
          module_key: 'leads',
          entity_id: null,
          meta: { channel: 'email' },
          created_at: '2026-07-20T10:00:00.000Z',
        },
        {
          signal_type: 'nba_accepted',
          module_key: 'leads',
          entity_id: null,
          meta: { channel: 'call' },
          created_at: '2026-07-20T11:00:00.000Z',
        },
        {
          signal_type: 'nba_accepted',
          module_key: 'leads',
          entity_id: null,
          meta: { channel: 'email' },
          created_at: '2026-07-20T11:30:00.000Z',
        },
      ],
    });
    expect(habits.action_rates.email).toBeGreaterThan(habits.action_rates.call);
  });
});

describe('sortModulesByHabits', () => {
  it('floats favorite modules to the front', () => {
    const modules = [{ key: 'deals' }, { key: 'leads' }, { key: 'contacts' }];
    const sorted = sortModulesByHabits(modules, {
      version: 1,
      updated_at: '',
      top_modules: [
        { key: 'leads', score: 1 },
        { key: 'contacts', score: 0.5 },
      ],
      top_records: [],
      preferred_views: {},
      active_hours: [],
      action_rates: {},
      ai_tips: null,
    });
    expect(sorted.map((m) => m.key)).toEqual(['leads', 'contacts', 'deals']);
  });
});

describe('biasLayoutWidgetOrder', () => {
  it('boosts widgets matching top modules', () => {
    const widgets = [
      { type: 'module-stats', position: 0 },
      { type: 'todays-tasks', position: 1 },
      { type: 'pipeline-funnel', position: 2 },
    ];
    const biased = biasLayoutWidgetOrder(widgets, {
      version: 1,
      updated_at: '',
      top_modules: [{ key: 'leads', score: 1 }],
      top_records: [],
      preferred_views: {},
      active_hours: [],
      action_rates: {},
      ai_tips: null,
    });
    expect(biased[0]?.type).toBe('todays-tasks');
  });
});

describe('suggestNextBestActions', () => {
  it('prefers highest action_rate channel', () => {
    const hints = suggestNextBestActions(
      {
        version: 1,
        updated_at: '',
        top_modules: [],
        top_records: [],
        preferred_views: {},
        active_hours: [],
        action_rates: { call: 0.2, email: 0.8 },
        ai_tips: null,
      },
      { limit: 1 },
    );
    expect(hints[0]?.channel).toBe('email');
  });
});
