/**
 * The build identity is only worth anything if it really moves when the source
 * moves. These tests run it against THIS repo (read-only git: rev-parse, diff,
 * ls-files, hash-object without -w) and prove the three properties the
 * server-mode trap leans on:
 *   · stable while the tree is unchanged — otherwise reuseExistingServer would
 *     be dead weight and every local run would pay a 74 s rebuild;
 *   · changed by an uncommitted edit to a BUNDLED file — the case a plain
 *     `git rev-parse HEAD` comparison waves through, and the case that actually
 *     produced a false walk.json;
 *   · unchanged by an edit to e2e/, which `next build` never compiles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { computeWalkBuildId, isWalkBuildId } from './build-id';

const APP_DIR = path.resolve(__dirname, '..');
const probes: string[] = [];

/** An untracked file the walk build would (or would not) compile. */
function probe(relToApp: string): string {
  const file = path.join(APP_DIR, relToApp);
  fs.writeFileSync(file, `// walk build-id probe ${Date.now()}\n`);
  probes.push(file);
  return file;
}

afterEach(() => {
  while (probes.length > 0) fs.rmSync(probes.pop() as string, { force: true });
});

describe('computeWalkBuildId', () => {
  it('stamps HEAD plus a working-tree digest', () => {
    const id = computeWalkBuildId(APP_DIR);
    expect(isWalkBuildId(id)).toBe(true);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: APP_DIR, encoding: 'utf8' }).trim();
    expect(id.split('-')[0]).toBe(head.slice(0, 12));
  });

  it('is stable while nothing changes, so a genuinely current server is still reusable', () => {
    expect(computeWalkBuildId(APP_DIR)).toBe(computeWalkBuildId(APP_DIR));
  });

  it('changes on an uncommitted edit to bundled source — the hole HEAD alone leaves open', () => {
    const before = computeWalkBuildId(APP_DIR);
    probe('src/.walk-build-id-probe.tmp.ts');
    const after = computeWalkBuildId(APP_DIR);
    expect(after).not.toBe(before);
    // Same commit, different tree: the mismatch the trap must still catch.
    expect(after.split('-')[0]).toBe(before.split('-')[0]);
  });

  it('ignores the harness itself — editing a trap must not invalidate a good server', () => {
    const before = computeWalkBuildId(APP_DIR);
    probe('e2e/.walk-build-id-probe.tmp.ts');
    expect(computeWalkBuildId(APP_DIR)).toBe(before);
  });

  it('refuses to invent an identity when there is no repo to read', () => {
    expect(() => computeWalkBuildId(path.resolve('/'))).toThrow(/could not find the git repo|walk build identity/);
  });
});
