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
  return { traps: results, anchor: notEmpty.anchor, navProfile: nav.navProfile };
}
