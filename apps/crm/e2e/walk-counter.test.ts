import { describe, expect, it } from 'vitest';
import {
  WalkCounter,
  classifyTrustedEvent,
  reconcileTallies,
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
