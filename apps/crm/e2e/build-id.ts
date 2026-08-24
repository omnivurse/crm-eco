/**
 * Build identity — the walk must grade the source it SAYS it graded.
 *
 * `webServer.reuseExistingServer` is true locally. The `server-mode` trap proves
 * the adopted server is a production build rather than `next dev`, but "is a
 * production build" says nothing about WHICH source that build came from. A
 * `next start` left running from an hour ago answers /lock exactly like a fresh
 * one, so a graded run adopts it, records `commit: <today's HEAD>` in walk.json,
 * and grades an hour-old bundle. Reproduced: walk.json said `commit 2664d775`
 * while the served bundle still contained a canary that exists in no commit.
 *
 * A bare `git rev-parse HEAD` does NOT close that hole — it is exactly the case
 * above, where HEAD never moved and only the working tree changed. So the
 * identity stamped here is HEAD *plus* a digest of every uncommitted change that
 * `next build` would compile:
 *
 *     <head 12>-<sha256(working-tree delta) 8>       e.g. 2664d775bd10-9f1c3ac4
 *
 * That gives both halves of what the trap needs:
 *   · it CHANGES the moment any bundled source changes, committed or not, so a
 *     stale server can never pass;
 *   · it is STABLE when nothing changed, so re-running the walk against a server
 *     that really is current still skips the 74 s rebuild — `reuseExistingServer`
 *     keeps its point instead of being disabled to buy safety.
 *
 * `next.config.mjs` feeds it to `generateBuildId` when WALK_BUILD_ID is set, so
 * it lands in `.next/BUILD_ID` — a property of the BUILD on disk, not of the env
 * the server happens to be started with. `next start` on a stale `.next` reports
 * the stale id no matter what env it inherits, which is the point.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/**
 * The paths `next build` actually compiles into the served app. `apps/crm/e2e`
 * is excluded on purpose: it drives the browser and is never bundled, so editing
 * a trap must not invalidate a server that is still serving the right app.
 */
const BUNDLED_PATHSPECS = [
  'apps/crm',
  'packages',
  'package.json',
  'package-lock.json',
  ':(exclude)apps/crm/e2e',
];

const GIT_MAX_BUFFER = 512 * 1024 * 1024;

function git(args: string[], cwd: string, input?: string): string {
  return execFileSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Digest of everything that differs from HEAD inside the bundled paths.
 *
 * `git diff --binary HEAD` covers tracked edits, staged edits and deletions
 * (`--binary` so a changed image or font is content, not the useless "Binary
 * files differ" line). Untracked-but-not-ignored files are invisible to `diff`,
 * so they are hashed separately — one `git hash-object --stdin-paths` for the
 * whole list rather than a process per file. `--exclude-standard` keeps
 * node_modules/.next out via the repo's own ignore rules.
 */
function workingTreeDigest(repoRoot: string): string {
  const diff = git(['diff', '--binary', 'HEAD', '--', ...BUNDLED_PATHSPECS], repoRoot);
  const untracked = git(['ls-files', '-o', '--exclude-standard', '--', ...BUNDLED_PATHSPECS], repoRoot)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
  let untrackedDigest = '';
  if (untracked.length > 0) {
    const hashes = git(['hash-object', '--stdin-paths'], repoRoot, `${untracked.join('\n')}\n`)
      .trim()
      .split('\n');
    untrackedDigest = untracked.map((p, i) => `${hashes[i] ?? '?'} ${p}`).join('\n');
  }
  return createHash('sha256').update(diff).update('\0').update(untrackedDigest).digest('hex').slice(0, 8);
}

/**
 * The identity to stamp into this build. Throws rather than returning a
 * placeholder: an unstampable build is one the trap cannot vouch for, and a run
 * that cannot prove which source it graded must die loudly at config time, not
 * quietly produce a walk.json nobody can trust.
 */
export function computeWalkBuildId(appDir: string): string {
  let repoRoot: string;
  try {
    repoRoot = git(['rev-parse', '--show-toplevel'], appDir).trim();
  } catch (err) {
    throw new Error(
      `walk build identity: could not find the git repo from ${appDir} (${(err as Error).message}). ` +
        'The walk stamps HEAD + working-tree state into the build so the server-mode trap can refuse a stale server; without git it cannot.',
    );
  }
  const head = git(['rev-parse', 'HEAD'], repoRoot).trim();
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error(`walk build identity: unexpected HEAD "${head}"`);
  return `${head.slice(0, 12)}-${workingTreeDigest(repoRoot)}`;
}

/** Shape check, so a malformed stamp is caught where it is read, not compared. */
export function isWalkBuildId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{12}-[0-9a-f]{8}$/.test(value);
}

/**
 * Next serialises the build id into the RSC flight payload the document carries:
 *   <script>self.__next_f.push([1,"0:{\"P\":null,\"b\":\"<buildId>\",…
 * The quotes are backslash-escaped inside that JS string literal, which is what
 * this matches. Measured against a real `next start` document of this app on
 * Next 16.1.6 — see traps.server-mode.test.ts for the captured fixture.
 */
const FLIGHT_BUILD_ID = /\\"b\\":\\"([A-Za-z0-9_-]+)\\"/;

export function parseServedBuildId(html: string): string | null {
  return FLIGHT_BUILD_ID.exec(html)?.[1] ?? null;
}

/**
 * Say WHY two identities differ, because the two causes have different fixes:
 * a different commit means the server predates a checkout, a matching commit
 * with a different digest means the server predates an uncommitted edit — the
 * case a plain HEAD comparison would have waved through.
 */
export function describeBuildIdMismatch(expected: string, served: string): string {
  const [expectedHead] = expected.split('-');
  const [servedHead] = served.split('-');
  if (!isWalkBuildId(served)) {
    return `the server was not built by this harness (build id "${served}" carries no walk stamp) — it is some other \`next build\` of unknown provenance`;
  }
  return servedHead === expectedHead
    ? `same commit ${servedHead}, different working tree — the server was built before an uncommitted edit to the app`
    : `built from commit ${servedHead}, but HEAD is ${expectedHead} — the server predates the current checkout`;
}
