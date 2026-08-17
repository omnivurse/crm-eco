import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLocalRecordSavesForTests,
  markLocalRecordSaveFinished,
  markLocalRecordSaveStarted,
  matchesLocalUpdatedAt,
  wasRecordSavedLocallyRecently,
} from './local-record-saves';

describe('local-record-saves', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z'));
    __resetLocalRecordSavesForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is false for unknown records', () => {
    expect(wasRecordSavedLocallyRecently('r1')).toBe(false);
    expect(matchesLocalUpdatedAt('r1', '2026-08-16T12:00:00Z')).toBe(false);
  });

  it('is true while a save is in flight, regardless of elapsed time', () => {
    markLocalRecordSaveStarted('r1');
    expect(wasRecordSavedLocallyRecently('r1')).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(wasRecordSavedLocallyRecently('r1')).toBe(true);
    expect(wasRecordSavedLocallyRecently('r2')).toBe(false);
  });

  it('stays true within the window after finishing, then expires', () => {
    markLocalRecordSaveStarted('r1');
    markLocalRecordSaveFinished('r1', '2026-08-16T12:00:01.000Z');
    expect(wasRecordSavedLocallyRecently('r1')).toBe(true);
    vi.advanceTimersByTime(7_999);
    expect(wasRecordSavedLocallyRecently('r1')).toBe(true);
    vi.advanceTimersByTime(2);
    expect(wasRecordSavedLocallyRecently('r1')).toBe(false);
    // custom window
    expect(wasRecordSavedLocallyRecently('r1', 20_000)).toBe(true);
  });

  it('matches updated_at across timestamp formats', () => {
    markLocalRecordSaveStarted('r1');
    markLocalRecordSaveFinished('r1', '2026-08-16T12:00:01+00:00');
    expect(matchesLocalUpdatedAt('r1', '2026-08-16T12:00:01.000Z')).toBe(true);
    expect(matchesLocalUpdatedAt('r1', '2026-08-16T12:00:02.000Z')).toBe(false);
    expect(matchesLocalUpdatedAt('r1', null)).toBe(false);
    expect(matchesLocalUpdatedAt('r2', '2026-08-16T12:00:01.000Z')).toBe(false);
  });

  it('finished with null (failure) does not record an updated_at but counts as recent', () => {
    markLocalRecordSaveStarted('r1');
    markLocalRecordSaveFinished('r1', null);
    expect(matchesLocalUpdatedAt('r1', '2026-08-16T12:00:00.000Z')).toBe(false);
    expect(wasRecordSavedLocallyRecently('r1')).toBe(true);
  });

  it('handles overlapping saves (in-flight counter)', () => {
    markLocalRecordSaveStarted('r1');
    markLocalRecordSaveStarted('r1');
    markLocalRecordSaveFinished('r1', 'a');
    vi.advanceTimersByTime(30_000);
    expect(wasRecordSavedLocallyRecently('r1')).toBe(true); // one still in flight
    markLocalRecordSaveFinished('r1', 'b');
    vi.advanceTimersByTime(30_000);
    expect(wasRecordSavedLocallyRecently('r1')).toBe(false);
  });

  it('prunes stale entries so the map does not grow unbounded', () => {
    markLocalRecordSaveStarted('old');
    markLocalRecordSaveFinished('old', '2026-08-16T12:00:00.000Z');
    vi.advanceTimersByTime(61_000);
    // A write to another record triggers pruning of `old`.
    markLocalRecordSaveStarted('fresh');
    expect(matchesLocalUpdatedAt('old', '2026-08-16T12:00:00.000Z')).toBe(false);
    expect(wasRecordSavedLocallyRecently('fresh')).toBe(true);
  });
});
