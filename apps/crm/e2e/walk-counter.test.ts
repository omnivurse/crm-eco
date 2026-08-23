import { describe, expect, it } from 'vitest';
import {
  WalkCounter,
  classifyTrustedEvent,
  describeFailure,
  reconcileTallies,
  resolveTaskOutcome,
} from './walk-counter';

describe('WalkCounter (EV-4 acceptance)', () => {
  it('3 wrapped clicks + 2 presses → {clicks:3, keypresses:2}', () => {
    const c = new WalkCounter();
    c.recordClick();
    c.recordClick();
    c.recordClick();
    c.recordPress();
    c.recordPress();
    expect(c.snapshot()).toMatchObject({ clicks: 3, keypresses: 2 });
  });

  it('typed characters are recorded separately and never count as keypresses', () => {
    const c = new WalkCounter();
    c.recordType('5550107788');
    expect(c.snapshot()).toEqual({ clicks: 0, keypresses: 0, typedChars: 10 });
  });

  it('reset clears every tally', () => {
    const c = new WalkCounter();
    c.recordClick();
    c.recordPress();
    c.recordType('x');
    c.reset();
    expect(c.snapshot()).toEqual({ clicks: 0, keypresses: 0, typedChars: 0 });
  });
});

describe('classifyTrustedEvent (browser-side cross-check)', () => {
  it('counts only isTrusted pointerdown as a click', () => {
    expect(classifyTrustedEvent({ type: 'pointerdown', isTrusted: true })).toBe('click');
    expect(classifyTrustedEvent({ type: 'pointerdown', isTrusted: false })).toBeNull();
    expect(classifyTrustedEvent({ type: 'click', isTrusted: true })).toBeNull();
  });

  it('a chord is one keypress: the bare modifier keydown is ignored', () => {
    expect(classifyTrustedEvent({ type: 'keydown', isTrusted: true, key: 'Meta' })).toBeNull();
    expect(classifyTrustedEvent({ type: 'keydown', isTrusted: true, key: 'Enter' })).toBe('keypress');
  });

  it('ignores synthetic keydowns and keydowns while typing', () => {
    expect(classifyTrustedEvent({ type: 'keydown', isTrusted: false, key: 'Enter' })).toBeNull();
    expect(classifyTrustedEvent({ type: 'keydown', isTrusted: true, key: 'a', typing: true })).toBeNull();
  });
});

describe('reconcileTallies', () => {
  it('passes when both tallies agree', () => {
    expect(() => reconcileTallies('t1', { clicks: 3, keypresses: 2 }, { clicks: 3, keypresses: 2 })).not.toThrow();
  });

  it('throws naming the task when an un-wrapped action slipped in', () => {
    expect(() => reconcileTallies('t1', { clicks: 2, keypresses: 2 }, { clicks: 3, keypresses: 2 })).toThrow(
      /walk tally mismatch in task "t1"/,
    );
  });
});

describe('resolveTaskOutcome (soft mode, EV-5)', () => {
  it('hard mode: a failure is rethrown and the budget is asserted', () => {
    const err = new Error('boom');
    const out = resolveTaskOutcome({ failure: err, clicks: 1, budget: 2, soft: false });
    expect(out).toMatchObject({ pass: false, reason: 'boom', rethrow: err, assertBudget: true });
  });

  it('hard mode: over budget is pass=false even when nothing threw', () => {
    const out = resolveTaskOutcome({ failure: null, clicks: 3, budget: 2, soft: false });
    expect(out.pass).toBe(false);
    expect(out.reason).toMatch(/over click budget \(3 > 2\)/);
    expect(out.rethrow).toBeNull();
    expect(out.assertBudget).toBe(true);
  });

  it('soft mode: records pass=false with the reason and never rethrows', () => {
    const out = resolveTaskOutcome({ failure: new Error('expected future work'), clicks: 0, budget: 0, soft: true });
    expect(out).toEqual({ pass: false, reason: 'expected future work', rethrow: null, assertBudget: false });
    const over = resolveTaskOutcome({ failure: null, clicks: 5, budget: 1, soft: true });
    expect(over.pass).toBe(false);
    expect(over.rethrow).toBeNull();
    expect(over.assertBudget).toBe(false);
  });

  it('strips ANSI colour and keeps the assertion + locator lines in the reason', () => {
    const err = new Error('\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m\u001b[2m).\u001b[22mtoBeVisible() failed\n\nLocator: getByRole(\'group\')\nExpected: visible\nTimeout: 15000ms\nCall log:\n  - waiting');
    expect(describeFailure(err)).toBe("expect(locator).toBeVisible() failed · Locator: getByRole('group') · Expected: visible");
    expect(resolveTaskOutcome({ failure: err, clicks: 0, budget: 0, soft: true }).reason).not.toMatch(/\u001b/);
  });

  it('passes only when nothing failed and the clicks fit the budget', () => {
    expect(resolveTaskOutcome({ failure: null, clicks: 2, budget: 2, soft: true })).toEqual({
      pass: true,
      reason: null,
      rethrow: null,
      assertBudget: false,
    });
  });
});
