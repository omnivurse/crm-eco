import { describe, expect, it } from 'vitest';
import { gradeGuardProof, gradeWalk, summarizeWalk } from './walk-gate';
import type { GuardProofJson } from './walk-gate';
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
      serverMode: 'prod',
      buildId: '49c16870dead-0a1b2c3d',
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

  it('refuses a run recorded against `next dev` however green it is', () => {
    const r = gradeWalk(doc({ env: { ...doc().env, serverMode: 'dev' } }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('UNGRADED');
    expect(r.failures.join(' ')).toContain('WALK_DEV');
    // and it is not waivable through the soft-failure escape hatch
    expect(gradeWalk(doc({ env: { ...doc().env, serverMode: 'dev' } }), { allowSoft: ['T1'] }).ok).toBe(false);
  });

  it('refuses a run that never recorded which binary it graded', () => {
    const env = { ...doc().env };
    delete env.serverMode;
    const r = gradeWalk(doc({ env }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('did not record which binary');
  });

  it('refuses a graded run that cannot say which build it graded', () => {
    // serverMode:"prod" only says the BINARY was a build. Without a build
    // identity the document cannot show that build came from `commit` rather
    // than from a `next start` reuseExistingServer adopted.
    const env = { ...doc().env };
    delete env.buildId;
    const r = gradeWalk(doc({ env }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('env.buildId is missing');
    expect(gradeWalk(doc({ env }), { allowSoft: ['T1'] }).ok).toBe(false);
  });

  it('refuses a graded run whose build came from another commit', () => {
    const r = gradeWalk(doc({ env: { ...doc().env, buildId: 'ffffffffffff-0a1b2c3d' } }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('names a commit it did not grade');
  });

  it('does not demand a build identity from an ungraded dev run', () => {
    // The dev refusal already covers it; a second failure would only be noise.
    const env = { ...doc().env, serverMode: 'dev' as const, buildId: null };
    const r = gradeWalk(doc({ env }));
    expect(r.failures.join(' ')).not.toContain('env.buildId');
  });

  it('marks the server mode in the markdown summary', () => {
    const good = doc();
    expect(summarizeWalk(good, gradeWalk(good))).toContain('production build');
    const bad = doc({ env: { ...doc().env, serverMode: 'dev' } });
    expect(summarizeWalk(bad, gradeWalk(bad))).toContain('UNGRADED');
  });

  it('summarizes counts and failures as markdown', () => {
    const d = doc({ tasks: [task({ id: 'T3', clicks: 3, budget: 1, pass: false, soft: true })] });
    const md = summarizeWalk(d, gradeWalk(d));
    expect(md).toContain('### CRM walk — FAIL');
    expect(md).toContain('| tasks | 0 | 1 |');
    expect(md).toContain('T3 [desktop-1440] clicks=3/1');
  });
});

describe('gradeGuardProof (EV-GUARD)', () => {
  const proof = (over: Partial<GuardProofJson> = {}): GuardProofJson => ({
    proof: 'EV-GUARD',
    pass: true,
    commit: '49c16870deadbeef',
    rule: 'crm-toast/no-raw-toast-copy',
    preCommit: { exitCode: 1, rejected: true },
    prePush: { exitCode: 1, rejected: true },
    git: { treeRestored: true },
    checks: [{ name: 'pre-commit path REJECTS a new raw toast', pass: true }],
    ...over,
  });

  it('accepts a proof where both guards rejected and the tree was restored', () => {
    expect(gradeGuardProof(proof())).toEqual([]);
    expect(gradeGuardProof(proof(), '49c16870deadbeef')).toEqual([]);
  });

  it('fails when the run folder has no proof at all', () => {
    expect(gradeGuardProof(null)[0]).toContain('guard-proof.json missing');
  });

  it('names the red checks when the proof failed', () => {
    const r = gradeGuardProof(proof({ pass: false, checks: [{ name: 'rejection names the rule', pass: false }] }));
    expect(r[0]).toContain('rejection names the rule');
  });

  it('does not trust a pass flag over the recorded exit codes', () => {
    expect(gradeGuardProof(proof({ preCommit: { exitCode: 0, rejected: false } })).join(' ')).toContain('pre-commit run exited 0');
    expect(gradeGuardProof(proof({ prePush: { exitCode: 0, rejected: false } })).join(' ')).toContain('ratchet exited 0');
  });

  it('fails a proof that left the tree changed', () => {
    expect(gradeGuardProof(proof({ git: { treeRestored: false } })).join(' ')).toContain('working tree changed');
  });

  it('fails a proof recorded against a different commit than the walk', () => {
    expect(gradeGuardProof(proof({ commit: 'ffffffffdeadbeef' }), '49c16870deadbeef').join(' ')).toContain('stale evidence');
  });
});
