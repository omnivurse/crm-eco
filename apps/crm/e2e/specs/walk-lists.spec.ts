/**
 * EV-5 — lists: rail + lane chips + rail filter + pager + back-restores +
 * ?page=abc + Export disabled at zero rows (D9) + select-all count + the
 * mobile single-sheet filter.
 * Budgets (D12): lane chip 1, Apply filter ≤3, pager next 1, rail toggle 1.
 *
 * Soft tasks describe Wave-2 work (LS-*: filter-aware lane counts, pager
 * honesty, select-all under the rail filter) and record pass=false today.
 */
import { expect, test } from '../walk-fixture';
import { FIXTURE, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { armPendingStateLatch, firstInt, isMobileProject, parseShowing, pathWithQuery, readPendingStateLatch, runSuffix, toastTitles, trackRequests } from '../walk-helpers';
import { DISPLAY_ONLY_FIELD_BADGE, DISPLAY_ONLY_FIELD_HINT } from '../../src/lib/crm/list-field-policy';

const LIST = `/crm/modules/${FIXTURE.anchor.moduleKey}`;
const PENDING_CHIP = '[data-testid="crm-lane-chip"][data-lane="lane-pending"]';

test.describe('lists walk', () => {
  test('rail, lane chip, rail filter, pager, back restores, ?page=abc, select-all', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    test.skip(mobile, 'docked rail + table pager are lg+ chrome; the mobile sheet has its own test');
    await assertTrapsInTest({ page, request, bareRequest, project });

    const showing = () => page.getByTestId('crm-pager-showing').first();
    const readShowing = async () => parseShowing((await showing().textContent()) ?? '');
    const railOpen = () => page.locator('[data-testid="crm-filter-rail"][data-state="open"]');
    const chipReady = async (lane: string) => {
      const chip = page.locator(`[data-testid="crm-lane-chip"][data-lane="${lane}"]`);
      await expect(chip).toBeVisible();
      await expect(chip).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
      return chip;
    };

    await page.goto(LIST, { waitUntil: 'domcontentloaded' });
    await expect(showing()).toBeVisible({ timeout: 30_000 });

    await walk.task(
      'LS-rail-default',
      'Filter rail is open by default on a fresh list',
      0,
      async () => {
        const rail = page.getByTestId('crm-filter-rail');
        await expect(rail).toBeVisible();
        walk.note('railState', await rail.getAttribute('data-state'));
        await expect(railOpen()).toBeVisible();
      },
      { soft: true },
    );

    let pendingTotal: number | null = null;
    await walk.task(
      'LS-lane-chip',
      'Pending lane chip = 1 click; chip count equals the pager N',
      1,
      async () => {
        const chip = await chipReady('lane-pending');
        const chipCount = firstInt((await chip.textContent()) ?? '');
        walk.note('chipCount', chipCount);
        walk.note('chipDisabled', (await chip.getAttribute('aria-disabled')) === 'true');
        const before = await readShowing();
        await walk.click(chip, 'Pending chip');
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(async () => (await readShowing())?.total, { timeout: 30_000 }).not.toBe(before?.total);
        const after = await readShowing();
        pendingTotal = after?.total ?? null;
        walk.note('pagerTotal', pendingTotal);
        walk.note('url', pathWithQuery(page));
        expect(pathWithQuery(page)).toMatch(/filters=/);
        expect(pendingTotal, 'pager N after the chip').not.toBeNull();
        expect(chipCount, 'lane chip count must equal the pager N').toBe(pendingTotal);
      },
      { soft: true },
    );

    await page.goto(LIST, { waitUntil: 'domcontentloaded' });
    await expect(showing()).toBeVisible({ timeout: 30_000 });
    await walk.task(
      'LS-rail-apply',
      'Rail: Contact Status → Pending lane → Apply = 3 moves, visible pending state, pager N matches',
      3,
      async () => {
        const rail = railOpen();
        await expect(rail).toBeVisible();
        const fieldsTrigger = rail.getByRole('button', { name: /^Filter By Fields/ });
        if ((await fieldsTrigger.count()) > 0 && (await fieldsTrigger.getAttribute('aria-expanded')) === 'false') {
          walk.note('fieldsAccordionWasClosed', true);
          await walk.click(fieldsTrigger, 'expand Filter By Fields');
        }
        const statusButton = rail.locator('button').filter({ hasText: /^Contact Status/ }).first();
        await expect(statusButton).toBeVisible();
        await walk.click(statusButton, 'Contact Status field');
        const pendingLane = rail.getByRole('checkbox', { name: 'Select all Pending statuses' });
        await expect(pendingLane).toBeVisible({ timeout: 30_000 });
        await walk.click(pendingLane, 'Pending lane');
        const before = await readShowing();
        // The pending state (LS-3: useTransition → aria-busy / progressbar) can
        // be shorter than a round-trip to the runner on a warm dev server, so a
        // poll from the outside races it. Arm a MutationObserver in the page
        // BEFORE Apply; it latches the first matching node (present or added)
        // and the runner reads the latch after the click.
        await armPendingStateLatch(page);
        await walk.click(page.getByTestId('crm-filter-apply'), 'Apply');
        const sawPending = await readPendingStateLatch(page, 2_000);
        walk.note('pendingStateSeen', sawPending);
        await expect.poll(async () => (await readShowing())?.total, { timeout: 30_000 }).not.toBe(before?.total);
        const after = await readShowing();
        walk.note('pagerTotal', after?.total ?? null);
        walk.note('url', pathWithQuery(page));
        expect(pathWithQuery(page)).toMatch(/contact_status|status/);
        if (pendingTotal !== null) expect(after?.total, 'rail Pending filter must match the chip result').toBe(pendingTotal);
        expect(sawPending, 'Apply must show a visible pending/loading state').toBe(true);
      },
      { soft: true },
    );

    await page.goto(LIST, { waitUntil: 'domcontentloaded' });
    await expect(showing()).toBeVisible({ timeout: 30_000 });
    let page2Url = '';
    let page2Headers: string[] = [];
    let page2Rail: string | null = null;
    await walk.task('LS-pager-next', 'Next page = 1 click; "Showing 26 to min(50,N) of N"', 1, async () => {
      const first = await readShowing();
      expect(first?.from).toBe(1);
      await walk.click(page.getByTestId('crm-pager-next'), 'Next');
      await expect.poll(async () => (await readShowing())?.from, { timeout: 30_000 }).toBe(26);
      const second = await readShowing();
      walk.note('showing', (await showing().textContent())?.replace(/\s+/g, ' ').trim() ?? '');
      expect(second?.to).toBe(Math.min(50, second?.total ?? 0));
      expect(pathWithQuery(page)).toMatch(/[?&]page=2(&|$)/);
      page2Url = pathWithQuery(page);
      page2Headers = (await page.locator('thead th').allTextContents()).map((t) => t.trim()).filter(Boolean);
      page2Rail = await page.getByTestId('crm-filter-rail').getAttribute('data-state');
    });

    await walk.task(
      'LS-back-restores',
      'Page 2 → open a row → Back restores URL, rail state and columns',
      2,
      async () => {
        // The default contacts view has no `title` column, so rows carry no
        // record link — the row itself navigates (RecordTable handleRowClick).
        const row = page.locator('tbody tr').first().locator('td').nth(1);
        await expect(row).toBeVisible();
        await walk.click(row, 'open a row');
        await expect(page).toHaveURL(/\/crm\/r\//);
        const back = page.locator("nav[aria-label='Breadcrumb'] a").first();
        await expect(back).toBeVisible();
        walk.note('backTitle', await back.getAttribute('title'));
        await walk.click(back, 'Back to the list');
        await expect(page).toHaveURL(/\/crm\/modules\//);
        await expect(showing()).toBeVisible({ timeout: 30_000 });
        const url = pathWithQuery(page);
        walk.note('urlAfterBack', url);
        expect(url, 'URL after Back must equal the page-2 list URL').toBe(page2Url);
        const headers = (await page.locator('thead th').allTextContents()).map((t) => t.trim()).filter(Boolean);
        expect(headers, 'columns after Back').toEqual(page2Headers);
        expect(await page.getByTestId('crm-filter-rail').getAttribute('data-state'), 'rail state after Back').toBe(page2Rail);
      },
      { soft: true },
    );

    await walk.task(
      'LS-page-abc',
      '?page=abc renders page 1',
      0,
      async () => {
        await page.goto(`${LIST}?page=abc`, { waitUntil: 'domcontentloaded' });
        await expect(showing()).toBeVisible({ timeout: 30_000 });
        const text = (await showing().textContent())?.replace(/\s+/g, ' ').trim() ?? '';
        walk.note('showing', text);
        const s = parseShowing(text);
        expect(s, `pager text "${text}" must parse (no NaN)`).not.toBeNull();
        expect(s?.from).toBe(1);
      },
      { soft: true },
    );

    await walk.task(
      'LS-export-zero',
      'Search to 0 rows → Export is disabled (D9): a forced click raises no toast and no export request',
      1,
      async () => {
        const needle = `zz-no-such-record-${runSuffix()}`;
        const exportRequests = trackRequests(page, /\/api\/crm\/records\/export-csv/);
        await page.goto(`${LIST}?search=${encodeURIComponent(needle)}`, { waitUntil: 'domcontentloaded' });
        const empty = page.getByRole('status').filter({ hasText: /^No \w+ match/ }).first();
        await expect(empty).toBeVisible({ timeout: 30_000 });
        walk.note('emptyTitle', (await empty.locator('p').first().textContent())?.trim() ?? '');
        // The pager only renders with rows; the header count reads the server total.
        expect(await showing().count(), 'no pager at zero rows').toBe(0);
        await expect(page.getByText(/^0 records$/)).toBeVisible();
        const exportBtn = page.getByTestId('crm-list-export');
        await expect(exportBtn).toBeVisible();
        await expect(exportBtn).toBeDisabled();
        await expect(exportBtn).toHaveAttribute('aria-disabled', 'true');
        walk.note('exportTitle', await exportBtn.getAttribute('title'));
        // Playwright refuses to click a disabled control; `force` skips the
        // actionability check so the walk records the click the user would try.
        await walk.click(exportBtn, 'Export (disabled)', { force: true });
        await page.waitForTimeout(750);
        expect(await toastTitles(page).count(), 'no toast for a disabled Export').toBe(0);
        expect(exportRequests.length, 'no CSV request for a disabled Export').toBe(0);
      },
    );

    await page.goto(LIST, { waitUntil: 'domcontentloaded' });
    await expect(showing()).toBeVisible({ timeout: 30_000 });
    await walk.task(
      'LS-select-all',
      'Lane chip → Select all rows → "Select all N": selection count equals the filtered pager N',
      3,
      async () => {
        // The fixture's Pending lane fits on one page, so the cross-page "Select
        // all N" control (the P0: it ignores rail filters) only appears on a lane
        // larger than the page size — prefer that lane, fall back to Pending.
        const pageSize = FIXTURE.listPageSize;
        let lane = 'lane-pending';
        for (const candidate of ['lane-active', 'lane-pending']) {
          const c = page.locator(`[data-testid="crm-lane-chip"][data-lane="${candidate}"]`);
          if ((await c.count()) === 0) continue;
          await expect(c).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
          const n = firstInt((await c.textContent()) ?? '');
          if (n !== null && n > pageSize) {
            lane = candidate;
            break;
          }
        }
        walk.note('lane', lane);
        const chip = await chipReady(lane);
        const before = await readShowing();
        await walk.click(chip, `${lane} chip`);
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(async () => (await readShowing())?.total, { timeout: 30_000 }).not.toBe(before?.total);
        const total = (await readShowing())?.total ?? null;
        walk.note('pagerTotal', total);
        await walk.click(page.getByRole('checkbox', { name: 'Select all rows' }), 'Select all rows (page)');
        const selectAllN = page.getByRole('button', { name: /^Select all \d/ });
        if ((await selectAllN.count()) > 0) {
          const offered = firstInt((await selectAllN.first().textContent()) ?? '');
          walk.note('selectAllOffered', offered);
          await walk.click(selectAllN.first(), `Select all ${offered}`);
          const toast = page.locator('[data-sonner-toast] [data-title]').filter({ hasText: /^Selected \d/ }).first();
          await expect(toast).toBeVisible({ timeout: 20_000 });
          const selected = firstInt((await toast.textContent()) ?? '');
          walk.note('toastSelected', selected);
          expect(offered, '"Select all N" must offer the filtered total').toBe(total);
          expect(selected, 'toast count must equal the filtered pager N').toBe(total);
        } else {
          // MassActionsBar renders the count twice (one copy display:none per breakpoint).
          const selectedText = page.getByText(/^\d+ selected$/).locator('visible=true').first();
          await expect(selectedText).toBeVisible();
          const selected = firstInt((await selectedText.textContent()) ?? '');
          walk.note('selectedOnPage', selected);
          expect(selected, 'single-page lane: every filtered row selected').toBe(total);
        }
      },
      { soft: true },
    );
  });

  test('mobile-390: single-sheet filter in ≤4 taps', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(!isMobileProject(project), 'mobile sheet only');
    await assertTrapsInTest({ page, request, bareRequest, project });
    await page.goto(LIST, { waitUntil: 'domcontentloaded' });
    const showing = () => page.getByTestId('crm-pager-showing').first();
    await expect(showing()).toBeVisible({ timeout: 30_000 });
    const readShowing = async () => parseShowing((await showing().textContent()) ?? '');

    await walk.task(
      'LS-mobile-filter',
      'Filters → Contact Status → Pending lane → Apply (≤4 taps)',
      4,
      async () => {
        const chip = page.locator(PENDING_CHIP);
        const chipCount = (await chip.count()) > 0 ? firstInt((await chip.textContent()) ?? '') : null;
        walk.note('chipCount', chipCount);
        // Below md the toolbar collapses behind "Filters & View" (MobileToolbarDrawer)
        // and the filter trigger lives inside that sheet — one extra tap today.
        const directTrigger = page.getByTestId('crm-filter-trigger').locator('visible=true');
        if ((await directTrigger.count()) === 0) {
          walk.note('viaFiltersAndView', true);
          await walk.click(page.getByRole('button', { name: /Filters & View/ }), 'Filters & View');
          await walk.click(page.getByRole('dialog').getByTestId('crm-filter-trigger'), 'Filters (inside the sheet)');
        } else {
          walk.note('viaFiltersAndView', false);
          await walk.click(directTrigger.first(), 'Filters');
        }
        const sheet = page.getByRole('dialog').filter({ has: page.locator('button').filter({ hasText: /^Contact Status/ }) }).first();
        await expect(sheet).toBeVisible();
        const fieldsTrigger = sheet.getByRole('button', { name: /^Filter By Fields/ });
        if ((await fieldsTrigger.count()) > 0 && (await fieldsTrigger.getAttribute('aria-expanded')) === 'false') {
          await walk.click(fieldsTrigger, 'expand Filter By Fields');
        }
        await walk.click(sheet.locator('button').filter({ hasText: /^Contact Status/ }).first(), 'Contact Status');
        await walk.click(sheet.getByRole('checkbox', { name: 'Select all Pending statuses' }), 'Pending lane');
        const before = await readShowing();
        await walk.click(sheet.getByTestId('crm-filter-apply'), 'Apply');
        await expect.poll(async () => (await readShowing())?.total, { timeout: 30_000 }).not.toBe(before?.total);
        const total = (await readShowing())?.total ?? null;
        walk.note('pagerTotal', total);
        walk.note('url', pathWithQuery(page));
        expect(pathWithQuery(page)).toMatch(/filters=/);
        if (chipCount !== null) expect(total).toBe(chipCount);
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// LS-4 — members twin-overlay fields are display-only: the rail refuses them
// with the user-voice reason and the chips-bar Sort menu never offers them.
// ---------------------------------------------------------------------------
test.describe('members display-only fields (LS-4)', () => {
  test('rail shows Plan as display-only; Sort menu skips twin fields', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(isMobileProject(project), 'docked rail + chips bar are lg+ chrome');
    await assertTrapsInTest({ page, request, bareRequest, project });
    await page.goto('/crm/modules/members', { waitUntil: 'domcontentloaded' });
    const rail = page.locator('[data-testid="crm-filter-rail"][data-state="open"]');
    await expect(rail).toBeVisible({ timeout: 30_000 });

    await walk.task(
      'LS-4-rail-display-only',
      "Members rail: Plan/Product/Effective date rows are disabled with the 'display only' badge + reason",
      1,
      async () => {
        const fieldsTrigger = rail.getByRole('button', { name: /^Filter By Fields/ });
        if ((await fieldsTrigger.count()) > 0 && (await fieldsTrigger.getAttribute('aria-expanded')) === 'false') {
          await walk.click(fieldsTrigger, 'expand Filter By Fields');
        }
        const displayOnlyRows = rail.locator('button[data-display-only]');
        const labels = (await displayOnlyRows.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
        walk.note('displayOnlyRows', labels.join(' | ') || '(none)');
        expect(labels.length, 'members must mark twin-overlay fields display-only').toBeGreaterThan(0);
        expect(labels.some((l) => /plan|product/i.test(l)), 'a Plan/Product row must be display-only').toBe(true);
        const planRow = displayOnlyRows.filter({ hasText: /plan|product/i }).first();
        await expect(planRow).toBeDisabled();
        walk.note('reasonTitle', await planRow.getAttribute('title'));
        expect(await planRow.getAttribute('title')).toBe(DISPLAY_ONLY_FIELD_HINT);
        await expect(planRow.getByText(DISPLAY_ONLY_FIELD_BADGE)).toBeVisible();
      },
      { soft: true },
    );

    await walk.task(
      'LS-4-sort-menu',
      'Sort menu on /crm/modules/members never lists Plan / Effective date',
      1,
      async () => {
        // The chips bar renders once a filter or sort is active — arrive sorted.
        await page.goto('/crm/modules/members?sortField=created_at&sortDir=desc', { waitUntil: 'domcontentloaded' });
        const sortButton = page.locator('button:visible').filter({ hasText: /^Sort:/ }).first();
        await expect(sortButton, 'the chips-bar Sort menu must exist').toBeVisible({ timeout: 30_000 });
        await walk.click(sortButton, 'Sort menu');
        const items = (await page.getByRole('menuitem').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
        walk.note('sortItems', items.join(' | '));
        expect(items.length).toBeGreaterThan(0);
        expect(
          items.some((l) => /plan|product|effective/i.test(l)),
          'display-only twin fields must not be sortable',
        ).toBe(false);
        await walk.press('Escape', 'close Sort menu');
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// LS-5 — after a bulk status change the lane chips recount on the next paint.
// Runs against a throwaway walk record so the seeded lanes stay untouched.
// ---------------------------------------------------------------------------
test.describe('lane-chip recount after bulk status (LS-5)', () => {
  test('bulk Pending→Active moves the chip counts', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(isMobileProject(project), 'bulk bar + chips are lg+ chrome');
    // PATCH /api/crm/records/bulk requires crm_admin | crm_manager.
    test.skip(walkRole() !== 'admin', 'run with WALK_ROLE=admin (bulk update is manager/admin-only)');
    await assertTrapsInTest({ page, request, bareRequest, project });
    const suffix = runSuffix();

    // Pat Pending's own status string = a guaranteed Pending-lane vocabulary value.
    const searchRes = await request.get(`/api/crm/search?q=${FIXTURE.pendingOldest.phone}&limit=5`);
    const searchBody = (await searchRes.json()) as { results?: Array<{ subtitle?: string }> };
    const pendingStatus = searchBody.results?.[0]?.subtitle?.split(' · ').pop()?.trim() || 'Pending';

    const modsRes = await request.get('/api/crm/modules');
    const mods = (await modsRes.json()) as Array<{ id: string; org_id: string; key: string }>;
    const contacts = mods.find((m) => m.key === 'contacts')!;
    const createRes = await request.post('/api/crm/records', {
      data: {
        org_id: contacts.org_id,
        module_id: contacts.id,
        status: pendingStatus,
        data: {
          first_name: 'Walk',
          last_name: `Recount${suffix}`,
          contact_status: pendingStatus,
          // DE-6 guard: a Pending create must carry a coverage start date.
          sharing_effective_date: FIXTURE.anchor.sharingEffectiveDate,
          walk_fixture: 'true',
        },
      },
    });
    expect(createRes.status(), 'fixture create for the recount walk').toBeLessThan(300);
    const created = (await createRes.json()) as { id?: string; record?: { id?: string } };
    const recordId = created.id ?? created.record?.id;
    expect(recordId).toBeTruthy();

    const chip = (lane: string) => page.locator(`[data-testid="crm-lane-chip"][data-lane="${lane}"]`);
    const chipCount = async (lane: string) => {
      await expect(chip(lane)).toBeVisible({ timeout: 30_000 });
      await expect(chip(lane)).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
      return firstInt((await chip(lane).textContent()) ?? '');
    };

    try {
      // The search narrows the table to OUR row; chip counts stay module-wide.
      await page.goto(`${LIST}?search=Recount${suffix}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('crm-pager-showing').first()).toBeVisible({ timeout: 30_000 });
      const pendingBefore = await chipCount('lane-pending');
      const activeBefore = await chipCount('lane-active');

      await walk.task(
        'LS-5-bulk-recount',
        'Select the row → Status → Active → chips recount on the next paint (5 clicks)',
        5,
        async () => {
          walk.note('pendingBefore', pendingBefore);
          walk.note('activeBefore', activeBefore);
          expect(pendingBefore, 'the walk row must land in the Pending lane count').not.toBeNull();
          await walk.click(page.getByRole('checkbox', { name: 'Select all rows' }), 'select the row');
          const statusButton = page.locator('button:visible').filter({ hasText: /^Status$/ }).first();
          await expect(statusButton).toBeVisible();
          await walk.click(statusButton, 'Status (bulk bar)');
          await walk.click(page.getByRole('combobox', { name: 'New status' }), 'New status');
          await walk.click(page.getByRole('option', { name: /^Active\b/ }).first(), 'Active');
          await walk.click(page.getByRole('button', { name: 'Update Status' }), 'Update Status');
          await expect(toastTitles(page).filter({ hasText: 'Status updated' }).first()).toBeVisible({ timeout: 30_000 });
          await expect
            .poll(async () => chipCount('lane-pending'), { timeout: 30_000, message: 'pending chip must drop by 1' })
            .toBe((pendingBefore ?? 0) - 1);
          const activeAfter = await chipCount('lane-active');
          walk.note('pendingAfter', await chipCount('lane-pending'));
          walk.note('activeAfter', activeAfter);
          expect(activeAfter, 'active chip must gain the row').toBe((activeBefore ?? 0) + 1);
        },
        { soft: true },
      );
    } finally {
      await request.delete(`/api/crm/records/${recordId}`);
    }
  });
});

// ---------------------------------------------------------------------------
// LS-8 — rail keyboard: Enter in a value input applies the draft, Esc restores
// it to the applied set.
// ---------------------------------------------------------------------------
test.describe('rail keyboard (LS-8)', () => {
  test('Enter applies, Esc restores the draft', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(isMobileProject(project), 'docked rail is lg+ chrome');
    await assertTrapsInTest({ page, request, bareRequest, project });
    await page.goto(LIST, { waitUntil: 'domcontentloaded' });
    const showing = () => page.getByTestId('crm-pager-showing').first();
    await expect(showing()).toBeVisible({ timeout: 30_000 });
    const rail = page.locator('[data-testid="crm-filter-rail"][data-state="open"]');
    await expect(rail).toBeVisible();

    await walk.task(
      'LS-8-enter-esc',
      'First Name filter: type → Enter applies (URL + pager narrow); edit → Esc restores the applied value',
      2,
      async () => {
        const fieldsTrigger = rail.getByRole('button', { name: /^Filter By Fields/ });
        if ((await fieldsTrigger.count()) > 0 && (await fieldsTrigger.getAttribute('aria-expanded')) === 'false') {
          await walk.click(fieldsTrigger, 'expand Filter By Fields');
        }
        const firstName = rail.locator('button').filter({ hasText: /^First Name/ }).first();
        await expect(firstName).toBeVisible();
        await walk.click(firstName, 'First Name field');
        const valueInput = rail.locator('input[placeholder="Value…"]').first();
        await expect(valueInput).toBeVisible();
        const before = parseShowing((await showing().textContent()) ?? '')?.total ?? null;
        await walk.type(valueInput, FIXTURE.anchor.firstName, 'type the value');
        await walk.press('Enter', 'Enter applies');
        await expect.poll(async () => parseShowing((await showing().textContent()) ?? '')?.total, { timeout: 30_000 }).not.toBe(before);
        walk.note('urlAfterEnter', pathWithQuery(page));
        expect(pathWithQuery(page)).toMatch(/filters=/);
        const applied = parseShowing((await showing().textContent()) ?? '')?.total ?? null;
        walk.note('totalAfterEnter', applied);
        expect(applied, 'Enter must apply the draft').not.toBeNull();
        expect(applied!).toBeLessThan(before ?? Number.MAX_SAFE_INTEGER);
        // Esc restores the dirty draft to the applied value.
        await walk.type(valueInput, 'Zzz-draft-edit', 'dirty the draft');
        await walk.press('Escape', 'Esc restores');
        await expect.poll(() => valueInput.inputValue(), { timeout: 10_000 }).toBe(FIXTURE.anchor.firstName);
        walk.note('valueAfterEsc', await valueInput.inputValue());
      },
      { soft: true },
    );
  });
});

