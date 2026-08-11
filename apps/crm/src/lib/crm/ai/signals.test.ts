import { describe, expect, it } from 'vitest';
import {
  attentionScore,
  computeRecordSignals,
  rankRulesRecommendations,
  topAttentionLabel,
} from './signals';
import { validateRecommendations } from './citations';
import { signalPriority } from './playbooks';

const now = new Date('2026-08-11T12:00:00.000Z');

describe('computeRecordSignals', () => {
  it('flags missing phone/email and DNC', () => {
    const signals = computeRecordSignals({
      moduleKey: 'contacts',
      email: null,
      phone: null,
      data: { do_not_call: true },
      now,
    });
    const codes = signals.map((s) => s.code);
    expect(codes).toContain('MISSING_PHONE');
    expect(codes).toContain('MISSING_EMAIL');
    expect(codes).toContain('DNC');
    expect(signals.find((s) => s.code === 'DNC')?.severity).toBe('blocker');
  });

  it('flags stale touch using lastInteractionAt', () => {
    const signals = computeRecordSignals({
      moduleKey: 'leads',
      email: 'a@b.com',
      phone: '555',
      data: {},
      lastInteractionAt: '2026-06-01T00:00:00.000Z',
      now,
    });
    expect(signals.some((s) => s.code === 'STALE_TOUCH')).toBe(true);
  });

  it('projects legacy e123_member_id for member coverage', () => {
    const signals = computeRecordSignals({
      moduleKey: 'members',
      email: 'a@b.com',
      phone: '555',
      data: {
        e123_member_id: '12345',
        sharing_entity: 'Altrua',
        product: 'Plus',
      },
      now,
    });
    expect(signals.some((s) => s.code === 'MISSING_COVERAGE')).toBe(false);
  });

  it('surfaces missing coverage on contacts without carrier', () => {
    const signals = computeRecordSignals({
      moduleKey: 'contacts',
      email: 'a@b.com',
      phone: '555',
      data: {},
      now,
    });
    expect(signals.some((s) => s.code === 'MISSING_COVERAGE')).toBe(true);
  });
});

describe('rankRulesRecommendations', () => {
  it('prefers email when DNC', () => {
    const input = {
      moduleKey: 'contacts',
      email: 'a@b.com',
      phone: '555',
      data: { do_not_call: true },
      now,
    };
    const signals = computeRecordSignals(input);
    const recs = rankRulesRecommendations(signals, input);
    expect(recs[0]?.action).toBe('email');
    expect(recs[0]?.citationIds.length).toBeGreaterThan(0);
  });

  it('returns all-clear friendly empty when no signals', () => {
    const input = {
      moduleKey: 'leads',
      email: 'a@b.com',
      phone: '555',
      data: { sharing_entity: 'X', product: 'Y' },
      lastInteractionAt: now.toISOString(),
      now,
    };
    const signals = computeRecordSignals(input);
    expect(attentionScore(signals)).toBe(0);
    expect(topAttentionLabel(signals)).toBeNull();
    expect(rankRulesRecommendations(signals, input)).toEqual([]);
  });
});

describe('validateRecommendations', () => {
  it('drops invented citation ids', () => {
    const signals = computeRecordSignals({
      moduleKey: 'leads',
      email: null,
      phone: '555',
      data: {},
      now,
    });
    const bad = validateRecommendations(
      [
        {
          action: 'call',
          title: 'Invented',
          rationale: 'nope',
          citationIds: ['not-real'],
          confidence: 'high',
        },
      ],
      signals,
    );
    expect(bad).toBeNull();

    const goodId = signals[0]?.evidence[0]?.id;
    expect(goodId).toBeTruthy();
    const ok = validateRecommendations(
      [
        {
          action: 'fill_field',
          title: 'Add email',
          rationale: 'missing',
          citationIds: [goodId!],
          confidence: 'high',
          payload: { fieldKey: 'email' },
        },
      ],
      signals,
    );
    expect(ok?.length).toBe(1);
  });
});

describe('playbooks', () => {
  it('prioritizes member date over stale for members', () => {
    expect(signalPriority('MEMBER_DATE_NEAR', 'members')).toBeLessThan(
      signalPriority('STALE_TOUCH', 'members'),
    );
    expect(signalPriority('STALE_TOUCH', 'leads')).toBeLessThan(
      signalPriority('MISSING_COVERAGE', 'leads'),
    );
  });
});
