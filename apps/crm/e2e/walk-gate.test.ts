import { describe, expect, it } from 'vitest';
import { gradeWalk, summarizeWalk } from './walk-gate';
import type { WalkJson } from './walk-report';

function doc(overrides: Partial<WalkJson> = {}): WalkJson {
  return {
    commit: '49c16870deadbeef',
    startedAt: '2026-08-23T07:00:00.000Z',
    finishedAt: '2026-08-23T07:06:00.000Z',
    env: {
      baseURL: 'http://localhost:3000',
      supabaseUrl: 'http://127.0.0.1:54321',
      navProfile: 'full',
      layoutV2: true,
      viewport: '1440x900',
      project: 'desktop-1440',
      role: 'operator',
    },
    traps: [{ name: 'prod-guard', pass: true, detail: 'local' }],
    tasks: [task({})],
    ...overrides,
  };
}

function task(over: Record<string, unknown>) {
  return { id: 'T1', label: 'find by phone', clicks: 2, keypresses: 2, ms: 900, budget: 2, pass: true, steps: [], project: 'desktop-1440', ...over };
}

describe('gradeWalk', () => {
  it('passes a clean run', () => {
    const r = gradeWalk(doc());
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
    expect(r.counts).toEqual({ traps: 1, trapFails: 0, tasks: 1, taskFails: 0 });
  });

  it('fails on a trap', () => {
    const r = gradeWalk(doc({ traps: [{ name: 'pin-gate', pass: false, detail: 'no redirect to /lock', project: 'mobile-390' }] }));
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toContain('TRAP:pin-gate [mobile-390]');
  });

  it('fails on a SOFT budget breach the runner let through', () => {
    const r = gradeWalk(doc({ tasks: [task({ id: 'LS-mobile-filter', clicks: 5, budget: 4, pass: false, soft: true, project: 'mobile-390' })] }));
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toContain('LS-mobile-filter [mobile-390] clicks=5/4');
  });

  it('tolerates a soft failure only when it is explicitly allowed', () => {
    const tasks = [task({ id: 'LS-mobile-filter', clicks: 5, budget: 4, pass: false, soft: true })];
    expect(gradeWalk(doc({ tasks }), { allowSoft: ['LS-mobile-filter'] }).ok).toBe(true);
    expect(gradeWalk(doc({ tasks }), { allowSoft: ['LS-mobile-filter'] }).allowed).toHaveLength(1);
    // a HARD failure is never waivable
    const hard = [task({ id: 'LS-mobile-filter', clicks: 5, budget: 4, pass: false })];
    expect(gradeWalk(doc({ tasks: hard }), { allowSoft: ['LS-mobile-filter'] }).ok).toBe(false);
  });

  it('fails a run that recorded no tasks', () => {
    const r = gradeWalk(doc({ tasks: [] }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('no evidence');
  });

  it('fails a pass row whose clicks exceed its budget', () => {
    const r = gradeWalk(doc({ tasks: [task({ clicks: 4, budget: 2, pass: true })] }));
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toContain('exceeds budget 2');
  });

  it('fails when the same task is recorded twice (a retry would double-count)', () => {
    const r = gradeWalk(doc({ tasks: [task({}), task({})] }));
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toContain('recorded twice');
  });

  it('refuses evidence recorded against a non-local Supabase host', () => {
    const r = gradeWalk(doc({ env: { ...doc().env, supabaseUrl: 'https://sffisarikcreyyjzdjvb.supabase.co' } }));
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toContain('not local');
  });

  it('summarizes counts and failures as markdown', () => {
    const d = doc({ tasks: [task({ id: 'T3', clicks: 3, budget: 1, pass: false, soft: true })] });
    const md = summarizeWalk(d, gradeWalk(d));
    expect(md).toContain('### CRM walk — FAIL');
    expect(md).toContain('| tasks | 0 | 1 |');
    expect(md).toContain('T3 [desktop-1440] clicks=3/1');
  });
});
