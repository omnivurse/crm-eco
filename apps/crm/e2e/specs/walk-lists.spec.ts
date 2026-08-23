/**
 * EV-5 — lists: rail + lane chips + rail filter + pager + back-restores +
 * ?page=abc + Export disabled at zero rows (D9) + select-all count + the
 * mobile single-sheet filter (LS-10: one overlay, ≤4 taps, no phantom rail
 * column).
 * Budgets (D12): lane chip 1, Apply filter ≤3, pager next 1, rail toggle 1.
 *
 * Soft tasks describe Wave-2 work (LS-*: filter-aware lane counts, pager
 * honesty, select-all under the rail filter) and record pass=false today.
 */
import { expect, test } from '../walk-fixture';
import { FIXTURE, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL, PIFH_ORG_ID, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { armPendingStateLatch, firstInt, isMobileProject, parseShowing, pathWithQuery, readPendingStateLatch, runSuffix, toastTitles, trackRequests } from '../walk-helpers';
import { DISPLAY_ONLY_FIELD_BADGE, DISPLAY_ONLY_FIELD_HINT } from '../../src/lib/crm/list-field-policy';
import {
  FILTER_RAIL_DEFAULT_OPEN,
  FILTER_RAIL_STORAGE_PREFIX,
  filterRailStorageKey,
  legacyFilterRailStorageKey,
} from '../../src/lib/crm/filter-rail';

const LIST = `/crm/modules/${FIXTURE.anchor.moduleKey}`;
const PENDING_CHIP = '[data-testid="crm-lane-chip"][data-lane="lane-pending"]';

/** LOCAL PostgREST (service role) — fixture rows and the LS-9 org flag. */
const REST = `${LOCAL_SUPABASE_URL}/rest/v1`;
const REST_HEADERS = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
} as const;

test.describe('lists walk', () => {
  test('rail, lane chip, rail filter, pager, back restores, ?page=abc, select-all', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    test.skip(mobile, 'docked rail + table pager are lg+ chrome; the mobile sheet has its own test');
    await assertTrapsInTest({ page, request, bareRequest, project });

    const showing = () => page.getByTestId('crm-pager-showing').first();
    const readShowing = async () => parseShowing((await showing().textContent()) ?? '');
    const railOpen = () => page.locator('[data-testid="crm-filter-rail"][data-state="open"]');
    // A lane chip renders its count span only once the status-values fetch is
    // `ready` (QuickFilterChips: `count !== null`). While the fetch is still
    // `idle` the chip carries NO aria-busy either, so waiting on aria-busy
    // alone can hand the spec a chip whose text has no number — the race that
    // made the graded admin run record `chipCount: null`.
    const chipReady = async (lane: string) => {
      const chip = page.locator(`[data-testid="crm-lane-chip"][data-lane="${lane}"]`);
      await expect(chip).toBeVisible();
      await expect(chip).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
      await expect(chip.getByTestId('crm-lane-chip-count'), `the ${lane} chip must carry a resolved count`).toBeVisible({
        timeout: 30_000,
      });
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
        // D11 promises rail == chip. A guarded `if (pendingTotal !== null)` let
        // the row report PASS on a run where the comparison never executed, so
        // the missing number is itself the failure.
        expect(pendingTotal, 'LS-lane-chip must have recorded a pager N for the rail to be compared against').not.toBeNull();
        expect(after?.total, 'rail Pending filter must match the chip result').toBe(pendingTotal);
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
      '?page=abc and ?page=0 both render page 1 (LS-2 clamp)',
      0,
      async () => {
        // LS-2 acceptance names both spellings of a junk page param.
        for (const raw of ['abc', '0']) {
          await page.goto(`${LIST}?page=${raw}`, { waitUntil: 'domcontentloaded' });
          await expect(showing()).toBeVisible({ timeout: 30_000 });
          const text = (await showing().textContent())?.replace(/\s+/g, ' ').trim() ?? '';
          walk.note(`showing.page-${raw}`, text);
          const s = parseShowing(text);
          expect(s, `pager text "${text}" for ?page=${raw} must parse (no NaN)`).not.toBeNull();
          expect(s?.from, `?page=${raw} must land on page 1`).toBe(1);
        }
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

    // LS-1's P0 — the cross-page "Select all N" must offer the FILTERED total —
    // only renders on a lane BIGGER than one page (MassActionsBar hides it once
    // the page selection already is the whole lane). The seeded fixture's
    // biggest lane (Active, 16) fits on page 1, so the row used to fall back to
    // a single-page lane and the cross-page control was never exercised on ANY
    // recorded run. Top the Active lane up past the page size for the length of
    // this task, then delete the rows again so the fixture counts return.
    const laneChip = await chipReady('lane-active');
    const activeBefore = firstInt((await laneChip.textContent()) ?? '');
    expect(activeBefore, 'the Active lane chip must carry a count before the top-up').not.toBeNull();
    const topUp = Math.max(0, FIXTURE.listPageSize + 3 - (activeBefore ?? 0));
    const selectAllSuffix = runSuffix();
    const modulesRes = await request.get(`${REST}/crm_modules?org_id=eq.${PIFH_ORG_ID}&key=eq.${FIXTURE.anchor.moduleKey}&select=id`, {
      headers: REST_HEADERS,
    });
    const contactsModuleId = ((await modulesRes.json()) as Array<{ id: string }>)[0]?.id;
    expect(contactsModuleId, 'the local fixture must have a contacts module').toBeTruthy();
    const seededIds: string[] = [];
    if (topUp > 0) {
      // first_name 'Walk' is the prune convention (scripts/e2e/seed-walk-fixture.mjs).
      const made = await request.post(`${REST}/crm_records`, {
        headers: REST_HEADERS,
        data: Array.from({ length: topUp }, (_, i) => ({
          org_id: PIFH_ORG_ID,
          module_id: contactsModuleId,
          title: `Walk Bulk${selectAllSuffix}${i}`,
          status: 'Active',
          data: {
            first_name: 'Walk',
            last_name: `Bulk${selectAllSuffix}${i}`,
            contact_status: 'Active',
            walk_fixture: 'true',
          },
        })),
      });
      expect(made.status(), 'top up the Active lane past one page').toBeLessThan(300);
      seededIds.push(...((await made.json()) as Array<{ id: string }>).map((r) => r.id));
    }

    try {
      await page.goto(LIST, { waitUntil: 'domcontentloaded' });
      await expect(showing()).toBeVisible({ timeout: 30_000 });
      await walk.task(
        'LS-select-all',
        'Lane chip → Select all rows → "Select all N": selection count equals the filtered pager N',
        3,
        async () => {
          const lane = 'lane-active';
          walk.note('lane', lane);
          walk.note('seededForCrossPage', topUp);
          const chip = await chipReady(lane);
          const chipCount = firstInt((await chip.textContent()) ?? '');
          walk.note('chipCount', chipCount);
          expect(chipCount, 'the lane must exceed one page or the cross-page control cannot appear').toBeGreaterThan(
            FIXTURE.listPageSize,
          );
          const before = await readShowing();
          await walk.click(chip, `${lane} chip`);
          await expect(chip).toHaveAttribute('aria-pressed', 'true');
          await expect.poll(async () => (await readShowing())?.total, { timeout: 30_000 }).not.toBe(before?.total);
          const total = (await readShowing())?.total ?? null;
          walk.note('pagerTotal', total);
          expect(total, 'the filtered pager must report a total').not.toBeNull();
          expect(chipCount, 'lane chip count must equal the filtered pager N').toBe(total);
          await walk.click(page.getByRole('checkbox', { name: 'Select all rows' }), 'Select all rows (page)');
          const selectAllN = page.getByRole('button', { name: /^Select all \d/ }).first();
          await expect(
            selectAllN,
            'a lane larger than one page must offer the cross-page "Select all N" (LS-1)',
          ).toBeVisible({ timeout: 20_000 });
          const offered = firstInt((await selectAllN.textContent()) ?? '');
          walk.note('selectAllOffered', offered);
          await walk.click(selectAllN, `Select all ${offered}`);
          const toast = page.locator('[data-sonner-toast] [data-title]').filter({ hasText: /^Selected \d/ }).first();
          await expect(toast).toBeVisible({ timeout: 20_000 });
          const selected = firstInt((await toast.textContent()) ?? '');
          walk.note('toastSelected', selected);
          expect(offered, '"Select all N" must offer the filtered total, not the module total').toBe(total);
          expect(selected, 'toast count must equal the filtered pager N').toBe(total);
        },
        { soft: true },
      );
    } finally {
      for (const id of seededIds) await request.delete(`${REST}/crm_records?id=eq.${id}`, { headers: REST_HEADERS });
    }
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
        // Read the chip BEFORE the sheet covers it. A missing chip used to make
        // the D11 "chip equals pager" comparison silently skip while the row
        // still reported PASS — so the chip's absence now fails the row.
        await expect(chip.first(), 'the Pending lane chip must be on the phone list to compare against').toBeVisible({ timeout: 30_000 });
        // …and wait for the count itself: an unresolved chip (status-values
        // still `idle`) has no aria-busy and no number, which is how the graded
        // admin run recorded `chipCount: null` while the row reported PASS.
        await expect(
          chip.first().getByTestId('crm-lane-chip-count'),
          'the Pending chip must carry a resolved count to compare the pager against',
        ).toBeVisible({ timeout: 30_000 });
        const chipCount = firstInt((await chip.first().textContent()) ?? '');
        walk.note('chipCount', chipCount);
        // LS-10: below md the toolbar collapses behind ONE "Filters & View"
        // sheet and the rail is rendered inside it — no second overlay, so the
        // fields are one tap away instead of two.
        const directTrigger = page.getByTestId('crm-filter-trigger').locator('visible=true');
        if ((await directTrigger.count()) === 0) {
          walk.note('viaFiltersAndView', true);
          await walk.click(page.getByRole('button', { name: /Filters & View/ }), 'Filters & View');
        } else {
          walk.note('viaFiltersAndView', false);
          await walk.click(directTrigger.first(), 'Filters');
        }
        const sheet = page.getByRole('dialog').filter({ has: page.locator('button').filter({ hasText: /^Contact Status/ }) }).first();
        await expect(sheet).toBeVisible();
        // One overlay: the rail must not be stacked on top of the toolbar sheet.
        const overlays = await page.getByRole('dialog').locator('visible=true').count();
        walk.note('overlays', overlays);
        expect(overlays, 'exactly one overlay is open while filtering').toBe(1);
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
        // Apply closes the one sheet — the filtered list is visible, not buried.
        // (Radix animates the sheet out, so poll rather than read once.)
        await expect
          .poll(async () => page.getByRole('dialog').locator('visible=true').count(), {
            timeout: 10_000,
            message: 'Apply must close the mobile sheet',
          })
          .toBe(0);
        walk.note('overlaysAfterApply', await page.getByRole('dialog').locator('visible=true').count());
        expect(pathWithQuery(page)).toMatch(/filters=/);
        expect(chipCount, 'the Pending chip must carry a count').not.toBeNull();
        expect(total, 'the sheet-filtered pager N must equal the Pending chip count (D11)').toBe(chipCount);
      },
      { soft: true },
    );

    await walk.task(
      'LS-10-flush-left',
      'No phantom rail column: the records pane starts at the workspace left edge on a phone',
      0,
      async () => {
        const workspace = page.locator('[data-filter-workspace]').first();
        await expect(workspace).toBeVisible({ timeout: 30_000 });
        const gap = await workspace.evaluate((el) => {
          const pane = el.children[1] as HTMLElement | undefined;
          const railCell = el.children[0] as HTMLElement | undefined;
          return {
            columnGap: getComputedStyle(el).columnGap,
            railCellWidth: railCell ? Math.round(railCell.getBoundingClientRect().width) : null,
            offsetPx: pane
              ? Math.round(pane.getBoundingClientRect().left - el.getBoundingClientRect().left)
              : null,
          };
        });
        walk.note('columnGap', gap.columnGap);
        walk.note('railCellWidth', gap.railCellWidth);
        walk.note('paneOffsetPx', gap.offsetPx);
        await walk.shot('table pane flush-left');
        expect(gap.offsetPx, 'the records pane must sit flush against the left edge').toBe(0);
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

// ---------------------------------------------------------------------------
// LS-2 — a list whose rows query FAILS says so: "Couldn't load {noun}" + Try
// again, and never the Create/Import CTA (zero rows must not read as "empty").
//
// The rows query runs server-side (page.tsx → getRecords → Supabase from Node),
// so a browser route intercept cannot reach it — the failure is forced from the
// URL instead, with a filter PostgREST refuses (`contains` on the uuid `id`
// column) and, failing that, a range far past the end (PostgREST 416). Both
// make `getRecords` throw exactly like a real outage; the walk records which
// one produced the state.
// ---------------------------------------------------------------------------
test.describe('list load failure (LS-2)', () => {
  test("a failed rows query renders Couldn't load + Try again, never Create", async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    await assertTrapsInTest({ page, request, bareRequest, project });

    const forced: Array<{ how: string; url: string }> = [
      {
        // created_at is a REAL timestamptz column (report-field-path.ts system
        // fields), so `gt` with junk is rejected by Postgres itself — the same
        // shape of failure a broken index or a dropped column would produce.
        how: 'timestamptz column compared to junk (PostgREST 400)',
        url: `${LIST}?filters=${encodeURIComponent(JSON.stringify([{ field: 'created_at', operator: 'gt', value: 'zz-not-a-date' }]))}`,
      },
      { how: 'range far past the end (PostgREST 416)', url: `${LIST}?page=99999` },
    ];
    // The list renders desktop and mobile twins; only one of them is displayed.
    const panel = () => page.locator('[role="status"][data-reason]').locator('visible=true').first();
    const settled = () =>
      page.locator('[data-testid="crm-pager-showing"], [role="status"][data-reason]').locator('visible=true').first();

    const probes: string[] = [];
    let how: string | null = null;
    let landedReason: string | null = null;
    for (const attempt of forced) {
      await page.goto(attempt.url, { waitUntil: 'domcontentloaded' });
      await expect(settled(), `${attempt.how}: the list must settle on rows or an empty state`).toBeVisible({ timeout: 30_000 });
      landedReason = (await panel().count()) > 0 ? await panel().getAttribute('data-reason') : 'rows';
      probes.push(`${attempt.how} → ${landedReason}`);
      if (landedReason === 'load-failed') {
        how = attempt.how;
        break;
      }
    }

    await walk.task(
      'LS-2-load-error',
      "Forced rows-query failure → \"Couldn't load contacts\" + Try again, no Create/Import CTA (retry = 1 click)",
      1,
      async () => {
        walk.note('forcedBy', how ?? '(none of the forced URLs failed the query)');
        walk.note('probes', probes.join(' | '));
        walk.note('emptyReason', landedReason);
        walk.note('url', pathWithQuery(page));
        expect(landedReason, 'a failed rows query must resolve to the load-failed empty state').toBe('load-failed');
        const title = (await panel().locator('p').first().textContent())?.replace(/\s+/g, ' ').trim() ?? '';
        walk.note('title', title);
        expect(title, 'the load-failure title names the module noun').toMatch(/^Couldn.t load contacts$/i);
        const description = (await panel().locator('p').nth(1).textContent())?.replace(/\s+/g, ' ').trim() ?? '';
        walk.note('description', description);
        expect(description, 'the copy must promise the filters are unchanged').toMatch(/filters are unchanged/i);
        // Never the "empty module" doors: the rows are unknown, not absent.
        const cta = panel().getByRole('button', { name: /Create|Import/i });
        walk.note('createOrImportButtons', await cta.count());
        expect(await cta.count(), 'a failed load must not offer Create/Import').toBe(0);
        const retry = panel().getByRole('button', { name: 'Try again' });
        await expect(retry, 'the only door out is Try again').toBeVisible();
        const before = pathWithQuery(page);
        await walk.click(retry, 'Try again');
        // Retry is router.refresh(): same URL, so the state comes back (the
        // forced failure is still forced) — what matters is that it re-runs
        // without navigating away or throwing the app into its error boundary.
        await expect(panel()).toBeVisible({ timeout: 30_000 });
        walk.note('urlAfterRetry', pathWithQuery(page));
        expect(pathWithQuery(page), 'Try again keeps the URL (LS-2: filters untouched)').toBe(before);
        expect(await page.getByText(/Application error|Unhandled Runtime Error/i).count(), 'no error boundary').toBe(0);
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// LS-7b — the leads list never promises rows it does not render: the converted
// -lead guard lives in the query, so the "Showing 1 to Y of N" range, the rows
// on the page and the total all agree. A throwaway pair (one live lead, one
// converted) is created for the check and removed afterwards.
// ---------------------------------------------------------------------------
test.describe('leads pager honesty (LS-7b)', () => {
  test('rendered rows fill the Showing range; a converted lead counts in neither', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    await assertTrapsInTest({ page, request, bareRequest, project });
    const suffix = runSuffix();
    const LEADS = '/crm/modules/leads';
    const restHeaders = REST_HEADERS;
    const rest = `${REST}/crm_records`;

    const showing = () => page.getByTestId('crm-pager-showing').first();
    const readShowing = async () => parseShowing((await showing().textContent()) ?? '');
    // Desktop/tablet render <tr id="crm-row-…">; mobile renders RecordCards whose
    // title is the only link to /crm/r/. Count whichever this breakpoint drew.
    const renderedRows = async () => {
      const rows = await page.locator('tr[id^="crm-row-"]').count();
      if (rows > 0) return rows;
      return page.locator('main a[href^="/crm/r/"]').evaluateAll((els) => new Set(els.map((el) => el.getAttribute('href'))).size);
    };

    const modRes = await request.get(`${LOCAL_SUPABASE_URL}/rest/v1/crm_modules?org_id=eq.${PIFH_ORG_ID}&key=eq.leads&select=id`, {
      headers: restHeaders,
    });
    const leadsModuleId = ((await modRes.json()) as Array<{ id: string }>)[0]?.id;
    expect(leadsModuleId, 'the local fixture must have a leads module').toBeTruthy();

    await page.goto(LEADS, { waitUntil: 'domcontentloaded' });
    await expect(showing()).toBeVisible({ timeout: 30_000 });
    const totalBefore = (await readShowing())?.total ?? null;

    // first_name 'Walk' is the prune convention (scripts/e2e/seed-walk-fixture.mjs).
    const made = await request.post(rest, {
      headers: restHeaders,
      data: [
        {
          org_id: PIFH_ORG_ID,
          module_id: leadsModuleId,
          title: `Walk Live${suffix}`,
          status: 'New',
          data: { first_name: 'Walk', last_name: `Live${suffix}`, walk_fixture: 'true' },
        },
        {
          org_id: PIFH_ORG_ID,
          module_id: leadsModuleId,
          title: `Walk Conv${suffix}`,
          status: 'Converted',
          data: { first_name: 'Walk', last_name: `Conv${suffix}`, is_converted: true, lead_status: 'Converted', walk_fixture: 'true' },
        },
      ],
    });
    expect(made.status(), 'seed the LS-7b lead pair').toBeLessThan(300);
    const ids = ((await made.json()) as Array<{ id: string }>).map((r) => r.id);

    try {
      await page.goto(LEADS, { waitUntil: 'domcontentloaded' });
      await expect(showing()).toBeVisible({ timeout: 30_000 });

      await walk.task(
        'LS-7b-leads-rows',
        'Leads: the page renders every row the "Showing" range promises, and the converted lead is in neither',
        0,
        async () => {
          const s = await readShowing();
          walk.note('showing', (await showing().textContent())?.replace(/\s+/g, ' ').trim() ?? '');
          expect(s, 'the leads pager must parse').not.toBeNull();
          const rows = await renderedRows();
          walk.note('renderedRows', rows);
          walk.note('promisedRows', s ? s.to - s.from + 1 : null);
          walk.note('totalBefore', totalBefore);
          walk.note('totalAfter', s?.total ?? null);
          const promised = s!.to - s!.from + 1;
          // The desktop table virtualises: on a long page only the visible
          // window is in the DOM, so exact equality is only meaningful while
          // the promised range fits one screen. The leads fixture is two rows,
          // and a guarded `if (promised <= 10)` would silently drop the
          // headline assertion the day it stopped being — so the fixture
          // contract is asserted FIRST and the equality then runs every time.
          expect(promised, 'the leads fixture must stay inside the non-virtualised window (≤10 rows)').toBeLessThanOrEqual(10);
          expect(rows, 'the list must render every row the range promises').toBe(promised);
          expect(rows, 'rows on the page can never exceed what the range promises').toBeLessThanOrEqual(promised);
          expect(promised, 'the range can never promise more than the total').toBeLessThanOrEqual(s!.total);
          // The converted row counts in neither the total nor the rows.
          expect(totalBefore, 'the leads pager must have parsed before the two rows were inserted').not.toBeNull();
          expect(s!.total, 'only the live lead may join the total').toBe(totalBefore! + 1);
          // Read the rows' own text (the virtualised table positions rows
          // absolutely, so "visible" is a scroll question, not a listing one).
          const rowsText = (await page.locator('tr[id^="crm-row-"], main a[href^="/crm/r/"]').allTextContents())
            .join(' | ')
            .replace(/\s+/g, ' ');
          walk.note('rowsText', rowsText.slice(0, 200));
          expect(rowsText, 'the live lead is listed').toContain(`Live${suffix}`);
          expect(rowsText, 'a converted lead must not appear in the list').not.toContain(`Conv${suffix}`);
        },
        { soft: true },
      );
    } finally {
      for (const id of ids) await request.delete(`${rest}?id=eq.${id}`, { headers: restHeaders });
    }
  });
});

// ---------------------------------------------------------------------------
// LS-rail-remembered — the docked rail's open/collapsed state is remembered
// across a module hop AND a hard reload, is applied on the first rendered
// frame (no open-then-snap), and is scoped to the viewer: another user's saved
// state on the same browser profile — and the pre-scoping unscoped key — must
// never be read (lib/crm/filter-rail.ts `filterRailStorageKey`).
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    /** Every distinct `data-state` the rail has shown, oldest first, with the ms since navigation start. */
    __walkRailStates?: Array<{ state: string; at: number }>;
  }
}

test.describe('rail state is remembered per viewer (LS-rail-remembered)', () => {
  test('collapse survives a module hop + reload, and never leaks to another viewer', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(isMobileProject(project), 'the docked rail is lg+ chrome');
    await assertTrapsInTest({ page, request, bareRequest, project });

    // Armed before the first navigation, re-armed on every document: records
    // the ORDER of rail states, so an open-then-snap flash is visible as
    // ['open','collapsed'] instead of being smoothed over by a settled read.
    await page.addInitScript(() => {
      window.__walkRailStates = [];
      const capture = () => {
        const state = document.querySelector('[data-testid="crm-filter-rail"]')?.getAttribute('data-state');
        if (!state) return;
        const seen = window.__walkRailStates!;
        if (seen[seen.length - 1]?.state !== state) seen.push({ state, at: Math.round(performance.now()) });
      };
      new MutationObserver(capture).observe(document.documentElement ?? document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-state'],
      });
      document.addEventListener('DOMContentLoaded', capture);
      capture();
    });

    const showing = () => page.getByTestId('crm-pager-showing').first();
    const rail = () => page.getByTestId('crm-filter-rail');
    const railState = () => rail().getAttribute('data-state');
    const railStateLog = () => page.evaluate(() => window.__walkRailStates ?? []);
    const stateSequence = async () => (await railStateLog()).map((e) => e.state).join(' → ');
    /** How long the FIRST (wrong) state stayed on screen before hydration replaced it; 0 = no flash. */
    const flashMs = async () => {
      const log = await railStateLog();
      return log.length > 1 ? log[1].at - log[0].at : 0;
    };
    const railKeys = () =>
      page.evaluate((prefix) => {
        const out: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(prefix)) out.push(`${key}=${window.localStorage.getItem(key)}`);
        }
        return out.sort();
      }, FILTER_RAIL_STORAGE_PREFIX);

    // The "other viewer" is a real second walk persona, so the scoping proof is
    // a real foreign profile id, not a made-up uuid.
    const otherEmail = walkRole() === 'admin' ? FIXTURE.users.operator.email : FIXTURE.users.admin.email;
    const otherRes = await request.get(`${REST}/profiles?email=eq.${encodeURIComponent(otherEmail)}&select=id`, {
      headers: REST_HEADERS,
    });
    const otherProfileId = ((await otherRes.json()) as Array<{ id: string }>)[0]?.id;
    expect(otherProfileId, `the local fixture must have a ${otherEmail} profile to scope against`).toBeTruthy();

    await page.goto(LIST, { waitUntil: 'domcontentloaded' });
    await expect(showing()).toBeVisible({ timeout: 30_000 });
    const railTitle = (await rail().getAttribute('aria-label')) ?? '';

    await walk.task(
      'LS-rail-remembered',
      'Collapse the rail → other module → back → reload: still collapsed on the first frame; re-open persists; another viewer gets the default',
      2,
      async () => {
        walk.note('railTitle', railTitle);
        expect(await railState(), 'a fresh viewer starts on the default (open) rail').toBe('open');

        await walk.click(page.getByRole('button', { name: `Collapse ${railTitle}` }), 'Collapse the rail');
        await expect(rail()).toHaveAttribute('data-state', 'collapsed');
        const afterCollapse = await railKeys();
        walk.note('storedKeys', afterCollapse.join(' | ') || '(none)');
        expect(afterCollapse.length, 'exactly one rail key is written, and it is viewer-scoped').toBe(1);
        expect(afterCollapse[0], 'the rail key must carry the viewer id (crm.filter-rail.u:<profile>:<module>)').toMatch(
          /^crm\.filter-rail\.u:[0-9a-f-]{36}:contacts=0$/,
        );

        // Another module and back — the collapse must survive the round trip.
        await page.goto('/crm/modules/members', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('crm-filter-rail')).toBeVisible({ timeout: 30_000 });
        await page.goto(LIST, { waitUntil: 'domcontentloaded' });
        await expect(showing()).toBeVisible({ timeout: 30_000 });
        walk.note('stateAfterModuleHop', await railState());
        expect(await railState(), 'the collapse must survive a module hop').toBe('collapsed');

        // …and a hard reload. The recorded sequence (every distinct data-state
        // since document start) is kept for the first-frame assertion, which
        // runs LAST so a flash does not cost the rest of this row's evidence.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(showing()).toBeVisible({ timeout: 30_000 });
        expect(await railState(), 'the collapse must survive a reload').toBe('collapsed');
        const collapsedSequence = await stateSequence();
        walk.note('stateSequenceAfterReload', collapsedSequence);
        walk.note('flashMsAfterReload', await flashMs());

        // Restore it open — that must persist too.
        await walk.click(page.getByTestId('crm-filter-toggle'), `Show ${railTitle}`);
        await expect(rail()).toHaveAttribute('data-state', 'open');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(showing()).toBeVisible({ timeout: 30_000 });
        walk.note('stateAfterRestore', await railState());
        walk.note('storedAfterRestore', (await railKeys()).join(' | ') || '(none)');
        expect(await railState(), 're-opening the rail must persist as well').toBe('open');
        expect(await stateSequence(), 'the re-opened rail must render open on the first frame').toBe('open');

        // Per-viewer scoping: hand the browser the OTHER persona's collapsed
        // state plus the pre-scoping unscoped key, and take this viewer's own
        // key away. Neither may be read — this viewer gets the default.
        const mineKey = (await railKeys()).map((entry) => entry.split('=')[0]).find((k) => k.endsWith(`:${FIXTURE.anchor.moduleKey}`));
        expect(mineKey, 'this viewer must have a stored rail key for the contacts list').toBeTruthy();
        const foreignKey = filterRailStorageKey(FIXTURE.anchor.moduleKey, otherProfileId!);
        const legacyKey = legacyFilterRailStorageKey(FIXTURE.anchor.moduleKey);
        walk.note('foreignKey', foreignKey);
        expect(foreignKey, 'the foreign key must differ from this viewer\'s').not.toBe(mineKey);
        await page.evaluate(
          ([mine, foreign, legacy]) => {
            window.localStorage.removeItem(mine);
            window.localStorage.setItem(foreign, '0');
            window.localStorage.setItem(legacy, '0');
          },
          [mineKey!, foreignKey, legacyKey] as const,
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(showing()).toBeVisible({ timeout: 30_000 });
        const stateForOtherViewer = await railState();
        walk.note('stateWithOnlyForeignKeys', stateForOtherViewer);
        walk.note('keysAfterForeignReload', (await railKeys()).join(' | ') || '(none)');
        expect(
          stateForOtherViewer,
          'another viewer\'s saved rail state (and the legacy unscoped key) must never be read — this viewer gets the default',
        ).toBe(FILTER_RAIL_DEFAULT_OPEN ? 'open' : 'collapsed');
        expect(
          await page.evaluate((key) => window.localStorage.getItem(key), legacyKey),
          'the pre-scoping unscoped key is purged, never read',
        ).toBeNull();
        expect(
          await page.evaluate((key) => window.localStorage.getItem(key), foreignKey),
          "another viewer's key is left untouched, not stolen",
        ).toBe('0');

        // LAST, so everything above is recorded even when this is red: the
        // stored state must be on screen from the FIRST rendered frame. A
        // settled read would hide an open-then-snap flash, so the assertion is
        // on the whole sequence — 'open → collapsed' means the viewer watched
        // the rail snap shut after paint.
        expect(collapsedSequence, 'the rail must render collapsed on the first frame (no open-then-snap flash)').toBe(
          'collapsed',
        );
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// LS-trim-surface (LS-9 / decision D11) — with `crm.lists.trim_surface` ON for
// PIFH the Zoho-leftover related-module filters sit behind "Show all" and the
// pipeline/schedule view modes behind "More views"; with the flag OFF the
// surface is the untrimmed one (hidden, never removed). The flag is flipped on
// the LOCAL stack only and restored to its prior value in `finally`.
// ---------------------------------------------------------------------------
const TRIM_FLAG_KEY = 'crm.lists.trim_surface';
/**
 * Mirrors the catalogues the trim reads from — FilterSidebar `RELATED_MODULES`
 * (27 rows, 17 of them `defaultHidden`) and ViewModeSwitcher
 * `VIEW_MODE_OPTIONS` (7 choosable modes) trimmed to ModuleShell's
 * `PRIMARY_VIEW_MODES` (table / list / split). Exact numbers on purpose: this
 * row is the evidence for "27 → 10" and "7 → 3".
 */
const TRIM = { relatedOn: 10, relatedOff: 27, viewModesOn: 3, viewModesOff: 7 } as const;

test.describe('list surface trim (LS-9 / D11)', () => {
  test('flag ON trims related modules + view modes behind a reveal; flag OFF is the full surface', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(isMobileProject(project), 'the docked rail + toolbar switcher are lg+ chrome');
    await assertTrapsInTest({ page, request, bareRequest, project });

    const flagUrl = `${REST}/crm_feature_flags?flag_key=eq.${TRIM_FLAG_KEY}&organization_id=eq.${PIFH_ORG_ID}`;
    const readFlag = async (): Promise<boolean | null> => {
      const res = await request.get(`${flagUrl}&select=enabled`, { headers: REST_HEADERS });
      const rows = (await res.json()) as Array<{ enabled: boolean }>;
      return rows.length > 0 ? rows[0].enabled : null;
    };
    const setFlag = async (enabled: boolean) => {
      const res = await request.patch(flagUrl, { headers: REST_HEADERS, data: { enabled } });
      expect(res.status(), `set ${TRIM_FLAG_KEY}=${enabled}`).toBeLessThan(300);
    };
    const priorFlag = await readFlag();
    expect(priorFlag, `the local fixture must carry a PIFH ${TRIM_FLAG_KEY} row (seed-walk-fixture.mjs)`).not.toBeNull();

    const showing = () => page.getByTestId('crm-pager-showing').first();
    const rail = () => page.locator('[data-testid="crm-filter-rail"][data-state="open"]');
    // Each related-module row wraps its Has/None pair in `role=group`
    // aria-label="{label} condition" — one group per rendered row.
    const relatedRows = () => rail().locator('[role="group"][aria-label$=" condition"]');
    const showAllRelated = () => rail().getByRole('button', { name: /^Show all \(\d+ more related modules\)$/ });
    const viewRadios = () => page.getByRole('radiogroup', { name: 'View mode' }).locator('visible=true').first().getByRole('radio');
    const moreViews = () => page.getByRole('button', { name: 'More views' }).locator('visible=true');
    const openRelatedSection = async (label: string) => {
      const trigger = rail().getByRole('button', { name: /^Filter By Related Modules/ });
      await expect(trigger, 'the rail must offer a Filter By Related Modules section').toBeVisible({ timeout: 30_000 });
      await walk.click(trigger, label);
      await expect(relatedRows().first()).toBeVisible({ timeout: 15_000 });
    };

    try {
      if (priorFlag !== true) await setFlag(true);
      await page.goto(LIST, { waitUntil: 'domcontentloaded' });
      await expect(showing()).toBeVisible({ timeout: 30_000 });

      await walk.task(
        'LS-trim-surface',
        'Flag ON: related modules 10 + "Show all (17 more)" → 27, view modes 3 + "More views" → 7; flag OFF: the full surface, no reveal',
        4,
        async () => {
          walk.note('flagBefore', String(priorFlag));
          await expect(rail(), 'the docked rail must be open to read the trimmed surface').toBeVisible({ timeout: 30_000 });

          // ── Related-module filters: trimmed, with the rest one click away ──
          await openRelatedSection('Filter By Related Modules (flag on)');
          const trimmed = await relatedRows().count();
          walk.note('relatedRowsTrimmed', trimmed);
          expect(trimmed, 'the trimmed rail lists only the modules a health-share desk uses').toBe(TRIM.relatedOn);
          const showAllLabel = ((await showAllRelated().textContent()) ?? '').replace(/\s+/g, ' ').trim();
          walk.note('showAllLabel', showAllLabel);
          const hidden = firstInt(showAllLabel);
          expect(hidden, 'the "Show all" affordance must say how many rows are hidden').not.toBeNull();
          expect(trimmed + (hidden ?? 0), 'trimmed + hidden must be the whole catalogue (hidden, never removed)').toBe(
            TRIM.relatedOff,
          );
          await walk.click(showAllRelated(), 'Show all related modules');
          await expect.poll(() => relatedRows().count(), { timeout: 15_000 }).toBe(TRIM.relatedOff);
          walk.note('relatedRowsRevealed', await relatedRows().count());

          // ── View modes: the primary three, the rest behind "More views" ──
          const onRadios = await viewRadios().count();
          walk.note('viewModeRadiosTrimmed', onRadios);
          expect(onRadios, 'only the primary view modes stay as radios').toBe(TRIM.viewModesOn);
          await expect(moreViews().first(), 'the trimmed switcher must offer a "More views" reveal').toBeVisible();
          await walk.click(moreViews().first(), 'More views');
          const moreItems = await page.getByRole('menuitemradio').count();
          walk.note('viewModeMenuItems', moreItems);
          expect(onRadios + moreItems, 'radios + menu must be the whole view-mode catalogue').toBe(TRIM.viewModesOff);
          await walk.press('Escape', 'close More views');

          // ── Flag OFF: byte-identical to the pre-flag surface ──
          await setFlag(false);
          await page.goto(LIST, { waitUntil: 'domcontentloaded' });
          await expect(showing()).toBeVisible({ timeout: 30_000 });
          await openRelatedSection('Filter By Related Modules (flag off)');
          const untrimmed = await relatedRows().count();
          walk.note('relatedRowsFlagOff', untrimmed);
          expect(untrimmed, 'flag off renders every related module, no reveal').toBe(TRIM.relatedOff);
          expect(await showAllRelated().count(), 'flag off hides nothing, so there is nothing to "Show all"').toBe(0);
          const offRadios = await viewRadios().count();
          walk.note('viewModeRadiosFlagOff', offRadios);
          expect(offRadios, 'flag off renders every view mode as a radio').toBe(TRIM.viewModesOff);
          expect(await moreViews().count(), 'flag off has no "More views" overflow').toBe(0);
        },
        { soft: true },
      );
    } finally {
      if (priorFlag !== null) await setFlag(priorFlag);
      const restored = await readFlag();
      expect(restored, `${TRIM_FLAG_KEY} must be restored to its prior value`).toBe(priorFlag);
    }
  });
});
