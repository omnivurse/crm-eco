/**
 * EV-1/EV-3 global setup: run the pre-login traps, log the walk role in at
 * /crm-login behind the PIN cookie, save storageState, run the post-login
 * traps, and open the run's artifact folder (WALK_RUN_DIR) for walk.json.
 * Every failure — pre-login traps included — leaves trap-<name>.png plus
 * env.json in the run folder, so global-teardown always writes walk.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, request as pwRequest, type FullConfig, type Page } from '@playwright/test';
import {
  AUTH_DIR,
  BASE_URL,
  FIXTURE,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
  LOGIN_PATH,
  NEGATIVE,
  WALK_ROOT,
  authStatePath,
  desktopViewport,
  isLocalSupabaseHost,
  walkRole,
} from './env';
import {
  TrapFailure,
  armPageIssueTrap,
  assertTrap,
  pinCookie,
  readStatusVocabulary,
  recordTrap,
  trapBreakpoint,
  trapLayoutV2,
  trapNavProfile,
  trapNoLockRedirect,
  trapNoPageIssues,
  trapNotEmpty,
  trapNotPinPage,
  trapPinGate,
  trapProdGuard,
  trapProdGuardNetwork,
  trapRightOrg,
  trapServerMode,
  trapStatusVocab,
  walkServerMode,
  type TrapResult,
} from './traps';

function gitHead(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '..', '..', '..'), encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const LOGIN_OUTCOME_TIMEOUT_MS = 90_000;

/**
 * Submit the login form ONLY once the client has hydrated. The inputs are
 * React-controlled (`value={email}`) and `required`: typing before hydration is
 * wiped by the first client render, the browser's required-field validation
 * then swallows the submit and nothing ever navigates (seen as a 120 s
 * waitForURL timeout on a cold dev server). So: settle the network, fill, and
 * re-check the DOM value until it sticks; after the click, resolve on the
 * redirect OR an inline role=alert (wrong credentials / no CRM access) instead
 * of hanging on a URL that will never change.
 */
/** The CrmLoginClient inline error (AuthFormError, role=alert inside the form) with text. */
function loginAlert(page: Page) {
  return page.locator('form').getByRole('alert').filter({ hasText: /\S/ }).first();
}

async function submitLogin(page: Page, user: { email: string; password: string }): Promise<URL> {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
    /* dev server still streaming — fall through to the value-sticks probe */
  });
  const email = page.locator('#email');
  const password = page.locator('#password');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let stuck = false;
    for (let probe = 0; probe < 20 && !stuck; probe += 1) {
      await email.fill(user.email);
      await password.fill(user.password);
      await page.waitForTimeout(250);
      stuck = (await email.inputValue()) === user.email && (await password.inputValue()) === user.password;
    }
    if (!stuck) throw new Error('login form never kept the typed values (hydration did not settle in 5 s)');
    await page.locator('button[type=submit]').click();
    const outcome = await Promise.race([
      page
        .waitForURL(
          (u) => /^\/crm(\/|$)/.test(u.pathname) || u.pathname.startsWith('/crm-access-denied') || (u.pathname.startsWith(LOGIN_PATH) && u.searchParams.has('error')),
          { timeout: LOGIN_OUTCOME_TIMEOUT_MS },
        )
        .then(() => 'navigated' as const),
      // Scoped to the form and to non-empty text: Next's route announcer is a
      // (visually hidden) role=alert that would otherwise resolve instantly.
      loginAlert(page)
        .waitFor({ state: 'visible', timeout: LOGIN_OUTCOME_TIMEOUT_MS })
        .then(() => 'alert' as const),
      page.waitForTimeout(LOGIN_OUTCOME_TIMEOUT_MS).then(() => 'timeout' as const),
    ]).catch(() => 'timeout' as const);
    if (outcome === 'navigated') {
      await page.waitForLoadState('domcontentloaded');
      return new URL(page.url());
    }
    if (outcome === 'alert') return new URL(page.url());
    // Submit swallowed (hydration wiped the fields under us) — the fields are empty again; retry.
    const emptied = (await email.inputValue()) === '' || (await password.inputValue()) === '';
    console.warn(`[walk] login attempt ${attempt}: no navigation and no alert after ${LOGIN_OUTCOME_TIMEOUT_MS / 1000}s${emptied ? ' (fields were reset — hydration race)' : ''}; retrying`);
  }
  return new URL(page.url());
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = BASE_URL;
  const role = walkRole();
  const user = FIXTURE.users[role];
  const startedAt = new Date();
  const runId = startedAt.toISOString().replace(/[:.]/g, '-');
  const dir = path.join(WALK_ROOT, runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  process.env.WALK_RUN_DIR = dir;
  process.env.WALK_RUN_ID = runId;
  process.env.WALK_STARTED_AT = startedAt.toISOString();

  // The harness' own view of the stack. The webServer env block forces the same
  // values onto `next dev`; the network trap below proves the app used them.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL && isLocalSupabaseHost(process.env.NEXT_PUBLIC_SUPABASE_URL)
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : LOCAL_SUPABASE_URL;
  const serviceKey = LOCAL_SUPABASE_SERVICE_ROLE_KEY;

  const traps: TrapResult[] = [];
  const keep = (r: TrapResult, phase: TrapResult['phase']): TrapResult => {
    const tagged = { ...r, phase };
    traps.push(tagged);
    recordTrap(tagged);
    console.log(`  ${tagged.pass ? 'PASS' : 'FAIL'}  TRAP ${tagged.name.padEnd(20)} ${tagged.detail}`);
    return assertTrap(tagged);
  };

  const serverMode = walkServerMode();
  console.log(`\n[walk] run ${runId} · role=${role} · ${baseURL} → ${supabaseUrl} · server=${serverMode}`);
  if (serverMode !== 'prod') {
    console.warn('[walk] UNGRADED RUN — this walk is measuring `next dev`, not the build that ships. walk.json records env.serverMode="dev" and walk:crm:gate will refuse it.');
  }
  const negatives = [
    NEGATIVE.skipPinCookie ? 'E2E_SKIP_PIN_COOKIE=1' : null,
    NEGATIVE.anchorPhoneOverride ? `E2E_ANCHOR_PHONE=${NEGATIVE.anchorPhoneOverride}` : null,
    NEGATIVE.forceViewportWidth ? `E2E_FORCE_VIEWPORT_WIDTH=${NEGATIVE.forceViewportWidth}` : null,
  ].filter(Boolean);
  if (negatives.length > 0) console.log(`[walk] NEGATIVE-RUN switches active: ${negatives.join(' ')} — this run is expected to FAIL on a trap`);
  let navProfile: 'full' | 'simple' | 'unknown' = 'unknown';
  let layoutV2 = false;

  const writeEnv = () => {
    const projects = config.projects.map((p) => p.name).filter((n) => n.length > 0);
    const first = config.projects[0]?.use.viewport;
    fs.writeFileSync(
      path.join(dir, 'env.json'),
      JSON.stringify(
        {
          commit: gitHead(),
          startedAt: startedAt.toISOString(),
          env: {
            baseURL,
            supabaseUrl,
            navProfile,
            layoutV2,
            viewport: first ? `${first.width}x${first.height}` : '1440x900',
            project: projects.join(','),
            role,
            serverMode,
            // The identity of the build that actually answered — proved against
            // the served document by TRAP:server-mode. It is what makes the
            // `commit` above evidence rather than an assertion: without it the
            // document could name any commit over any bundle.
            buildId: process.env.WALK_BUILD_ID ?? null,
          },
        },
        null,
        2,
      ),
    );
  };

  /**
   * A pre-login trap (prod-guard / pin-gate) fails before any browser context
   * exists. EV-3 still wants "the named trap AND a screenshot" in the run
   * folder, so open a throwaway context, load /crm exactly as the failed probe
   * saw it (no PIN cookie — the disguise page is the evidence) and save
   * trap-<name>.png; env.json follows so global-teardown can still write
   * walk.json with the failed trap row.
   */
  const preLoginShot = async (name: string) => {
    let throwaway: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    try {
      throwaway = await chromium.launch();
      const ctx = await throwaway.newContext({ baseURL, viewport: desktopViewport() });
      const p = await ctx.newPage();
      await p.goto('/crm', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {
        /* screenshot whatever rendered (about:blank if the server is down) */
      });
      await p.screenshot({ path: path.join(dir, `trap-${name}.png`), fullPage: true });
    } catch (shotErr) {
      console.warn(`[walk] could not capture trap-${name}.png: ${(shotErr as Error).message}`);
    } finally {
      await throwaway?.close().catch(() => {
        /* ignore */
      });
    }
  };

  console.log('[walk] pre-login traps');
  try {
    keep(await trapProdGuard({ supabaseUrl, serviceRoleKey: serviceKey }), 'pre-login');
    // Before anything is measured: the server answering on baseURL really is the
    // binary this run claims to grade. reuseExistingServer is on locally, so an
    // already-running `next dev` would otherwise be adopted silently.
    keep(await trapServerMode(serverMode, baseURL), 'pre-login');
    const bare = await pwRequest.newContext({ baseURL });
    try {
      keep(await trapPinGate(bare, baseURL), 'pre-login');
    } finally {
      await bare.dispose();
    }
  } catch (err) {
    await preLoginShot(err instanceof TrapFailure ? err.trap.name : 'setup-failure');
    writeEnv();
    throw err;
  }

  // ── Login ────────────────────────────────────────────────────────────
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, viewport: desktopViewport() });
  // Negative run (E2E_SKIP_PIN_COOKIE=1): arm nothing — pin-gate above already failed; this keeps the two honest together.
  if (!NEGATIVE.skipPinCookie) await context.addCookies([pinCookie(baseURL)]);
  const page = await context.newPage();
  // Login is part of the walk. Until this was armed, /crm-login and the first
  // /crm render were the one stretch nothing watched — arm before the first
  // goto so the graded window starts at the very first byte.
  armPageIssueTrap(page);
  const supabaseHosts = new Set<string>();
  page.on('request', (req) => {
    try {
      const u = new URL(req.url());
      if (u.port === '54321' || /supabase/i.test(u.hostname) || u.pathname.startsWith('/auth/v1') || u.pathname.startsWith('/rest/v1')) {
        supabaseHosts.add(u.host);
      }
    } catch {
      /* ignore */
    }
  });

  const failShot = async (name: string) => {
    try {
      await page.screenshot({ path: path.join(dir, `trap-${name}.png`), fullPage: true });
    } catch {
      /* ignore */
    }
  };

  try {
    console.log(`[walk] login as ${user.email} at ${LOGIN_PATH}`);
    await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    keep(await trapNotPinPage(page), 'pre-login');
    const landed = await submitLogin(page, user);
    if (!/^\/crm(\/|$)/.test(landed.pathname)) {
      const alert = (await loginAlert(page).allTextContents().catch(() => [] as string[])).join(' | ').trim();
      const r = recordTrap({
        name: 'login',
        pass: false,
        detail: `landed on ${landed.pathname}${landed.search} instead of /crm${alert ? ` (alert: "${alert}")` : ''} — fixture user missing/inactive or no crm_role`,
        phase: 'post-login',
      });
      traps.push(r);
      await failShot('login');
      throw new TrapFailure(r);
    }
    await context.storageState({ path: authStatePath(role) });
    console.log(`[walk] storageState → ${path.relative(process.cwd(), authStatePath(role))}`);

    console.log('[walk] post-login traps');
    keep(trapProdGuardNetwork(supabaseHosts), 'post-login');
    keep(await trapNotPinPage(page), 'post-login');
    keep(await trapNoLockRedirect(page), 'post-login');
    keep(await trapRightOrg(page.request, page, baseURL), 'post-login');
    const nav = await trapNavProfile(page, { expect: 'full' });
    navProfile = nav.navProfile;
    keep(nav, 'post-login');
    const notEmpty = await trapNotEmpty(page.request, baseURL);
    keep(notEmpty, 'post-login');
    const anchor = notEmpty.anchor;
    const vocab = await readStatusVocabulary(supabaseUrl, serviceKey, FIXTURE.anchor.moduleKey);
    keep(trapStatusVocab(anchor, vocab), 'post-login');
    keep(await trapBreakpoint(page, 'desktop-1440', anchor?.url ?? null), 'post-login');
    if (anchor) {
      const v2 = await trapLayoutV2(page, anchor.url);
      layoutV2 = v2.pass;
      keep(v2, 'post-login');
    }
    // Last, over everything the setup browser loaded (login → /crm → the
    // anchor record). Recorded but NOT thrown: a browser error here must not
    // stop the run from producing the rest of its evidence, and it cannot be
    // swallowed either — walk-gate fails on any red trap row.
    const setupIssues: TrapResult = { ...trapNoPageIssues(page, `login and the post-login sweep as ${role}`), phase: 'post-login' };
    traps.push(setupIssues);
    recordTrap(setupIssues);
    console.log(`  ${setupIssues.pass ? 'PASS' : 'FAIL'}  TRAP ${setupIssues.name.padEnd(20)} ${setupIssues.detail}`);
    if (!setupIssues.pass) await failShot('page-errors-setup');
  } catch (err) {
    // Every setup failure leaves a screenshot — not only trap failures.
    await failShot(err instanceof TrapFailure ? err.trap.name : 'setup-failure');
    writeEnv();
    await browser.close();
    throw err;
  }

  writeEnv();
  await browser.close();
}
