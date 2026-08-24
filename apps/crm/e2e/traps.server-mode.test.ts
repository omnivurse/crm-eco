/**
 * server-mode trap — the walk must grade the binary AND the source it says it
 * is grading.
 *
 * `webServer.reuseExistingServer` is true locally, so whatever is already
 * listening on :3000 gets adopted by a graded run. Two different lies come out
 * of that, and the trap has to catch both:
 *   1. a `next dev` is adopted and walk.json claims serverMode:"prod" over
 *      dev-runtime evidence;
 *   2. a `next start` from an EARLIER state of the tree is adopted — also a
 *      production build, so (1) waves it through — and walk.json records today's
 *      `commit` over an older bundle. Reproduced for real: walk.json said
 *      `commit 2664d775` while the served bundle carried a canary that exists in
 *      no commit. Note that comparing HEAD alone would NOT have caught that one:
 *      HEAD never moved, only the working tree did.
 *
 * The fixtures below are TRIMMED CAPTURES of `curl http://localhost:3000/lock`
 * against each server on this app (Next 16.1.6): the dev document carries the
 * overlay bundle and the HMR client and names its chunks after source paths; the
 * production document carries neither, every chunk is content-hashed, and its
 * flight payload carries the build id (`\"b\":\"…\"` — verified against
 * .next/server/app/*.html from a real `next build`).
 */
import { describe, expect, it } from 'vitest';
import { describeBuildIdMismatch, isWalkBuildId, parseServedBuildId } from './build-id';
import { classifyServerMode, trapServerMode } from './traps';

const BUILD_ID = '2664d775bd10-9f1c3ac4';
const OTHER_COMMIT_BUILD_ID = '59041244aa01-9f1c3ac4';
const SAME_COMMIT_DIRTY_BUILD_ID = '2664d775bd10-11112222';

const DEV_LOCK_HTML = `<!DOCTYPE html><html lang="en"><head><title>Lead Generation Quote System</title>
<script src="/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_d308b8a4._.js"></script>
<script src="/_next/static/chunks/324d8_next_dist_compiled_next-devtools_index_5a09df65.js"></script>
<script src="/_next/static/chunks/_claude_worktrees_road-to-ten_apps_crm_src_app_lock_page_tsx_10af31c4._.js"></script>
</head><body><div id="__next"></div></body></html>`;

const prodLockHtml = (buildId: string | null) => `<!DOCTYPE html><html lang="en"><head><title>Lead Generation Quote System</title>
<script src="/_next/static/chunks/webpack-12f4901dce9dbfb8.js"></script>
<script src="/_next/static/chunks/main-app-65eee9910ded036d.js"></script>
<script src="/_next/static/chunks/app/lock/page-f7f96cb0fe700a82.js"></script>
</head><body><div id="__next"></div>${
  buildId === null ? '' : `<script>self.__next_f.push([1,"0:{\\"P\\":null,\\"b\\":\\"${buildId}\\",\\"c\\":[\\"\\",\\"lock\\"]}\\n"])</script>`
}</body></html>`;

const PROD_LOCK_HTML = prodLockHtml(BUILD_ID);

function fakeFetch(body: string, status = 200): typeof fetch {
  return (async () => ({ ok: status >= 200 && status < 300, status, text: async () => body })) as unknown as typeof fetch;
}

describe('classifyServerMode', () => {
  it('reads a real `next dev` document as dev', () => {
    expect(classifyServerMode(DEV_LOCK_HTML)).toBe('dev');
  });

  it('reads a real `next start` document as prod', () => {
    expect(classifyServerMode(PROD_LOCK_HTML)).toBe('prod');
  });

  it('refuses to guess when neither signal is present', () => {
    // An error page, a proxy, something that is not this app at all: "unknown"
    // is a FAILURE downstream, never a pass-by-default.
    expect(classifyServerMode('<html><body>hello</body></html>')).toBe('unknown');
  });

  it('refuses to guess when both signals are present', () => {
    expect(classifyServerMode(DEV_LOCK_HTML + PROD_LOCK_HTML)).toBe('unknown');
  });
});

describe('parseServedBuildId', () => {
  it('pulls the build id out of the flight payload a real document carries', () => {
    expect(parseServedBuildId(PROD_LOCK_HTML)).toBe(BUILD_ID);
  });

  it('reads Next’s own default build id too (a build this harness did not stamp)', () => {
    // Captured from .next/server/app/_global-error.html of a plain `next build`.
    expect(parseServedBuildId(prodLockHtml('b7ktDPOpRd8RTlvC-HM2G'))).toBe('b7ktDPOpRd8RTlvC-HM2G');
  });

  it('returns null rather than a guess when the document carries none', () => {
    expect(parseServedBuildId(prodLockHtml(null))).toBeNull();
  });
});

describe('isWalkBuildId', () => {
  it('accepts the stamped shape and rejects everything else', () => {
    expect(isWalkBuildId(BUILD_ID)).toBe(true);
    expect(isWalkBuildId('b7ktDPOpRd8RTlvC-HM2G')).toBe(false);
    expect(isWalkBuildId('2664d775bd10')).toBe(false);
    expect(isWalkBuildId(null)).toBe(false);
    expect(isWalkBuildId(undefined)).toBe(false);
  });
});

describe('describeBuildIdMismatch', () => {
  it('names an older checkout by its commit', () => {
    expect(describeBuildIdMismatch(BUILD_ID, OTHER_COMMIT_BUILD_ID)).toContain('built from commit 59041244aa01');
  });

  it('separates the case a HEAD comparison would have missed', () => {
    const d = describeBuildIdMismatch(BUILD_ID, SAME_COMMIT_DIRTY_BUILD_ID);
    expect(d).toContain('same commit');
    expect(d).toContain('uncommitted');
  });

  it('says so when the build carries no walk stamp at all', () => {
    expect(describeBuildIdMismatch(BUILD_ID, 'b7ktDPOpRd8RTlvC-HM2G')).toContain('not built by this harness');
  });
});

describe('trapServerMode', () => {
  it('passes when the server matches the declared mode AND the declared source', async () => {
    const prod = await trapServerMode('prod', 'http://localhost:3000', fakeFetch(PROD_LOCK_HTML), BUILD_ID);
    expect(prod.pass).toBe(true);
    expect(prod.detail).toContain('PROD');
    expect(prod.detail).toContain(BUILD_ID);
  });

  it('passes a dev run without demanding a build identity it cannot have', async () => {
    const dev = await trapServerMode('dev', 'http://localhost:3000', fakeFetch(DEV_LOCK_HTML), null);
    expect(dev.pass).toBe(true);
    expect(dev.detail).toContain('UNGRADED');
  });

  it('FAILS when a graded run is silently adopting a dev server', async () => {
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch(DEV_LOCK_HTML), BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('serving a DEV build');
    expect(r.detail).toContain('reuseExistingServer');
  });

  it('FAILS when a graded run adopts a STALE production server from another commit', async () => {
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch(prodLockHtml(OTHER_COMMIT_BUILD_ID)), BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('STALE build');
    expect(r.detail).toContain('59041244aa01');
  });

  it('FAILS on the stale server a HEAD-only check would have passed', async () => {
    // Same commit, dirty tree: exactly the reproduction — walk.json would have
    // named the right SHA over a bundle built before the edit.
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch(prodLockHtml(SAME_COMMIT_DIRTY_BUILD_ID)), BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('STALE build');
    expect(r.detail).toContain('same commit');
  });

  it('FAILS on a production server this harness never built', async () => {
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch(prodLockHtml('b7ktDPOpRd8RTlvC-HM2G')), BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('not built by this harness');
  });

  it('FAILS when the document carries no build id rather than assuming it is current', async () => {
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch(prodLockHtml(null)), BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('no Next build id');
  });

  it('FAILS a graded run that was never stamped, instead of skipping the check', async () => {
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch(PROD_LOCK_HTML), null);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('no walk build identity');
  });

  it('fails on an unclassifiable document rather than assuming the happy answer', async () => {
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch('<html></html>'), BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('refusing to guess');
  });

  it('fails when /lock does not answer 200', async () => {
    const r = await trapServerMode('prod', 'http://localhost:3000', fakeFetch('', 503), BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('HTTP 503');
  });

  it('fails when the server cannot be reached at all', async () => {
    const boom = (async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;
    const r = await trapServerMode('prod', 'http://localhost:3000', boom, BUILD_ID);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain('ECONNREFUSED');
  });
});
