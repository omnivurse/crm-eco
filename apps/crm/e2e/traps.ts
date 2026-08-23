/**
 * EV-3 — false-result traps. Every trap returns {name, pass, detail}; callers
 * `assertTrap()` which throws `TRAP:<name> — <detail>` on the first failure.
 * global-setup runs them before/after login; specs re-assert the per-project
 * ones through `assertTrapsInTest()` so a walk can never count clicks against
 * the wrong stack, the PIN page, an empty DB, the wrong org, the V1 shell, or
 * the wrong breakpoint.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';
import {
  ACTIVE_LANE_STATUSES,
  BASE_URL,
  FIXTURE,
  LOGIN_PATH,
  MFA_STEP_UP_PATH,
  NEGATIVE,
  PIFH_ORG_ID,
  PIFH_ORG_SLUG,
  PIN_COOKIE_NAME,
  PIN_LOCK_PATH,
  PIN_LOCK_TITLE,
  PIN_SESSION_MS,
  anchorPhone,
  isLocalSupabaseHost,
} from './env';

export interface TrapResult {
  name: string;
  pass: boolean;
  detail: string;
  phase?: 'pre-login' | 'post-login' | 'in-test';
  project?: string;
}

export class TrapFailure extends Error {
  readonly trap: TrapResult;
  constructor(trap: TrapResult) {
    super(`TRAP:${trap.name} — ${trap.detail}`);
    this.name = 'TrapFailure';
    this.trap = trap;
  }
}

export function trapResult(name: string, pass: boolean, detail: string): TrapResult {
  return { name, pass, detail };
}

/** Append a trap row to the run's ledger (merged into walk.json by global-teardown). */
export function recordTrap(result: TrapResult): TrapResult {
  const dir = process.env.WALK_RUN_DIR;
  if (dir) {
    // Only the schema'd fields — some traps return extra payload (anchor, navProfile…).
    const row: TrapResult = { name: result.name, pass: result.pass, detail: result.detail };
    if (result.phase) row.phase = result.phase;
    if (result.project) row.project = result.project;
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'traps.jsonl'), `${JSON.stringify(row)}\n`);
  }
  return result;
}

export function assertTrap(result: TrapResult): TrapResult {
  if (!result.pass) throw new TrapFailure(result);
  return result;
}

export function pinCookieValue(now = Date.now()): string {
  return String(now + PIN_SESSION_MS);
}

export function pinCookie(baseURL = BASE_URL) {
  return {
    name: PIN_COOKIE_NAME,
    value: pinCookieValue(),
    domain: new URL(baseURL).hostname,
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  };
}

// ---------------------------------------------------------------------------
// Pre-login traps
// ---------------------------------------------------------------------------

/**
 * prod-guard: the harness env points at the local stack AND that stack holds
 * the local PIFH org (slug 'pifh-local'). The service key is used server-side
 * only (organizations RLS blocks anon) and is never echoed into the detail.
 */
export async function trapProdGuard(opts: {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
}): Promise<TrapResult> {
  const name = 'prod-guard';
  const url = opts.supabaseUrl ?? '';
  if (!url) return trapResult(name, false, 'NEXT_PUBLIC_SUPABASE_URL is not set for the harness');
  if (!isLocalSupabaseHost(url)) {
    return trapResult(name, false, `NEXT_PUBLIC_SUPABASE_URL host is "${new URL(url).hostname}" — the walk runs ONLY against 127.0.0.1/localhost`);
  }
  if (!opts.serviceRoleKey) return trapResult(name, false, 'SUPABASE_SERVICE_ROLE_KEY (local) is not set for the harness');
  let slug: string | null = null;
  try {
    const res = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/organizations?id=eq.${PIFH_ORG_ID}&select=slug`,
      { headers: { apikey: opts.serviceRoleKey, Authorization: `Bearer ${opts.serviceRoleKey}` } },
    );
    if (!res.ok) return trapResult(name, false, `organizations lookup returned HTTP ${res.status}`);
    const rows = (await res.json()) as Array<{ slug?: string }>;
    slug = rows[0]?.slug ?? null;
  } catch (err) {
    return trapResult(name, false, `could not reach ${url}: ${(err as Error).message}`);
  }
  if (slug !== PIFH_ORG_SLUG) {
    return trapResult(name, false, `organizations ${PIFH_ORG_ID} slug is "${slug}" (expected "${PIFH_ORG_SLUG}") — this is not the local walk DB`);
  }
  return trapResult(name, true, `${new URL(url).host} · org ${PIFH_ORG_ID} slug=${slug}`);
}

/**
 * prod-guard-network: every Supabase request the BROWSER made while logging in
 * went to the local stack (proves the dev server really used the env we gave
 * it, regardless of what apps/crm/.env.local says).
 */
export function trapProdGuardNetwork(observedHosts: Iterable<string>): TrapResult {
  const name = 'prod-guard-network';
  const hosts = Array.from(new Set(observedHosts));
  if (hosts.length === 0) return trapResult(name, false, 'the browser made no Supabase request during login — cannot prove which stack the app uses');
  const remote = hosts.filter((h) => !isLocalSupabaseHost(`http://${h}`));
  if (remote.length > 0) return trapResult(name, false, `browser talked to non-local Supabase host(s): ${remote.join(', ')}`);
  return trapResult(name, true, `browser Supabase traffic: ${hosts.join(', ')}`);
}

/**
 * The Cookie header the harness arms its browser contexts with. Empty when
 * E2E_SKIP_PIN_COOKIE=1 (negative run) — the walk must then die on pin-gate.
 */
export function harnessPinCookieHeader(): string {
  return NEGATIVE.skipPinCookie ? '' : `${PIN_COOKIE_NAME}=${pinCookieValue()}`;
}

/**
 * pin-gate: /crm without the cookie redirects to /lock (the gate is up) AND the
 * cookie jar the harness arms gets past it (so the walk will not be measured on
 * the PIN page). `request` must be a context WITHOUT the storage state (no
 * cookies at all).
 */
export async function trapPinGate(request: APIRequestContext, baseURL = BASE_URL): Promise<TrapResult> {
  const name = 'pin-gate';
  const bare = await request.get(`${baseURL}/crm`, { maxRedirects: 0, headers: { cookie: '' } });
  const loc = bare.headers()['location'] ?? '';
  const redirectedToLock = bare.status() >= 300 && bare.status() < 400 && new URL(loc, baseURL).pathname.startsWith(PIN_LOCK_PATH);
  if (!redirectedToLock) {
    return trapResult(name, false, `GET /crm without ${PIN_COOKIE_NAME} returned ${bare.status()} location="${loc}" — expected a redirect to ${PIN_LOCK_PATH}`);
  }
  const armed = harnessPinCookieHeader();
  const jar = armed ? PIN_COOKIE_NAME : `an EMPTY cookie jar (E2E_SKIP_PIN_COOKIE=1)`;
  const withCookie = await request.get(`${baseURL}/crm`, {
    maxRedirects: 0,
    headers: { cookie: armed },
  });
  const loc2 = withCookie.headers()['location'] ?? '';
  if (withCookie.status() >= 300 && withCookie.status() < 400 && new URL(loc2, baseURL).pathname.startsWith(PIN_LOCK_PATH)) {
    return trapResult(name, false, `GET /crm WITH ${jar} still redirected to ${PIN_LOCK_PATH} — the harness would be measuring the PIN page${armed ? ' (cookie semantics changed?)' : ''}`);
  }
  return trapResult(name, true, `no cookie → ${bare.status()} ${new URL(loc, baseURL).pathname}; with ${jar} → ${withCookie.status()} ${loc2 ? new URL(loc2, baseURL).pathname : 'page'}`);
}

// ---------------------------------------------------------------------------
// Post-login traps (page/request carry the operator storage state)
// ---------------------------------------------------------------------------

/** pin-page: the current document is not the PIN disguise page. */
export async function trapNotPinPage(page: Page): Promise<TrapResult> {
  const name = 'pin-page';
  const title = await page.title();
  const pinInputs = await page.locator("input[aria-label^='PIN digit']").count();
  const url = new URL(page.url());
  if (title === PIN_LOCK_TITLE || pinInputs > 0 || url.pathname.startsWith(PIN_LOCK_PATH)) {
    return trapResult(name, false, `landed on the PIN page (title="${title}", pinInputs=${pinInputs}, path=${url.pathname})`);
  }
  return trapResult(name, true, `title="${title}" path=${url.pathname}`);
}

/** no-lock-redirect: no MFA step-up, no session-lock overlay, no login bounce. */
export async function trapNoLockRedirect(page: Page): Promise<TrapResult> {
  const name = 'no-lock-redirect';
  const url = new URL(page.url());
  if (url.pathname.startsWith(MFA_STEP_UP_PATH)) return trapResult(name, false, `redirected to the MFA step-up page ${url.pathname} — CRM_ENFORCE_MFA must be unset for the walk`);
  if (url.pathname.startsWith(LOGIN_PATH)) return trapResult(name, false, `bounced to ${url.pathname}${url.search}`);
  const locked = await page.getByRole('heading', { name: 'Session Locked' }).count();
  if (locked > 0) return trapResult(name, false, 'SessionLock overlay is showing — NEXT_PUBLIC_ENABLE_SESSION_LOCK must be unset for the walk');
  return trapResult(name, true, `path=${url.pathname}`);
}

/** right-org: every /api/crm/modules row belongs to PIFH and we were not bounced. */
export async function trapRightOrg(request: APIRequestContext, page: Page | null, baseURL = BASE_URL): Promise<TrapResult> {
  const name = 'right-org';
  if (page) {
    const url = new URL(page.url());
    if (url.pathname.startsWith(LOGIN_PATH) && url.searchParams.get('error')) {
      return trapResult(name, false, `bounced to ${LOGIN_PATH}?error=${url.searchParams.get('error')}`);
    }
  }
  const res = await request.get(`${baseURL}/api/crm/modules`);
  if (!res.ok()) return trapResult(name, false, `/api/crm/modules → HTTP ${res.status()}`);
  const rows = (await res.json()) as Array<{ key?: string; org_id?: string }>;
  if (!Array.isArray(rows) || rows.length === 0) return trapResult(name, false, '/api/crm/modules returned no modules');
  const foreign = rows.filter((r) => r.org_id !== PIFH_ORG_ID);
  if (foreign.length > 0) return trapResult(name, false, `${foreign.length} module row(s) belong to another org: ${foreign.map((r) => `${r.key}:${r.org_id}`).join(', ')}`);
  return trapResult(name, true, `${rows.length} modules, all org ${PIFH_ORG_ID} (${rows.map((r) => r.key).join(', ')})`);
}

export type NavProfile = 'full' | 'simple' | 'unknown';

/** nav-profile: the full shell (top module tab bar) is what the walk measures. */
export async function trapNavProfile(page: Page, opts: { expect: NavProfile } = { expect: 'full' }): Promise<TrapResult & { navProfile: NavProfile }> {
  const name = 'nav-profile';
  const nav = page.locator("nav[aria-label='Modules']");
  const present = (await nav.count()) > 0;
  const navProfile: NavProfile = present ? 'full' : 'simple';
  if (opts.expect !== 'unknown' && navProfile !== opts.expect) {
    return { ...trapResult(name, false, `resolved nav profile "${navProfile}" (nav[aria-label='Modules'] ${present ? 'present' : 'absent'}) — owner decision is the ${opts.expect} shell; check crm_feature_flags crm.nav.simple for the PIFH org`), navProfile };
  }
  return { ...trapResult(name, true, `nav profile "${navProfile}"`), navProfile };
}

export interface AnchorRecord {
  id: string;
  url: string;
  title: string;
  moduleKey: string;
  status: string | null;
}

/** Finds the Wendy Walker fixture record via the search API (or null). */
export async function findAnchorRecord(request: APIRequestContext, baseURL = BASE_URL): Promise<AnchorRecord | null> {
  const phone = anchorPhone();
  const res = await request.get(`${baseURL}/api/crm/search?q=${encodeURIComponent(phone)}&limit=10`);
  if (!res.ok()) throw new Error(`/api/crm/search → HTTP ${res.status()}`);
  const body = (await res.json()) as { results?: Array<{ id: string; url: string; title: string; moduleKey: string; subtitle?: string }> };
  const hit = (body.results ?? []).find((r) => r.moduleKey === FIXTURE.anchor.moduleKey && /wendy\s+walker/i.test(r.title))
    ?? (body.results ?? []).find((r) => r.moduleKey === FIXTURE.anchor.moduleKey)
    ?? null;
  if (!hit) return null;
  // /api/crm/records/[id] omits the status column; the list endpoint returns the full row.
  let status: string | null = null;
  const list = await request.get(
    `${baseURL}/api/crm/records?module_key=${encodeURIComponent(hit.moduleKey)}&search=${encodeURIComponent(phone)}&page=1&page_size=10`,
  );
  if (list.ok()) {
    const body = (await list.json()) as { records?: Array<{ id: string; status?: string | null; data?: { status?: unknown } | null }> };
    const row = (body.records ?? []).find((r) => r.id === hit.id);
    const fromData = typeof row?.data?.status === 'string' ? row.data.status : null;
    status = row?.status ?? fromData ?? null;
  }
  if (status === null && hit.subtitle) {
    // Last resort: the search subtitle is "email · phone · status".
    const tail = hit.subtitle.split(' · ').pop()?.trim();
    if (tail && tail !== phone && !tail.includes('@')) status = tail;
  }
  return { id: hit.id, url: hit.url, title: hit.title, moduleKey: hit.moduleKey, status };
}

/** not-empty: the anchor record resolves and the contacts list pages (≥32). */
export async function trapNotEmpty(request: APIRequestContext, baseURL = BASE_URL): Promise<TrapResult & { anchor: AnchorRecord | null; total: number }> {
  const name = 'not-empty';
  let anchor: AnchorRecord | null = null;
  try {
    anchor = await findAnchorRecord(request, baseURL);
  } catch (err) {
    return { ...trapResult(name, false, `search failed: ${(err as Error).message}`), anchor: null, total: 0 };
  }
  if (!anchor) {
    const override = NEGATIVE.anchorPhoneOverride ? ' (E2E_ANCHOR_PHONE override in effect)' : '';
    return { ...trapResult(name, false, `/api/crm/search?q=${anchorPhone()} did not return the fixture record${override} — DB empty or seed missing (run scripts/e2e seed)`), anchor: null, total: 0 };
  }
  const list = await request.get(`${baseURL}/api/crm/records?module_key=${FIXTURE.anchor.moduleKey}&page=1&page_size=${FIXTURE.listPageSize}`);
  if (!list.ok()) return { ...trapResult(name, false, `/api/crm/records → HTTP ${list.status()}`), anchor, total: 0 };
  const body = (await list.json()) as { total?: number; totalPages?: number };
  const total = body.total ?? 0;
  if (total < FIXTURE.minContacts) {
    return { ...trapResult(name, false, `contacts total=${total} < ${FIXTURE.minContacts} — the list would not page at ${FIXTURE.listPageSize}/page`), anchor, total };
  }
  return { ...trapResult(name, true, `anchor ${anchor.title} (${anchor.id.slice(0, 8)}…) · contacts total=${total}, pages=${body.totalPages}`), anchor, total };
}

/** layout-v2: the record page renders the V2 chrome (role=group "Add note"). */
export async function trapLayoutV2(page: Page, recordUrl: string): Promise<TrapResult> {
  const name = 'layout-v2';
  if (!new URL(page.url()).pathname.startsWith(new URL(recordUrl, BASE_URL).pathname)) {
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded' });
  }
  const group = page.getByRole('group', { name: 'Add note' });
  try {
    await group.first().waitFor({ state: 'attached', timeout: 30_000 });
  } catch {
    return trapResult(name, false, `record page ${recordUrl} has no role=group[aria-label='Add note'] — V1 shell or crm.layout.v2 flag off`);
  }
  return trapResult(name, true, `V2 chrome present on ${new URL(page.url()).pathname}`);
}

/** status-vocab: the anchor's status is an allowed Active-lane value (and in the org vocabulary when given). */
export function trapStatusVocab(anchor: AnchorRecord | null, vocabulary: readonly string[] | null): TrapResult {
  const name = 'status-vocab';
  if (!anchor) return trapResult(name, false, 'no anchor record to check');
  const status = anchor.status ?? '';
  if (!(ACTIVE_LANE_STATUSES as readonly string[]).includes(status)) {
    return trapResult(name, false, `anchor status "${status}" is not an Active-lane value (${ACTIVE_LANE_STATUSES.join(' | ')})`);
  }
  if (vocabulary && !vocabulary.includes(status)) {
    return trapResult(name, false, `anchor status "${status}" is not in crm_status_vocabulary for contacts (${vocabulary.join(' | ')})`);
  }
  return trapResult(name, true, `anchor status "${status}"${vocabulary ? ` ∈ vocabulary[${vocabulary.length}]` : ''}`);
}

/** Reads the org's contacts vocabulary via PostgREST with the LOCAL service key (setup only). */
export async function readStatusVocabulary(supabaseUrl: string, serviceRoleKey: string, moduleKey = 'contacts'): Promise<string[] | null> {
  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/crm_status_vocabulary?org_id=eq.${PIFH_ORG_ID}&module_key=eq.${moduleKey}&select=statuses`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ statuses?: string[] }>;
    return rows[0]?.statuses ?? null;
  } catch {
    return null;
  }
}

export type BreakpointKind = 'desktop' | 'tablet' | 'mobile';

export function breakpointForProject(project: string): BreakpointKind {
  if (project.startsWith('mobile')) return 'mobile';
  if (project.startsWith('tablet')) return 'tablet';
  return 'desktop';
}

/**
 * breakpoint: desktop/tablet assert width ≥1024 and the contacts filter rail
 * (aside[aria-label="Filter Contacts by"], FilterRailFrame) is visible on the
 * list page; mobile asserts width <768 and the lg:hidden MobileActionBar
 * (nav[aria-label="Quick actions"]) on the record page. Navigates.
 */
export async function trapBreakpoint(page: Page, project: string, recordUrl: string | null): Promise<TrapResult> {
  const name = 'breakpoint';
  const vp = page.viewportSize();
  if (!vp) return trapResult(name, false, 'no viewport set');
  const kind = breakpointForProject(project);
  if (kind === 'mobile') {
    if (vp.width >= 768) return trapResult(name, false, `${project} viewport ${vp.width}x${vp.height} is not <768`);
    if (!recordUrl) return trapResult(name, false, 'no record URL to check the mobile action bar on');
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded' });
    const bar = page.locator("nav[aria-label='Quick actions']");
    try {
      await bar.first().waitFor({ state: 'visible', timeout: 30_000 });
    } catch {
      return trapResult(name, false, `${project} ${vp.width}x${vp.height}: MobileActionBar (nav[aria-label='Quick actions']) not visible on the record page`);
    }
    return trapResult(name, true, `${project} ${vp.width}x${vp.height} · mobile action bar visible`);
  }
  if (vp.width < 1024) return trapResult(name, false, `${project} viewport ${vp.width}x${vp.height} is not ≥1024`);
  await page.goto(`/crm/modules/${FIXTURE.anchor.moduleKey}`, { waitUntil: 'domcontentloaded' });
  const rail = page.locator("aside[aria-label='Filter Contacts by']");
  try {
    await rail.first().waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    return trapResult(name, false, `${project} ${vp.width}x${vp.height}: filter rail/toggle (aside[aria-label='Filter Contacts by']) not visible on /crm/modules/contacts`);
  }
  return trapResult(name, true, `${project} ${vp.width}x${vp.height} · filter rail visible`);
}

// ---------------------------------------------------------------------------
// In-test re-assertion
// ---------------------------------------------------------------------------

/**
 * Re-runs the traps that can drift per project/test. Call it at the start of a
 * spec (it navigates, so call it BEFORE the first counted task). Results are
 * appended to the run ledger; the first failure throws TRAP:<name>.
 */
export async function assertTrapsInTest(args: {
  page: Page;
  request: APIRequestContext;
  bareRequest: APIRequestContext;
  project: string;
  baseURL?: string;
}): Promise<{ traps: TrapResult[]; anchor: AnchorRecord | null; navProfile: NavProfile }> {
  const baseURL = args.baseURL ?? BASE_URL;
  const results: TrapResult[] = [];
  const keep = (r: TrapResult): TrapResult => {
    const tagged = { ...r, phase: 'in-test' as const, project: args.project };
    results.push(tagged);
    recordTrap(tagged);
    return assertTrap(tagged);
  };
  // The walk fixture arms this when the page is created; arming again here is a
  // no-op that keeps the trap honest for any caller that builds its own page.
  armPageIssueTrap(args.page);
  keep(await trapPinGate(args.bareRequest, baseURL));
  if (!/^\/crm(\/|$|\?)/.test(new URL(args.page.url(), baseURL).pathname)) {
    await args.page.goto('/crm', { waitUntil: 'domcontentloaded' });
  }
  keep(await trapNotPinPage(args.page));
  keep(await trapNoLockRedirect(args.page));
  keep(await trapRightOrg(args.request, args.page, baseURL));
  const kind = breakpointForProject(args.project);
  // The module tab bar is desktop chrome; on the phone project we only record it.
  const nav = await trapNavProfile(args.page, { expect: kind === 'mobile' ? 'unknown' : 'full' });
  keep(nav);
  const notEmpty = await trapNotEmpty(args.request, baseURL);
  keep(notEmpty);
  keep(await trapBreakpoint(args.page, args.project, notEmpty.anchor?.url ?? null));
  if (notEmpty.anchor) keep(await trapLayoutV2(args.page, notEmpty.anchor.url));
  keep(trapStatusVocab(notEmpty.anchor, null));
  // Last: everything the trap sweep itself loaded (list, record, /crm) must
  // have loaded without a browser error. The fixture re-asserts at teardown
  // over the whole test.
  // Recorded red like any other trap, but only an UNDIAGNOSED error aborts the
  // spec — see hasUntrackedPageIssue. A PI-n defect must not cost the walk its
  // entire evidence base.
  const sweepIssues = trapNoPageIssues(args.page, `the trap sweep on ${args.project}`);
  const sweepTagged = { ...sweepIssues, phase: 'in-test' as const, project: args.project };
  results.push(sweepTagged);
  recordTrap(sweepTagged);
  if (hasUntrackedPageIssue(args.page)) assertTrap(sweepTagged);
  return { traps: results, anchor: notEmpty.anchor, navProfile: nav.navProfile };
}

// ---------------------------------------------------------------------------
// page-errors — the browser console is evidence too
// ---------------------------------------------------------------------------

/**
 * A run that reports "0 failures" while the Next dev overlay shows a red
 * "N Issues" badge is not evidence, it is a screenshot of an unread error. The
 * walk never listened to the browser, so an uncaught exception, a React
 * hydration mismatch or a failed console.error passed straight through every
 * green row.
 *
 * `armPageIssueTrap` attaches a `pageerror` + `console` listener (idempotent
 * per Page) and `trapNoPageIssues` grades what they collected. The walk fixture
 * arms it the moment the page exists — so the window is the WHOLE test — and
 * asserts it twice: inside `assertTrapsInTest` (everything up to the first
 * counted task) and again at fixture teardown (everything the walk did).
 */
export interface PageIssue {
  kind: 'pageerror' | 'console';
  text: string;
  url: string;
  /** PI-n diagnosis when this line is a defect the walk has already identified. Graded all the same. */
  known?: string;
}

const pageIssues = new WeakMap<Page, PageIssue[]>();

/**
 * Lines the trap does not redden the run for. Kept deliberately short and
 * specific — each entry names WHY, and `splitPageIssues` carries the line AND
 * the reason into walk.json, so a suppressed line is disclosed, never hidden.
 * Anything not on this list fails the trap.
 *
 * Two kinds live here and the `why` says which:
 *   · dev-server noise that is not the application talking at all;
 *   · PI-n — a real defect the walk FOUND, diagnosed and handed to the owner,
 *     matched narrowly enough that nothing else can hide behind it.
 */
const PAGE_ISSUE_IGNORE: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  // The dev server streams HMR over a websocket that Playwright tears down at
  // navigation; the failure is the runner closing the tab, not the page.
  { pattern: /_next\/webpack-hmr|websocket connection to .*_next/i, why: 'dev-only HMR socket torn down by navigation' },
  // Chromium logs a console error for the favicon/apple-touch-icon probe that
  // `next dev` answers with a 404 before the route is compiled.
  { pattern: /failed to load resource.*\b(favicon\.ico|apple-touch-icon)/i, why: 'dev-only icon probe 404' },
];

/**
 * PI-n — defects the walk FOUND and diagnosed. They are deliberately NOT on the
 * suppression list: a known defect is still a RED row. This list only staples
 * the id and the one-line diagnosis onto the line so a reader of walk.json
 * knows what they are looking at instead of re-diagnosing it. Allowlisting it
 * would rebuild the exact false result this trap exists to kill — green rows
 * printed beside a red dev-overlay badge.
 */
const PAGE_ISSUE_KNOWN: ReadonlyArray<{ id: string; pattern: RegExp; note: string }> = [
  // The red "1 Issue" the Next dev overlay showed in the wave-3 record-page
  // screenshot, which nothing in the harness was listening for. Verified from
  // artifacts/crm-walk/2026-08-23T16-33-57-035Z/page-errors.jsonl.
  //
  //   WHAT: a React `useId` hydration mismatch across the CRM shell chrome. The
  //   server and the client generate different Radix ids
  //   (`id="radix-_R_2hotiqbn6lb_"` vs `id="radix-_R_ke7cmitplb_"`), so React
  //   reports an attribute mismatch on EIGHT shell controls, not one:
  //     · SplitCreateButton.tsx:185 — the "Add Member" ⌄ trigger (id)
  //     · CrmTopBar.tsx:295 — the second top-bar dropdown trigger (id)
  //     · BottomBar.tsx:57/84/111/146/173 — Chats, Channels, Contacts,
  //       Quick Actions, Sticky Notes (aria-controls)
  //   CAUSE (verified by experiment; `next/dynamic({ssr:false})` was disproved —
  //   removing every such import left the server ids byte-identical):
  //     D1 (product): ThemeProvider sat above the dehydrated
  //     `<Suspense>` at app/crm/layout.tsx:41-45 and published a new context
  //     value on mount, so React discarded the server HTML (`_r_<n>` ids).
  //     theme-store.ts keeps that context referentially stable.
  //     D2 (next-dev only): Next 16 `AppDevOverlayErrorBoundary` wraps the app
  //     as a 2-child array on the server and mounts the overlay as a separate
  //     client root, shifting every `useId`. Absent from
  //     app-page.runtime.prod.js.
  //   SEVERITY: React says of this class "This won't be patched up" — the
  //   server-rendered value stays in the DOM. Five of the eight are
  //   `aria-controls`, so the a11y wiring, not just cosmetics, is at stake.
  //   It surfaces on /crm, /crm/modules/contacts and /crm/r/<id>.
  //   This entry LABELS a radix-id hydration line. It does not suppress it
  //   (still a red row) and it does not absorb a hydration mismatch that
  //   names no radix id — that stays unlabelled and still aborts.
  {
    id: 'PI-1',
    pattern: /A tree hydrated but some attributes of the server rendered HTML didn't match[\s\S]*radix-/,
    note: 'PI-1 React useId hydration mismatch on 8 CRM-shell controls (SplitCreateButton.tsx:185, CrmTopBar.tsx:295, BottomBar.tsx:57/84/111/146/173). Not next/dynamic({ssr:false}) — disproved. D1: ThemeProvider context churn above app/crm/layout.tsx:41-45 <Suspense> (theme-store.ts). D2: Next 16 AppDevOverlayErrorBoundary tree fork, next-dev only.',
  },
  // Found by this trap on its first graded run, on /crm/r/not-a-uuid.
  //
  //   WHAT: `resolve-record.ts:169` logs
  //   `[resolve-record] audit entity_id_tombstone: invalid input syntax for
  //   type uuid: "not-a-uuid"` — a server console.error that `next dev`
  //   forwards to the browser console.
  //   CAUSE: the `entity_id_tombstone` probe (resolve-record.ts:141-149) feeds
  //   the raw path segment to `.eq('entity_id', cursor)` on a uuid column, so
  //   Postgres rejects the comparison for ANY non-uuid record id. The page
  //   still renders the not-found state, so nothing before this listened.
  //   NOT FIXED HERE: guarding the probe with a uuid test is product code.
  {
    id: 'PI-2',
    // The live line interleaves next-dev `%c` CSS between the colon and
    // `Server invalid input…`. `[\s\S]*` keeps the match on the words we
    // actually own (`[resolve-record] audit <probe>:`) and the postgres
    // error, without requiring them to be adjacent.
    pattern: /\[resolve-record\] audit [a-z_]+:[\s\S]*invalid input syntax for type uuid/i,
    note: 'PI-2 resolve-record.ts:169 logs a console.error for every non-uuid record id — the entity_id_tombstone probe (resolve-record.ts:141-149) sends the raw path segment to a uuid column. Guard the probe with a uuid test.',
  },
];

/** The PI-n diagnosis for this line, or null when it is an unknown error. */
export function knownPageIssue(text: string): { id: string; note: string } | null {
  for (const entry of PAGE_ISSUE_KNOWN) if (entry.pattern.test(text)) return { id: entry.id, note: entry.note };
  return null;
}

/** Why this line is suppressed, or null when it is graded as a real error. */
export function ignoredPageIssue(text: string): string | null {
  for (const entry of PAGE_ISSUE_IGNORE) if (entry.pattern.test(text)) return entry.why;
  return null;
}

/** A suppressed line, carried into walk.json WITH the reason it was dropped. */
export interface SuppressedPageIssue extends PageIssue {
  why: string;
}

export interface PageIssueSplit {
  /** Graded: every one of these fails the trap and reddens the task row. */
  real: PageIssue[];
  /** Allowlisted. Never hidden — walk.json carries them and the reason. */
  suppressed: SuppressedPageIssue[];
}

/**
 * Partition collected issues into graded and allowlisted. Nothing is discarded:
 * a filter whose output nobody can read is indistinguishable from a cover-up,
 * so the suppressed lines travel into walk.json next to the reason.
 */
export function splitPageIssues(issues: readonly PageIssue[]): PageIssueSplit {
  const real: PageIssue[] = [];
  const suppressed: SuppressedPageIssue[] = [];
  for (const issue of issues) {
    const why = ignoredPageIssue(issue.text);
    if (why !== null) {
      suppressed.push({ ...issue, why });
      continue;
    }
    // Graded. A PI-n match only labels it — it never moves it to `suppressed`.
    const known = knownPageIssue(issue.text);
    real.push(known ? { ...issue, known: known.note } : issue);
  }
  return { real, suppressed };
}

/** Attach the collectors. Safe to call repeatedly — only the first call binds. */
export function armPageIssueTrap(page: Page): PageIssue[] {
  const existing = pageIssues.get(page);
  if (existing) return existing;
  const issues: PageIssue[] = [];
  pageIssues.set(page, issues);
  // The text is kept WHOLE — a React hydration error puts the offending element
  // in its tail, and a 400-char preview cuts exactly that off. Only the trap
  // detail is truncated; the full entries are dumped to page-errors.jsonl.
  const push = (issue: PageIssue) => {
    issues.push(issue);
    const dir = process.env.WALK_RUN_DIR;
    if (dir) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(path.join(dir, 'page-errors.jsonl'), `${JSON.stringify(issue)}\n`);
      } catch {
        /* the trap must never be the thing that fails the run */
      }
    }
  };
  page.on('pageerror', (err) => {
    push({ kind: 'pageerror', text: `${err.name}: ${err.message}`, url: safeUrl(page) });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    push({ kind: 'console', text: msg.text(), url: safeUrl(page) });
  });
  return issues;
}

function safeUrl(page: Page): string {
  try {
    const u = new URL(page.url());
    return `${u.pathname}${u.search}`;
  } catch {
    return page.url();
  }
}

/** Everything the collectors have seen so far (empty when the trap was never armed). */
export function pageIssuesSoFar(page: Page): readonly PageIssue[] {
  return pageIssues.get(page) ?? [];
}

/**
 * Does this page carry a browser error the walk has NOT already diagnosed?
 *
 * The distinction is between the VERDICT and the ABORT, and they are not the
 * same decision:
 *   · VERDICT — a PI-n line still makes `page-errors` red, walk.json red and
 *     `walk:crm:gate` exit 1. A diagnosed defect is still a defect and the
 *     programme does not get to print "0 failures" next to it.
 *   · ABORT — only an UNKNOWN error stops the run. PI-1 lives in the shared
 *     CRM shell, so it is on /crm, every list and every record; throwing on it
 *     at the top of every spec would abort all 387 rows before the first one
 *     was measured and leave the owner with a red exit code and no evidence at
 *     all. That is a brick, not a gate.
 * So: record red, keep walking, and stop dead the moment something new appears.
 */
export function hasUntrackedPageIssue(page: Page): boolean {
  const collected = pageIssues.get(page);
  if (!collected) return true; // never armed — the loudest failure of all
  return splitPageIssues(collected).real.some((i) => !i.known);
}

/**
 * The issues collected AFTER `from` (a `pageIssuesSoFar(page).length` taken
 * earlier). The walk fixture takes that mark when a task starts, so a task row
 * is charged only with what the browser logged inside its own window — noise
 * from between tasks still reaches the per-test `page-errors` trap.
 */
export function pageIssuesSince(page: Page, from: number): readonly PageIssue[] {
  return (pageIssues.get(page) ?? []).slice(Math.max(0, from));
}

/**
 * page-errors: no uncaught exception and no console.error since the trap was
 * armed. `window` is the label that says which slice of the walk was graded.
 * Not armed at all is itself a failure — a silent trap is worse than none.
 */
export function trapNoPageIssues(page: Page, window: string): TrapResult {
  const name = 'page-errors';
  const collected = pageIssues.get(page);
  if (!collected) return trapResult(name, false, `the page-issue collectors were never armed — ${window} was not watched`);
  const { real, suppressed } = splitPageIssues(collected);
  const ignored = suppressed.length;
  // Name them, do not merely count them: a PASS row that says "1 entry ignored"
  // is exactly as unreadable as the red badge nobody explained.
  const reasons = Array.from(new Set(suppressed.map((i) => i.why)));
  const suffix = ignored > 0 ? ` (${ignored} suppressed: ${reasons.join(' | ')})` : '';
  if (real.length > 0) {
    const lines = real
      .slice(0, 8)
      .map((i) => `    [${i.kind}] ${i.url} — ${i.known ? `${i.known} :: ` : ''}${i.text.replace(/\s+/g, ' ').slice(0, 400)}`)
      .join('\n');
    return trapResult(
      name,
      false,
      `${real.length} browser error(s) during ${window}${suffix}:\n${lines}${real.length > 8 ? `\n    …and ${real.length - 8} more` : ''}`,
    );
  }
  return trapResult(name, true, `no uncaught exception and no console.error during ${window}${suffix}`);
}
