/**
 * EV-5 — navigation re-walk (NV-*): tab + sidebar inventory, one promise for
 * every search box (placeholder/aria parity), cross-tab sidebar links (D10
 * sticky tab), exactly one aria-current tab + link per hop, palette finds the
 * seeded member by phone / member # / name and a page by typing "task",
 * /crm/modules/deals + /crm/pipeline behaviour.
 *
 * Inventory facts land in walk.json `tasks[].notes`; parity/sticky assertions
 * are soft (they describe Wave-2 work and WILL fail today).
 */
import { expect, test } from '../walk-fixture';
import { FIXTURE } from '../env';
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

    const activeTabKey = async () => page.locator(`${TAB}[aria-current="page"]`).first().getAttribute('data-crm-module');
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
          await expect(page.locator(TAB).first()).toBeVisible({ timeout: 30_000 });
          tabCount = await page.locator(TAB).count();
          const currentTabs = await page.locator(`${TAB}[aria-current="page"]`).count();
          const links = mobile ? [] : await sidebarLinks();
          perTab.set(tab.key, links.map((l) => ({ key: l.key, href: l.href })));
          const currentLinks = links.filter((l) => l.current).length;
          walk.note(`links.${tab.key}`, mobile ? 'n/a (mobile sheet)' : links.length);
          walk.note(`ariaCurrent.${tab.key}`, `tab=${currentTabs}${mobile ? '' : ` link=${currentLinks}`}`);
          if (currentTabs !== 1) problems.push(`${tab.key}: ${currentTabs} aria-current tabs`);
          if (!mobile && currentLinks !== 1) problems.push(`${tab.key}: ${currentLinks} aria-current sidebar links`);
          if ((await activeTabKey()) !== tab.key) problems.push(`${tab.key}: active tab is ${await activeTabKey()}`);
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
      0,
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
        await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
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
      { soft: true },
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
      0,
      async () => {
        if (mobile) {
          walk.note('skipped', 'sidebar lives in the mobile sheet');
          return;
        }
        await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
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
          const membersLink = page.locator(`${SIDENAV}[data-nav-key="module-members"][aria-current="page"]:visible`);
          await expect(membersLink, 'members record must light the Members link').toBeVisible({ timeout: 30_000 });
          walk.note('membersCurrent', true);
        }
      },
      { soft: true },
    );
  });
});

