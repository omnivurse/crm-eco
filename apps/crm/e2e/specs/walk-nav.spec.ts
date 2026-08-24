/**
 * EV-5 — navigation re-walk (NV-*): tab + sidebar inventory, one promise for
 * every search box (placeholder/aria parity), cross-tab sidebar links (D10
 * sticky tab), exactly one aria-current tab + link per hop, palette finds the
 * seeded member by phone / member # / name and a page by typing "task",
 * /crm/modules/deals + /crm/pipeline behaviour, and (NV-8/D10) the one mobile
 * module switcher: no tab strip, no bottom bar, the drawer grid flush under the
 * top bar — plus NV-hop-distance, the minimum number of moves from each of the
 * three origins (Dashboard, the Revenue tab, a record page) to each of the
 * eight persona destinations (the counting rule is documented at that row), and
 * NV-gated-dead-end, which follows the links a role-gated destination is still
 * offered from.
 *
 * Inventory facts land in walk.json `tasks[].notes`. `NV-cross-tab`,
 * `NV-hop-distance` and `NV-gated-dead-end` are HARD — a regression there turns
 * `playwright test` red on its own; the remaining soft rows describe later-wave
 * work.
 */
import { expect, test } from '../walk-fixture';
import { FIXTURE, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { SEARCH_ARIA_LABEL, SEARCH_PLACEHOLDER } from '../../src/lib/crm/search-copy';
import { TOP_TAB_HREFS, topModuleForPath } from '../nav-tabs';
import { isMobileProject, modKey, pathWithQuery } from '../walk-helpers';

const TAB = '[data-testid="crm-module-tab"]';
const SIDENAV = '[data-testid="crm-sidenav-item"]';

test.describe('navigation walk', () => {
  test('tabs + sidebar inventory, search-copy parity, cross-tab links, redirects', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    await assertTrapsInTest({ page, request, bareRequest, project });

    const activeTabKey = async () => page.locator(`${TAB}[aria-current="page"]:visible`).first().getAttribute('data-crm-module');
    const sidebarLinks = async () =>
      page.locator(`${SIDENAV}:visible`).evaluateAll((els) =>
        els.map((el) => ({
          key: el.getAttribute('data-nav-key') ?? '',
          href: el.getAttribute('href') ?? '',
          current: el.getAttribute('aria-current') === 'page',
        })),
      );

    // ── Inventory + one aria-current per hop ──────────────────────────────
    const perTab = new Map<string, Array<{ key: string; href: string }>>();
    await walk.task(
      'NV-inventory',
      'Tab count + sidebar links per tab; exactly one aria-current tab and one aria-current sidebar link after each hop',
      0,
      async () => {
        const problems: string[] = [];
        let tabCount: number | null = null;
        for (const tab of TOP_TAB_HREFS) {
          await page.goto(tab.href, { waitUntil: 'domcontentloaded' });
          if (mobile) {
            // NV-8 (D10): the strip is lg+ chrome. Settle on top-bar chrome that
            // exists at every width, then prove the strip is NOT painted here —
            // the phone's one switcher is the drawer grid (NV-8-mobile-switcher).
            await expect(page.getByTestId('crm-topbar-search-mobile')).toBeVisible({ timeout: 30_000 });
          } else {
            await expect(page.locator(TAB).first()).toBeVisible({ timeout: 30_000 });
          }
          tabCount = await page.locator(`${TAB}:visible`).count();
          const currentTabs = await page.locator(`${TAB}[aria-current="page"]:visible`).count();
          const links = mobile ? [] : await sidebarLinks();
          perTab.set(tab.key, links.map((l) => ({ key: l.key, href: l.href })));
          const currentLinks = links.filter((l) => l.current).length;
          walk.note(`links.${tab.key}`, mobile ? 'n/a (mobile sheet)' : links.length);
          walk.note(`ariaCurrent.${tab.key}`, `tab=${currentTabs}${mobile ? '' : ` link=${currentLinks}`}`);
          if (mobile) {
            if (tabCount !== 0) problems.push(`${tab.key}: ${tabCount} module tabs painted below lg (NV-8 wants 0)`);
          } else {
            if (currentTabs !== 1) problems.push(`${tab.key}: ${currentTabs} aria-current tabs`);
            if (currentLinks !== 1) problems.push(`${tab.key}: ${currentLinks} aria-current sidebar links`);
            if ((await activeTabKey()) !== tab.key) problems.push(`${tab.key}: active tab is ${await activeTabKey()}`);
          }
        }
        walk.note('tabCount', tabCount);
        expect(problems, problems.join('; ')).toEqual([]);
      },
      { soft: true },
    );

    // ── Search-copy parity (CrmTopBar pill · sidebar trigger · palette input) ─
    await page.goto('/crm', { waitUntil: 'domcontentloaded' });
    await walk.task(
      'NV-search-copy',
      'Top bar, sidebar trigger and palette carry the same search promise (placeholder + aria)',
      // Phone chrome has no ⌘K. NV-8's door is the search icon — one tap.
      mobile ? 1 : 0,
      async () => {
        const topBar = mobile ? page.getByTestId('crm-topbar-search-mobile') : page.getByTestId('crm-topbar-search');
        const topBarText = mobile ? await topBar.getAttribute('aria-label') : (await topBar.textContent())?.replace(/⌘K/, '').trim();
        walk.note('topBar', topBarText ?? null);
        let sidebarText: string | null = null;
        if (!mobile) {
          // ZohoContextualSidebar's SidebarSearchTrigger: a text pill when expanded,
          // an icon button (aria-label = SEARCH_PLACEHOLDER since NV-1) when collapsed. Never the top bar.
          const expanded = page.locator('button:visible:not([data-testid^="crm-topbar-search"])').filter({ hasText: /^\s*Search/ }).first();
          const collapsed = page.locator(`button:visible[aria-label="${SEARCH_PLACEHOLDER}"]:not([data-testid^="crm-topbar-search"])`).first();
          if ((await expanded.count()) > 0) sidebarText = (await expanded.textContent())?.replace(/⌘K/, '').trim() ?? null;
          else if ((await collapsed.count()) > 0) sidebarText = await collapsed.getAttribute('aria-label');
        }
        walk.note('sidebarTrigger', sidebarText);
        if (mobile) {
          await walk.click(topBar, 'open palette (search icon)');
        } else {
          await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
        }
        const input = page.getByTestId('crm-palette-input');
        await expect(input).toBeVisible();
        const placeholder = await input.getAttribute('placeholder');
        const aria = await input.getAttribute('aria-label');
        walk.note('palette.placeholder', placeholder);
        walk.note('palette.aria', aria);
        walk.note('expected.placeholder', SEARCH_PLACEHOLDER);
        walk.note('expected.aria', SEARCH_ARIA_LABEL);
        await walk.press('Escape', 'close palette');
        const surfaces = [topBarText ?? '', placeholder ?? '', ...(mobile ? [] : [sidebarText ?? ''])];
        expect(surfaces.every((s) => s === SEARCH_PLACEHOLDER), `search copy differs: ${JSON.stringify(surfaces)}`).toBe(true);
        expect(aria, 'palette aria-label must be the shared SEARCH_ARIA_LABEL').toBe(SEARCH_ARIA_LABEL);
      },
      { soft: true },
    );

    // ── Cross-tab sidebar links (D10: sticky tab → 0 swaps) ───────────────
    const crossTab: Array<{ tab: string; key: string; href: string }> = [];
    for (const [tab, links] of perTab) {
      for (const l of links) {
        const path = l.href.split('?')[0];
        if (path.startsWith('/crm') && topModuleForPath(path) !== tab) crossTab.push({ tab, key: l.key, href: l.href });
      }
    }
    await walk.task(
      'NV-cross-tab',
      `Clicking each cross-tab sidebar link (${crossTab.length}) must NOT swap the sidebar (D10 sticky tab) — 1 click each`,
      Math.max(crossTab.length, 0),
      async () => {
        if (mobile) {
          walk.note('skipped', 'sidebar lives in the mobile sheet');
          return;
        }
        let swaps = 0;
        for (const link of crossTab) {
          const tabHref = TOP_TAB_HREFS.find((t) => t.key === link.tab)!.href;
          await page.goto(tabHref, { waitUntil: 'domcontentloaded' });
          await expect(page.locator(TAB).first()).toBeVisible({ timeout: 30_000 });
          const beforeKeys = (await sidebarLinks()).map((l) => l.key).join(',');
          const el = page.locator(`${SIDENAV}[data-nav-key="${link.key}"]:visible`).first();
          if ((await el.count()) === 0) {
            walk.note(`crossTab.${link.tab}.${link.key}`, 'link not visible');
            continue;
          }
          await walk.click(el, `${link.tab} › ${link.key}`);
          // ModuleContext resolves the tab in an effect after the client
          // transition (D10 sticky: the tab STAYS when the clicked link is active
          // for the new location, else the URL decides). Reading the sidebar
          // before that effect runs would record the OLD sidebar as "not
          // swapped" even when it is about to swap. Settle on the URL, then on
          // evidence the hop committed — the clicked link carries aria-current
          // (sticky) OR the tab became what the path resolver predicts (swap) —
          // then a short grace so a late swap cannot hide, then read.
          const linkPath = link.href.split('?')[0];
          const byPathTab = topModuleForPath(linkPath);
          await page.waitForURL((u) => u.pathname === linkPath, { timeout: 30_000 }).catch(() => undefined);
          await expect(page.locator(TAB).first()).toBeVisible({ timeout: 30_000 });
          const clickedCurrent = page.locator(`${SIDENAV}[data-nav-key="${link.key}"][aria-current="page"]:visible`);
          await expect
            .poll(async () => (await activeTabKey()) === byPathTab || (await clickedCurrent.count()) > 0, {
              timeout: 15_000,
              message: `hop after ${link.href} did not commit`,
            })
            .toBe(true)
            .catch(() => undefined);
          await page.waitForTimeout(400);
          const afterTab = await activeTabKey();
          const afterKeys = (await sidebarLinks()).map((l) => l.key).join(',');
          const swapped = afterKeys !== beforeKeys;
          if (swapped) swaps += 1;
          // A hop the app redirects (e.g. a permission bounce to /crm?error=…)
          // cannot stay sticky — the note keeps the landed path so the verdict
          // can be read as "link shown to a role it refuses" rather than D10.
          const landed = pathWithQuery(page);
          const redirected = landed.split('?')[0] !== linkPath;
          walk.note(`crossTab.${link.tab}.${link.key}`, `${link.href} → tab=${afterTab} swapped=${swapped}${redirected ? ` redirected=${landed}` : ''}`);
        }
        walk.note('crossTabLinks', crossTab.length);
        walk.note('sidebarSwaps', swaps);
        expect(swaps, `${swaps}/${crossTab.length} cross-tab links swapped the sidebar (want 0)`).toBe(0);
      },
      // HARD (wave 4): D10 sticky-tab holds for every cross-tab link on every
      // project and role. `walk:crm:gate` already failed on a red soft row, but
      // a bare `playwright test` would have stayed green on a regression.
    );

    // ── Palette: phone / member # / name / a page ─────────────────────────
    await page.goto('/crm', { waitUntil: 'domcontentloaded' });
    await walk.task(
      'NV-palette',
      'Palette finds the seeded member by phone, member # and name, and a page by typing "task"',
      0,
      async () => {
        await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
        const input = page.getByTestId('crm-palette-input');
        await expect(input).toBeVisible();
        const dialog = page.getByRole('dialog');
        const wendy = dialog.getByTestId('crm-palette-result').filter({ hasText: /Wendy\s+Walker/i }).first();
        const queries: Array<[string, string]> = [
          ['phone', FIXTURE.anchor.phone],
          ['memberNumber', FIXTURE.anchor.memberNumber],
          ['name', `${FIXTURE.anchor.firstName} ${FIXTURE.anchor.lastName}`],
        ];
        const misses: string[] = [];
        for (const [kind, q] of queries) {
          await walk.type(input, q, `type ${kind}`);
          try {
            await expect(wendy).toBeVisible({ timeout: 15_000 });
            walk.note(`finds.${kind}`, true);
          } catch {
            walk.note(`finds.${kind}`, false);
            misses.push(kind);
          }
        }
        await walk.type(input, 'task', 'type "task"');
        const pageHit = dialog.getByTestId('crm-palette-result').filter({ hasText: /task/i }).first();
        try {
          await expect(pageHit).toBeVisible({ timeout: 15_000 });
          walk.note('finds.page', (await pageHit.textContent())?.replace(/\s+/g, ' ').trim() ?? true);
        } catch {
          walk.note('finds.page', false);
          misses.push('page');
        }
        await walk.press('Escape', 'close palette');
        expect(misses, `palette misses: ${misses.join(', ')}`).toEqual([]);
      },
      { soft: true },
    );

    // ── /crm/modules/deals and /crm/pipeline ──────────────────────────────
    await walk.task(
      'NV-redirects',
      '/crm/modules/deals redirects to the enabled sibling; /crm/pipeline is gone for a deals-disabled org (D10)',
      0,
      async () => {
        await page.goto('/crm/modules/deals', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => undefined);
        const dealsLanded = pathWithQuery(page);
        walk.note('deals.landed', dealsLanded);
        await page.goto('/crm/pipeline', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => undefined);
        const pipelineLanded = pathWithQuery(page);
        walk.note('pipeline.landed', pipelineLanded);
        walk.note('pipeline.h1', (await page.locator('h1').first().textContent().catch(() => null))?.trim() ?? null);
        await page.goto('/crm', { waitUntil: 'domcontentloaded' });
        const pipelineLink = mobile ? -1 : await page.locator(`${SIDENAV}[data-nav-key="pipeline"]:visible`).count();
        walk.note('pipeline.sidebarLink', pipelineLink);
        expect(dealsLanded, '/crm/modules/deals must not dead-end on the disabled module').toMatch(/\/crm\/modules\/(?!deals)/);
        expect(pipelineLanded, '/crm/pipeline must redirect when deals is disabled').not.toMatch(/^\/crm\/pipeline/);
        if (!mobile) expect(pipelineLink, 'no Pipeline sidebar link for a deals-disabled org').toBe(0);
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// NV-4 — ⌘K "View all results" lands on /crm/search with the same member.
// NV-7 — record pages highlight their module's sidebar link (aria-current).
// ---------------------------------------------------------------------------
test.describe('search parity + record sidebar state', () => {
  test('NV-4 View all results; NV-7 record-page aria-current', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();

    await page.goto('/crm', { waitUntil: 'domcontentloaded' });
    await walk.task(
      'NV-4-view-all',
      "⌘K phone → 'View all results' → /crm/search lists the same member",
      mobile ? 2 : 1,
      async () => {
        if (mobile) {
          await walk.click(page.getByTestId('crm-topbar-search-mobile'), 'open search');
        } else {
          await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
        }
        const input = page.getByTestId('crm-palette-input');
        await expect(input).toBeVisible();
        await walk.type(input, FIXTURE.anchor.phone, 'type phone digits');
        const viewAll = page.getByRole('dialog').getByText(/View all results/).first();
        await expect(viewAll, "the palette must offer 'View all results'").toBeVisible({ timeout: 15_000 });
        await walk.click(viewAll, 'View all results');
        await expect(page).toHaveURL(/\/crm\/search\?q=/);
        const hit = page
          .getByTestId('crm-search-result')
          .filter({ hasText: new RegExp(`${FIXTURE.anchor.firstName}\\s+${FIXTURE.anchor.lastName}`, 'i') })
          .first();
        await expect(hit, '/crm/search must list the member the palette found').toBeVisible({ timeout: 30_000 });
        walk.note('url', pathWithQuery(page));
      },
      { soft: true },
    );

    await walk.task(
      'NV-7-record-aria-current',
      "Open records highlight their module's sidebar link (contacts anchor + members twin)",
      // Below lg the sidebar lives in the menu sheet: one tap per record to read it.
      mobile ? 2 : 0,
      async () => {
        // The sheet is `inert` while closed, so its links are never `:visible`
        // until it is opened — open it and read the SAME aria-current contract
        // the docked rail carries, so mobile is evidence, not a skip.
        const openSheet = async (label: string) => {
          if (!mobile) return;
          await walk.click(page.getByRole('button', { name: 'Open menu' }), label);
        };
        walk.note('sidebarSurface', mobile ? 'mobile menu sheet' : 'docked sidebar');
        await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
        await openSheet('Open menu (contacts record)');
        const contactsLink = page.locator(`${SIDENAV}[data-nav-key="module-contacts"][aria-current="page"]:visible`);
        await expect(contactsLink, 'contacts record must light the Contacts link').toBeVisible({ timeout: 30_000 });
        walk.note('contactsCurrent', true);
        const currentCount = await page.locator(`${SIDENAV}[aria-current="page"]:visible`).count();
        walk.note('ariaCurrentLinks', currentCount);
        expect(currentCount, 'exactly one aria-current sidebar link').toBe(1);

        // The members twin (same phone, members module) must light Members.
        const res = await request.get(`/api/crm/search?q=${encodeURIComponent(FIXTURE.anchor.memberNumber)}&limit=10`);
        const body = (await res.json()) as { results?: Array<{ id: string; moduleKey: string; url: string }> };
        const twin = (body.results ?? []).find((r) => r.moduleKey === 'members');
        walk.note('membersTwinFound', Boolean(twin));
        if (twin) {
          await page.goto(twin.url, { waitUntil: 'domcontentloaded' });
          await openSheet('Open menu (members record)');
          const membersLink = page.locator(`${SIDENAV}[data-nav-key="module-members"][aria-current="page"]:visible`);
          await expect(membersLink, 'members record must light the Members link').toBeVisible({ timeout: 30_000 });
          walk.note('membersCurrent', true);
        }
      },
      { soft: true },
    );
  });
});


// ---------------------------------------------------------------------------
// NV-8 (D10) — one module switcher on a phone: the 7-tab strip and the bottom
// action bar are lg+ chrome, the nav drawer opens flush under the top bar with
// the module grid (exactly one aria-current), the search icon opens the palette
// and "+" opens Add Member.
// ---------------------------------------------------------------------------
test.describe('mobile module switcher (NV-8)', () => {
  test('no tab strip / bottom bar; drawer grid, search and create', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(!isMobileProject(project), 'NV-8 is the below-lg chrome contract');
    await assertTrapsInTest({ page, request, bareRequest, project });
    await page.goto('/crm', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('crm-topbar-search-mobile')).toBeVisible({ timeout: 30_000 });

    await walk.task(
      'NV-8-mobile-switcher',
      'Phone: no tab strip, no bottom bar; menu (1 tap) → drawer flush under the top bar with the module grid, one aria-current; search icon → palette; + → Add Member',
      3,
      async () => {
        // ── Desktop chrome must not be painted here ──
        const strips = await page.locator('[data-testid="crm-module-tabbar"]:visible').count();
        const bars = await page.locator('[data-testid="crm-bottom-bar"]:visible').count();
        walk.note('tabStripsVisible', strips);
        walk.note('bottomBarsVisible', bars);
        expect(strips, 'no module tab strip below lg').toBe(0);
        expect(bars, 'no bottom action bar below lg').toBe(0);

        // ── One tap to the switcher, flush under the top bar ──
        await walk.click(page.getByRole('button', { name: 'Open menu' }), 'Open menu');
        const drawer = page.getByTestId('crm-mobile-nav-drawer');
        await expect(drawer).toBeVisible();
        // The top bar is the <header> that owns the mobile search icon — not
        // whatever <header> a page body happens to render first.
        const headerBottom = await page
          .getByTestId('crm-topbar-search-mobile')
          .evaluate((el) => {
            const header = el.closest('header');
            if (!header) return null;
            const r = header.getBoundingClientRect();
            return r.y + r.height;
          });
        const drawerBox = await drawer.boundingBox();
        const gap = headerBottom !== null && drawerBox ? Math.round(drawerBox.y - headerBottom) : null;
        walk.note('drawerTopGapPx', gap);
        expect(gap, 'drawer starts flush under the top bar (no tab-strip offset)').toBe(0);

        const gridLinks = drawer.locator('a[data-crm-module]');
        walk.note('moduleGridLinks', await gridLinks.count());
        expect(await gridLinks.count(), 'the drawer grid is the mobile switcher').toBeGreaterThan(1);
        const current = drawer.locator('a[data-crm-module][aria-current="page"]');
        walk.note('ariaCurrentModules', await current.count());
        expect(await current.count(), 'exactly one aria-current module link').toBe(1);
        await walk.shot('mobile nav drawer');

        // ── Search icon → palette (navigate to close the drawer: 0 taps) ──
        await page.goto('/crm', { waitUntil: 'domcontentloaded' });
        await walk.click(page.getByTestId('crm-topbar-search-mobile'), 'search icon');
        await expect(page.getByTestId('crm-palette-input')).toBeVisible();
        walk.note('searchOpensPalette', true);
        await walk.press('Escape', 'close palette');

        // ── "+" → Add Member (crm_viewer has no create affordance, DE-M1) ──
        if (walkRole() === 'viewer') {
          walk.note('createAffordance', 'n/a (viewer)');
          return;
        }
        await walk.click(page.getByTestId('crm-create-primary-mobile'), '+ Add Member');
        await expect(page.getByTestId('crm-qc-form')).toBeVisible({ timeout: 30_000 });
        walk.note('plusOpensAddMember', true);
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// NV-hop-distance — the FIRST clause of the plan's `what_ten_means` for
// Navigation: "every persona destination ≤2 moves from Dashboard, Revenue tab
// and a record page". `NV-inventory` counts links and `aria-current`; nothing
// counted DISTANCE, which is the reason the 2026-08-23 regrade held Navigation
// at 9.5. This row measures it.
//
// COUNTING RULE — one rule, applied identically to every route, and written
// into walk.json as `countingRule` so a grader can re-derive every number:
//   1. A MOVE is one counted user action that carries the user forward: one
//      `walk.click` or one `walk.press`. Nothing else is a move.
//   2. TYPING IS NOT A MOVE. `walk.type` records characters, never keypresses
//      (walk-fixture.ts) — narrowing a list is not travelling. The command
//      palette therefore costs exactly 2 however it is driven: open (⌘K press
//      on lg+, the mobile search-icon click below lg) + commit (click the row,
//      or press Enter on the armed row). This row drives the click form; the
//      typed form (open + type + Enter) is the same 2 by rule 2.
//   3. Sitting at the ORIGIN is not a move: every measurement starts from an
//      uncounted `goto` (see `goOrigin`, which may reload when `next dev`
//      serves a shell-less first paint), modelling a user already there.
//   4. A pair scores the MINIMUM over the routes below, tried cheapest-first —
//      every 1-move route is attempted before any 2-move route, so a recorded
//      2 means no 1-move route exists at that origin.
//   5. A route counts only when it ARRIVES. The SETTLED location (after
//      `networkidle`, so a gate that redirects after first paint cannot be
//      scored as an arrival) must be the destination's own path, or the path
//      that destination canonically redirects to — `/crm/tasks` is a one-line
//      `redirect('/crm/activities?type=task')` (app/crm/tasks/page.tsx), and
//      following a redirect is part of the move that started it, not a second
//      move. Each canonical landing is probed once with an uncounted `goto`, so
//      this is the app's own answer, not an assumption. A permission bounce is
//      never an arrival.
// Routes: `sidebar` (1) · `palette` (2) · `tab+sidebar` (2, lg+) ·
//         `menu+sidebar` (2, below lg, where the rail lives in the menu sheet).
//
// ROLE-DEPENDENCE (the trap earlier waves hit): the sidebar link set is
// role-dependent. This row runs as the operator (crm_agent) by default.
// `/crm/import` is the one persona destination behind a role gate
// (`managerOrAdmin` on CRM_NAV_ITEMS.import — the same predicate
// app/crm/import/page.tsx uses). For crm_agent / crm_viewer it is therefore
// NOT a destination of theirs: it is excluded from the ≤2 distance verdict,
// recorded `n/a`, and its distance is measured under WALK_ROLE=admin, where it
// is a normal 1-move sidebar hop. Every other destination is identical for all
// three roles.
//
// Whether the shell nevertheless OFFERS a gated destination is a different
// question, and it is the last clause of the same `what_ten_means` ("crm_agent
// sees no admin-only dead ends"), so it gets its own row: NV-gated-dead-end,
// at the end of this file. It is RED — see its diagnosis and file:line.
// ---------------------------------------------------------------------------

/**
 * The idle persona set (D10) with the label the sidebar and the palette render
 * for each ("Go to <label>"). Mirror of `PERSONA_IDLE_PAGE_HREFS`
 * (apps/crm/src/lib/crm/palette-pages.ts:115) — not imported, because
 * palette-pages pulls in `@/contexts/ModuleContext` and the e2e tsconfig has
 * neither the `@/` alias nor JSX (the same reason `nav-tabs.ts` is a mirror).
 * The first palette open asserts this list against the app's own idle rows, so
 * the mirror cannot drift silently.
 */
const PERSONA_DESTINATIONS: ReadonlyArray<{ key: string; label: string; href: string }> = [
  { key: 'members', label: 'Members', href: '/crm/modules/members' },
  { key: 'member-roster', label: 'Member Roster', href: '/crm/members' },
  { key: 'tasks', label: 'Tasks', href: '/crm/tasks' },
  { key: 'calendar', label: 'Calendar', href: '/crm/calendar' },
  { key: 'inbox', label: 'Inbox', href: '/crm/inbox' },
  { key: 'reports', label: 'Reports', href: '/crm/reports' },
  { key: 'workqueue', label: 'Workqueue', href: '/crm/workqueue' },
  { key: 'import', label: 'Import Data', href: '/crm/import' },
];

const HOP_COUNTING_RULE =
  'move = one walk.click or one walk.press that carries the user forward; typing is not a move ' +
  '(palette = open + commit = 2 either way); arriving at the origin is uncounted setup; ' +
  'a pair scores the minimum over routes tried cheapest-first (1-move routes before 2-move ones); ' +
  'a route counts only when it ARRIVES — the settled location must be the destination path or the path that ' +
  'destination canonically redirects to (probed once with an uncounted goto), because following a redirect is ' +
  'part of the move that started it, not a second move; a permission bounce is never an arrival.';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type HopAttempt = { cost: number; route: string; ok: boolean; detail: string };

test.describe('persona hop distance (NV-hop-distance)', () => {
  test('every persona destination is ≤2 moves from Dashboard, the Revenue tab and a record page', async ({
    page,
    request,
    bareRequest,
    walk,
  }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    // 24 measured pairs, each an uncounted navigation plus up to two
    // screenshotted moves. The 120 s default is a harness limit, not a product
    // budget — the product budget is the per-pair `<= 2` assertion below.
    test.setTimeout(900_000);
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();

    const role = walkRole();
    // `/crm/import` is `managerOrAdmin`; the fixture's only such role is admin.
    const importReachable = role === 'admin';
    const isAvailable = (key: string) => key !== 'import' || importReachable;

    const origins: ReadonlyArray<{ key: string; path: string }> = [
      { key: 'dashboard', path: '/crm' },
      { key: 'revenue', path: '/crm/revenue' },
      { key: 'record', path: anchor!.url },
    ];

    const destPath = (href: string) => href.split('?')[0];
    /** Never `.first()`: both breakpoint twins are in the DOM, one display:none. */
    const sidebarLinkFor = (href: string) => page.locator(`${SIDENAV}[href="${href}"]`).locator('visible=true');
    // Waiting for the shell to paint after an uncounted `goto`. The generous
    // timeout is for `next dev` compiling a route the first time, not a product
    // budget — nothing here is graded.
    const SHELL_TIMEOUT_MS = 25_000;
    const settleShell = async (timeout = SHELL_TIMEOUT_MS) => {
      if (mobile) {
        await expect(page.getByTestId('crm-topbar-search-mobile')).toBeVisible({ timeout });
      } else {
        await expect
          .poll(async () => page.locator(SIDENAV).locator('visible=true').count(), { timeout })
          .toBeGreaterThan(0);
      }
    };
    /**
     * Put the browser at an origin. UNCOUNTED setup — no move is spent here, so
     * a reload when `next dev` serves a shell-less first paint is free and is
     * not a retry of anything graded. Three attempts, then the failure stands.
     */
    const goOrigin = async (path: string) => {
      for (let attempt = 1; ; attempt += 1) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        try {
          await settleShell();
          return;
        } catch (err) {
          if (attempt >= 3) throw err;
        }
      }
    };
    /**
     * Where each destination actually OPENS. Some persona links are canonical
     * redirects — `/crm/tasks` is a one-line `redirect('/crm/activities?type=task')`
     * (app/crm/tasks/page.tsx) — and following a redirect is part of the one
     * move that started it, not a second move. Probed once per destination with
     * an UNCOUNTED `goto`, so the arrival test is the app's own answer to "what
     * does this link open?" rather than an assumption. Role-gated destinations
     * are deliberately left out: for them the strict path is the whole point.
     */
    const canonical = new Map<string, string>();

    const arrived = async (dest: (typeof PERSONA_DESTINATIONS)[number]) => {
      const want = destPath(dest.href);
      const targets = new Set([want, canonical.get(dest.key) ?? want]);
      try {
        await page.waitForURL((u) => targets.has(u.pathname), { timeout: 30_000 });
      } catch {
        return false;
      }
      // A permission gate that redirects from inside a Suspense boundary lands
      // AFTER first paint (walk-roles.spec.ts PERM-viewer-gated-link records the
      // same trap), so the destination pathname is true for a beat and then
      // gone. Settle, then read again: a bounce must never be scored as a hop.
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return targets.has(new URL(page.url()).pathname);
    };

    let paletteAudited = false;

    await walk.task(
      'NV-hop-distance',
      `Minimum moves from each origin (Dashboard, Revenue tab, record page) to each persona destination (${PERSONA_DESTINATIONS.length}) — every pair must be ≤ 2`,
      // Ceiling implied by the contract itself: 3 origins × 8 destinations × 2
      // moves, counted in CLICKS. On lg+ the palette's open is a keypress, so
      // the click total sits below the ceiling; below lg both moves are clicks
      // and a full 24-pair matrix lands exactly on it. Nothing here is a
      // per-task UX budget — the graded assertion is the per-pair `<= 2`.
      origins.length * PERSONA_DESTINATIONS.length * 2,
      async () => {
        walk.note('countingRule', HOP_COUNTING_RULE);
        walk.note('role', role);
        walk.note('sidebarSurface', mobile ? 'menu sheet (below lg) — no 1-move sidebar route exists' : 'docked rail');
        walk.note('origins', origins.map((o) => `${o.key}=${o.path}`).join(' | '));
        walk.note('destinations', PERSONA_DESTINATIONS.map((d) => `${d.key}=${d.href}`).join(' | '));
        walk.note(
          'roleGated',
          importReachable
            ? 'none (crm_admin may use Import Data)'
            : 'import (/crm/import is managerOrAdmin — excluded from the ≤2 verdict for this role; whether the shell still offers a link to it is measured below)',
        );

        // ── canonical landings (uncounted setup, not moves) ───────────────
        for (const dest of PERSONA_DESTINATIONS) {
          if (!isAvailable(dest.key)) continue;
          await page.goto(dest.href, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle').catch(() => undefined);
          canonical.set(dest.key, new URL(page.url()).pathname);
          walk.note(`canonical.${dest.key}`, `${dest.href} opens ${pathWithQuery(page)}`);
        }

        // ── routes, cheapest first ────────────────────────────────────────
        const routeSidebar = async (dest: (typeof PERSONA_DESTINATIONS)[number], originKey: string): Promise<HopAttempt | null> => {
          // The docked rail is lg+ chrome. Below lg the ONLY sidebar is the nav
          // sheet, and while it is closed it is rendered OFF-CANVAS (translated
          // out of the viewport) rather than `display:none` — so CSS, and
          // Playwright's `visible=true`, still call its links visible. An
          // earlier version of this row matched one and burned 20 s on
          // "element is outside of the viewport". A link the user cannot see is
          // not a 1-move route; below lg the sheet costs its own move and is
          // measured by `routeMenuSidebar`.
          if (mobile) return null;
          const link = sidebarLinkFor(dest.href);
          const n = await link.count();
          if (n === 0) return null; // no 1-move route here — 0 actions spent
          if (n > 1) throw new Error(`NV-hop-distance: ${n} visible sidebar links for ${dest.href} — ambiguous selector`);
          await walk.click(link, `${originKey} › sidebar ${dest.label}`);
          const ok = await arrived(dest);
          return { cost: 1, route: 'sidebar link', ok, detail: pathWithQuery(page) };
        };

        const routePalette = async (dest: (typeof PERSONA_DESTINATIONS)[number], originKey: string): Promise<HopAttempt> => {
          if (mobile) {
            await walk.click(page.getByTestId('crm-topbar-search-mobile'), `${originKey} › open search`);
          } else {
            await walk.press(`${modKey()}+k`, `${originKey} › open palette (⌘K)`);
          }
          const input = page.getByTestId('crm-palette-input');
          await expect(input).toBeVisible({ timeout: 15_000 });
          const dialog = page.getByRole('dialog');
          const results = dialog.getByTestId('crm-palette-result');
          // Match the row's LABEL element, not the button's raw textContent: the
          // button also carries the tab/section description, and its textContent
          // is not whitespace-normalised, so an anchored `hasText` on the button
          // matches nothing. `<p>{cmd.label}</p>` (CommandPalette.tsx:897) is the
          // label, and an exact match keeps "Members" off "Member Roster".
          const rowFor = (label: string) =>
            results.filter({ has: page.locator('p', { hasText: new RegExp(`^${escapeRe(`Go to ${label}`)}$`) }) });

          if (!paletteAudited) {
            // The idle palette (no query typed) is the D10 persona set. Audit
            // it once, for free, while it is open: it pins the mirror above to
            // the app AND proves a role-gated destination has no hidden route.
            paletteAudited = true;
            const labels = await results.evaluateAll((els) =>
              els.map((el) => (el.querySelector('p')?.textContent ?? '').replace(/\s+/g, ' ').trim()),
            );
            walk.note('paletteIdleRows', labels.join(' | ') || '(none)');
            const missing: string[] = [];
            const leaked: string[] = [];
            for (const d of PERSONA_DESTINATIONS) {
              const present = (await rowFor(d.label).count()) > 0;
              if (isAvailable(d.key) && !present) missing.push(d.key);
              if (!isAvailable(d.key) && present) leaked.push(d.key);
            }
            walk.note('paletteIdleMissing', missing.join(',') || 'none');
            walk.note('paletteIdleLeaked', leaked.join(',') || 'none');
            expect(missing, `the idle palette must offer every persona destination this role has: ${missing.join(', ')}`).toEqual([]);
            expect(leaked, `a role-gated destination must not appear in the palette: ${leaked.join(', ')}`).toEqual([]);
          }

          const row = rowFor(dest.label);
          const n = await row.count();
          if (n !== 1) return { cost: 2, route: 'palette', ok: false, detail: `${n} idle palette rows named "Go to ${dest.label}"` };
          await walk.click(row, `${originKey} › palette ${dest.label}`);
          const ok = await arrived(dest);
          return { cost: 2, route: 'palette (open + row)', ok, detail: pathWithQuery(page) };
        };

        const routeTabSidebar = async (dest: (typeof PERSONA_DESTINATIONS)[number], originKey: string): Promise<HopAttempt | null> => {
          if (mobile) return null; // no tab strip below lg (NV-8 / D10)
          const tabKey = topModuleForPath(destPath(dest.href));
          const tab = page.locator(`${TAB}[data-crm-module="${tabKey}"]`).locator('visible=true');
          if ((await tab.count()) !== 1) return null;
          await walk.click(tab, `${originKey} › ${tabKey} tab`);
          await settleShell();
          await expect
            .poll(async () => sidebarLinkFor(dest.href).count(), { timeout: 15_000 })
            .toBe(1)
            .catch(() => undefined);
          const link = sidebarLinkFor(dest.href);
          if ((await link.count()) !== 1) return { cost: 2, route: 'tab+sidebar', ok: false, detail: `no sidebar link for ${dest.href} under the ${tabKey} tab` };
          await walk.click(link, `${originKey} › sidebar ${dest.label}`);
          const ok = await arrived(dest);
          return { cost: 2, route: `${tabKey} tab + sidebar link`, ok, detail: pathWithQuery(page) };
        };

        const routeMenuSidebar = async (dest: (typeof PERSONA_DESTINATIONS)[number], originKey: string): Promise<HopAttempt | null> => {
          if (!mobile) return null;
          await walk.click(page.getByRole('button', { name: 'Open menu' }), `${originKey} › Open menu`);
          await expect(page.getByTestId('crm-mobile-nav-drawer')).toBeVisible({ timeout: 15_000 });
          const link = sidebarLinkFor(dest.href);
          if ((await link.count()) !== 1) return { cost: 2, route: 'menu+sidebar', ok: false, detail: `the sheet has no link for ${dest.href}` };
          await walk.click(link, `${originKey} › sheet ${dest.label}`);
          const ok = await arrived(dest);
          return { cost: 2, route: 'menu sheet + sidebar link', ok, detail: pathWithQuery(page) };
        };

        // ── the matrix ────────────────────────────────────────────────────
        const overBudget: string[] = [];
        let maxMoves = 0;
        let measured = 0;
        let skipped = 0;

        for (const origin of origins) {
          for (const dest of PERSONA_DESTINATIONS) {
            const cell = `hop.${origin.key}.${dest.key}`;
            if (!isAvailable(dest.key)) {
              // NOT a destination for this persona, so it is excluded from the
              // ≤2 distance verdict. Whether the shell nevertheless offers this
              // role a route to it is a different question with a different
              // answer — it gets its own row, NV-gated-dead-end, below.
              skipped += 1;
              walk.note(cell, `n/a for ${role} — ${dest.href} is managerOrAdmin-gated (the shell's offer is graded by NV-gated-dead-end)`);
              continue;
            }
            measured += 1;

            const attempts: HopAttempt[] = [];
            let moves: number | null = null;
            let winner = '';
            // Cheapest first. Below lg there is NO 1-move route: the docked rail
            // is lg+ chrome and the nav sheet costs its own move to open.
            for (const route of mobile ? [routePalette, routeMenuSidebar] : [routeSidebar, routePalette, routeTabSidebar]) {
              await goOrigin(origin.path);
              const attempt = await route(dest, origin.key);
              if (!attempt) continue; // route does not exist here; nothing spent
              attempts.push(attempt);
              if (attempt.ok) {
                moves = attempt.cost;
                winner = attempt.route;
                break;
              }
            }

            if (moves === null) {
              const tried = attempts.map((a) => `${a.route}(${a.cost}) → ${a.detail}`).join(' ; ') || 'no route existed';
              walk.note(cell, `NO ROUTE ≤2 — tried: ${tried}`);
              overBudget.push(`${origin.key} → ${dest.key}: no route of 2 moves or fewer (tried ${tried})`);
              continue;
            }
            maxMoves = Math.max(maxMoves, moves);
            const rejected = attempts.filter((a) => !a.ok).map((a) => `${a.route}(${a.cost}) failed`);
            walk.note(
              cell,
              `${moves} move${moves === 1 ? '' : 's'} · ${winner} · landed ${pathWithQuery(page)}${rejected.length ? ` · rejected: ${rejected.join(', ')}` : ''}`,
            );
            if (moves > 2) overBudget.push(`${origin.key} → ${dest.key}: ${moves} moves via ${winner}`);
          }
        }

        walk.note('pairsMeasured', measured);
        walk.note('pairsRoleGated', skipped);
        walk.note('maxMoves', maxMoves);
        walk.note('over2Moves', overBudget.length);
        expect(measured, 'the matrix must measure at least one pair per origin').toBeGreaterThanOrEqual(origins.length);
        // THE DISTANCE VERDICT — the plan's `what_ten_means` first clause.
        expect(overBudget, `persona destinations further than 2 moves: ${overBudget.join(' | ')}`).toEqual([]);
      },
      // HARD: this is the Navigation "what ten means" clause. A destination
      // that drifts to 3 moves must turn `playwright test` red on its own.
    );

    // ── NV-gated-dead-end ─────────────────────────────────────────────────
    // The LAST clause of the same `what_ten_means`: "crm_agent sees no
    // admin-only dead ends". `NV-inventory` counts sidebar links; it never
    // follows one, so a link that is shown and then refused has always read as
    // a link. This row follows them.
    //
    // For every origin, and every persona destination this role may NOT use, it
    // asks: does the shell still offer a link? and if so, where does clicking it
    // land? An offered link that bounces is an admin-only dead end.
    const gatedDestinations = PERSONA_DESTINATIONS.filter((d) => !isAvailable(d.key));
    await walk.task(
      'NV-gated-dead-end',
      `Role-gated persona destinations (${gatedDestinations.length}) must not be linked from any of the ${origins.length} origins for ${role} — 1 click each to prove where an offered link lands`,
      origins.length * gatedDestinations.length,
      async () => {
        walk.note('role', role);
        walk.note(
          'gatedDestinations',
          gatedDestinations.map((d) => `${d.key}=${d.href}`).join(' | ') ||
            'none — every persona destination is usable by this role',
        );
        if (mobile) {
          // Below lg the rail lives in the closed, `inert` menu sheet, so no
          // sidebar link is offered on this surface at all. Say so rather than
          // recording a hollow pass.
          walk.note('surface', 'below lg the sidebar is inside the closed menu sheet — no docked link is offered here');
        }
        /** Role-gated destinations the shell STILL offers this role a link to. */
        const offers: string[] = [];
        for (const origin of origins) {
          for (const dest of gatedDestinations) {
            await goOrigin(origin.path);
            const link = sidebarLinkFor(dest.href);
            const count = mobile ? 0 : await link.count();
            let detail = `sidebarLinks=${count}`;
            if (count === 1) {
              await walk.click(link, `${origin.key} › gated sidebar ${dest.label}`);
              const reached = await arrived(dest);
              const landed = pathWithQuery(page);
              detail += ` · clicking it landed ${landed} (${reached ? 'ARRIVED — the page gate leaked' : 'bounced'})`;
              offers.push(`${origin.key} → ${dest.key}: sidebar link → ${landed}`);
            }
            walk.note(`gated.${origin.key}.${dest.key}`, detail);
          }
        }
        walk.note('deadEndLinks', offers.length);
        walk.note('deadEndDetail', offers.join(' | ') || 'none');
        // FOUND BY THIS ROW — product defect, deliberately NOT fixed here.
        // The CRM tab is the ONE tab whose sidebar is never role-gated:
        // ZohoContextualSidebar.tsx:338 returns `buildFullCrmNav(CRM_NAV_ITEMS,
        // navModules)` with no `visibleNavItemsForRole(..., crmRole)` wrapper,
        // unlike :333 (settings) and :340 (every other tab). So a crm_agent /
        // crm_viewer is offered "Import Data" → /crm/import, which
        // app/crm/import/page.tsx:30-31 bounces to
        // /crm?error=no_import_permission. D10 decided to gate exactly this and
        // CRM_NAV_ITEMS.import already carries `managerOrAdmin`; the palette
        // honours it (palette-pages.ts:65, and `paletteIdleLeaked = none`
        // above), the Revenue/Operations tabs honour it — the CRM sidebar does
        // not. Fixing it is a one-line change in product code this wave does
        // not own.
        expect(
          offers,
          `${role} is offered a sidebar link the page refuses (admin-only dead end) — D10 gating missing at ` +
            `src/components/crm/shell/ZohoContextualSidebar.tsx:338 (buildFullCrmNav without visibleNavItemsForRole): ${offers.join(' | ')}`,
        ).toEqual([]);
      },
      // HARD: "crm_agent sees no admin-only dead ends" is a `what_ten_means`
      // clause. It is RED today, and that is the finding.
    );
  });
});
