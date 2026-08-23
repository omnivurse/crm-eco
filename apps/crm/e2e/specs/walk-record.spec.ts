/**
 * EV-5 — record page: T6 inline field patch (D7: silent emerald check + aria-live,
 * no toast), header density at rest (D6), and "reload keeps the Notes pane".
 *
 * T6 writes ONE text field on the fixture anchor and restores it in the next
 * task, so the seed stays as the other specs expect it (local DB only).
 */
import { expect, test } from '../walk-fixture';
import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { isBelowLg, isMobileProject, modKey, nudgeIntoClickableView, runSuffix, toastTitles, trackRequests } from '../walk-helpers';
import { movedToTrash, restored } from '../../src/lib/crm/toast-copy';

/** Inline-editable text cells on the contacts overview, most harmless first. */
const T6_FIELD_CANDIDATES = ['preferred_name', 'middle_name', 'referring_member', 'mailing_city'] as const;

test.describe('record page walk', () => {
  test('T6 patch one field inline + header density at rest', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    // T6/T6-aria-live/T6-restore all PATCH the anchor; crm_viewer is refused with
    // 403 and the whole test aborts before RP-header-density. Header density is
    // role-independent and already recorded on operator + admin at all three
    // breakpoints, so the viewer run skips the test rather than half-running it.
    test.skip(walkRole() === 'viewer', 'crm_viewer cannot PATCH a record (403) — see DE-viewer-post-403');
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();

    const patches = trackRequests(page, new RegExp(`/api/crm/records/${anchor!.id}(\\?|$)`));
    const suffix = runSuffix();
    let fieldKey: string | null = null;
    let original = '';

    const patchField = async (key: string, value: string, label: string) => {
      const cell = page.locator(`[data-field-key="${key}"]`).first();
      const edit = cell.locator('[role="button"][aria-label^="Edit "]').first();
      // Mobile: the sticky record header + pane tabs + action bar cover most of
      // the viewport, so a plain scroll-into-view lands the cell under chrome.
      // Nudging is not a counted action; the count is recorded as evidence.
      walk.note(`${label}.scrollNudges`, await nudgeIntoClickableView(edit));
      await walk.click(edit, `${label}: click to edit`);
      const input = cell.locator('input, textarea').first();
      await expect(input).toBeFocused();
      const before = await input.inputValue();
      const patchesBefore = patches.filter((r) => r.method === 'PATCH').length;
      await walk.type(input, value, `${label}: type`);
      await walk.press('Tab', `${label}: blur → save`);
      await expect
        .poll(() => patches.filter((r) => r.method === 'PATCH' && r.status !== null).length, {
          timeout: 20_000,
          message: 'a PATCH /api/crm/records/<id> must complete',
        })
        .toBeGreaterThan(patchesBefore);
      const patch = patches.filter((r) => r.method === 'PATCH').at(-1)!;
      walk.note(`${label}.patchStatus`, patch.status);
      expect(patch.status).toBeGreaterThanOrEqual(200);
      expect(patch.status).toBeLessThan(300);
      // D7: silent emerald check in the cell — no toast.
      await expect(cell.locator('svg.lucide-check')).toBeVisible({ timeout: 10_000 });
      walk.note(`${label}.savedToast`, await toastTitles(page).filter({ hasText: /saved/i }).count());
      expect(await toastTitles(page).filter({ hasText: /saved/i }).count(), 'inline save must not toast (D7)').toBe(0);
      // D7 also wants an aria-live "Saved" announcement — recorded, asserted by the soft follow-up.
      walk.note(`${label}.ariaLiveSaved`, (await page.locator('[aria-live]').filter({ hasText: /\bsaved\b/i }).count()) > 0);
      return before;
    };

    await walk.task('T6', 'Patch one text field inline (click → type → blur → saved check)', 1, async () => {
      for (const key of T6_FIELD_CANDIDATES) {
        const edit = page.locator(`[data-field-key="${key}"] [role="button"][aria-label^="Edit "]`).first();
        if ((await edit.count()) > 0 && (await edit.isVisible())) {
          fieldKey = key;
          break;
        }
      }
      walk.note('field', fieldKey);
      expect(fieldKey, `none of ${T6_FIELD_CANDIDATES.join(', ')} is an inline-editable visible cell`).not.toBeNull();
      original = await patchField(fieldKey!, `Walk T6 ${suffix}`, 'T6');
      walk.note('originalWasEmpty', original.trim() === '');
    });

    await walk.task(
      'T6-aria-live',
      'Inline save announces "Saved" through an aria-live region (D7)',
      0,
      async () => {
        const live = page.locator('[aria-live]').filter({ hasText: /\bsaved\b/i });
        await expect(live.first()).toBeVisible({ timeout: 3_000 });
      },
      { soft: true },
    );

    await walk.task(
      'T6-restore',
      'Restore the field to its seeded value',
      1,
      async () => {
        if (!fieldKey) throw new Error('T6 did not patch a field — nothing to restore');
        await patchField(fieldKey, original, 'restore');
      },
      { soft: true },
    );

    await walk.task(
      'RP-header-density',
      'Record header at rest (D6): one search input, no dashed Add Tags pill, no admin badges for crm_agent, one Email action below lg',
      0,
      async () => {
        await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();
        // RP-3 / D6a contract: the record header owns ONE search affordance — the
        // find-in-record input (collapsed at rest, reachable by the `/` hotkey).
        // The V1-era global "Search records..." box must be gone; ⌘K is global.
        const globalSearch = page.locator('input[placeholder="Search records..."]:visible');
        const findInRecord = page.locator('input[data-inline-record-search]');
        const findVisibleAtRest = await findInRecord.locator('visible=true').count();
        walk.note('searchInputs.globalInHeader', await globalSearch.count());
        walk.note('searchInputs.findInRecordVisibleAtRest', findVisibleAtRest);
        let findReachableBySlash = findVisibleAtRest > 0;
        if (!findReachableBySlash && !isBelowLg(page)) {
          // A restored scroll position compacts the header (breadcrumb row +
          // find box hidden); `/` must un-compact and focus the box. Keypresses
          // are tallied but not budgeted.
          await walk.press('/', 'find-in-record hotkey');
          findReachableBySlash = await expect(findInRecord.first())
            .toBeVisible({ timeout: 2_000 })
            .then(
              () => true,
              () => false,
            );
          walk.note('searchInputs.findFocusedBySlash', findReachableBySlash && (await findInRecord.first().evaluate((el) => el === document.activeElement)));
          await walk.press('Escape', 'leave find-in-record');
        }
        walk.note('searchInputs.findReachableBySlash', findReachableBySlash);
        // Below lg the find box is md+ only — the contract there is simply "no second box".
        const searchInputs = (await globalSearch.count()) + (findReachableBySlash ? 1 : 0);
        walk.note('searchInputs', searchInputs);

        // RP-5 / D6c: the dashed pill exists for Tab/touch but is opacity-0 at
        // rest on a tagless record (Playwright's :visible ignores opacity).
        const addTags = page.locator('button:visible', { hasText: /^Add Tags$/ });
        const addTagsShownAtRest = await addTags.evaluateAll((els) =>
          els.filter((el) => Number.parseFloat(getComputedStyle(el).opacity) > 0).length,
        );
        walk.note('addTagsPillCount', await addTags.count());
        walk.note('addTagsPillAtRest', addTagsShownAtRest);

        const adminBadges = page.getByText(/needs (review|classification)/i);
        walk.note('adminBadges', await adminBadges.count());
        walk.note('role', walkRole());

        const belowLg = isBelowLg(page);
        walk.note('belowLg', belowLg);
        let emailActions = -1;
        if (belowLg) {
          emailActions = await page.locator('button:visible, a:visible').filter({ hasText: /^\s*(send )?email\s*$/i }).count();
          walk.note('emailActionsBelowLg', emailActions);
        }

        const problems: string[] = [];
        if (belowLg) {
          if ((await globalSearch.count()) > 0) problems.push('V1 global search box still in the record header');
        } else if (searchInputs !== 1) {
          problems.push(`${searchInputs} search affordances in the header (want 1: find-in-record, visible or via "/")`);
        }
        if (addTagsShownAtRest > 0) problems.push('dashed "Add Tags" pill visible at rest');
        if (walkRole() === 'operator' && (await adminBadges.count()) > 0) problems.push('admin-only Needs Review/Classification badge shown to crm_agent');
        if (belowLg && emailActions > 1) problems.push(`${emailActions} Email actions below lg (want 1)`);
        expect(problems, problems.join('; ')).toEqual([]);
      },
      { soft: true },
    );
  });

  test('reload keeps the Notes pane', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();

    await walk.task(
      'RP-notes-pane-reload',
      'Open the Notes pane (1 click), reload, still on Notes',
      1,
      async () => {
        const notesTab = page.getByRole('tab', { name: /^Notes/ }).first();
        const viewAll = page.getByRole('region', { name: 'Recent notes' }).getByRole('button', { name: /^View all$/ });
        if ((await notesTab.count()) > 0 && (await notesTab.isVisible())) {
          await walk.click(notesTab, 'Notes pane chip');
        } else {
          await walk.click(viewAll, 'Recent notes → View all');
        }
        await expect(page.getByRole('tab', { name: /^Notes/ }).first()).toHaveAttribute('aria-selected', 'true');
        walk.note('urlAfterPane', new URL(page.url()).search || '(no query)');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();
        const tabAfter = page.getByRole('tab', { name: /^Notes/ }).first();
        await expect(tabAfter, 'after reload the Notes pane must still be the active pane').toHaveAttribute('aria-selected', 'true', {
          timeout: 15_000,
        });
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// RP-6 evidence — the ⋯ Insights door below xl and the header skip link.
// ---------------------------------------------------------------------------
test.describe('record chrome (RP-6)', () => {
  test('Insights opens from ⋯ below xl; skip link reaches the section nav', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();

    await walk.task(
      'RP-6-insights-door',
      'Below xl (right rail hidden): ⋯ → Insights opens the Insights sheet (2 clicks)',
      2,
      async () => {
        const width = page.viewportSize()?.width ?? 0;
        if (width >= 1280) {
          walk.note('skipped', 'xl+ shows the right rail itself');
          return;
        }
        await walk.click(page.getByTestId('crm-record-more'), '⋯ menu');
        const item = page.getByTestId('crm-record-more-insights');
        await expect(item, 'the ⋯ menu must carry an Insights door below xl').toBeVisible();
        await walk.click(item, 'Insights');
        const sheet = page.getByRole('dialog').filter({ hasText: 'Insights' }).first();
        await expect(sheet).toBeVisible();
        walk.note('sheetSeen', true);
        await walk.press('Escape', 'close the sheet');
      },
      { soft: true },
    );

    await walk.task(
      'RP-6-skip-link',
      'The skip link is the header\'s first Tab stop; Enter lands focus on the section nav (0 clicks)',
      0,
      async () => {
        await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();
        // Contract: the skip link is the FIRST focusable inside the record
        // header, so the first Tab that enters the header lands on it (the
        // global chrome before it is NV-scope, not RP-6's).
        const firstInHeader = await page.evaluate(() => {
          const header = document.querySelector('[data-record-find-root]');
          const focusable = header?.querySelector<HTMLElement>(
            'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
          );
          return focusable?.dataset?.testid ?? focusable?.tagName ?? null;
        });
        walk.note('firstFocusableInHeader', firstInHeader);
        expect(firstInHeader, 'the skip link must be the first focusable in the record content').toBe('crm-record-skip-link');
        await page.evaluate(() => {
          document.querySelector<HTMLElement>('[data-testid="crm-record-skip-link"]')?.focus();
        });
        await expect(page.getByTestId('crm-record-skip-link')).toBeVisible();
        await walk.press('Enter', 'activate skip link');
        await expect
          .poll(() => page.evaluate(() => document.activeElement?.id ?? null), { timeout: 5_000 })
          .toBe('record-section-nav');
      },
      { soft: true },
    );
  });

  test('RP-8 record open CLS < 0.05', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    // Buffered layout-shift observer on every future document in this page.
    await page.addInitScript(() => {
      (window as unknown as { __walkCls: number }).__walkCls = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as unknown as { value: number; hadRecentInput: boolean };
            if (!shift.hadRecentInput) {
              (window as unknown as { __walkCls: number }).__walkCls += shift.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {
        /* layout-shift unsupported → cls stays 0 and the note says so */
      }
    });
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();

    await walk.task(
      'RP-8-cls',
      'Cumulative layout shift while the record page opens and settles (< 0.05)',
      0,
      async () => {
        await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('crm-record-snapshot').first()).toBeVisible();
        await page.waitForTimeout(2_000);
        const cls = await page.evaluate(() => (window as unknown as { __walkCls?: number }).__walkCls ?? 0);
        walk.note('cls', Math.round(cls * 1000) / 1000);
        expect(cls, `record-open CLS ${cls}`).toBeLessThan(0.05);
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// FB-5 — deleting from the record page moves to Trash with a working Undo.
// A throwaway walk record is created via the API so the seed stays intact.
// ---------------------------------------------------------------------------
test.describe('record delete (FB-5)', () => {
  test("delete → 'Moved to Trash · Undo' → Undo restores", async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    // records/[id] DELETE requires crm_admin | crm_manager — the agent persona
    // is refused with 403, so this walks the admin persona.
    test.skip(walkRole() !== 'admin', 'run with WALK_ROLE=admin (delete is manager/admin-only)');
    test.skip(isMobileProject(project), 'the ⋯ menu walk is lg+ evidence; desktop/tablet cover FB-5');
    await assertTrapsInTest({ page, request, bareRequest, project });
    const suffix = runSuffix();

    const modsRes = await request.get('/api/crm/modules');
    expect(modsRes.status()).toBe(200);
    const mods = (await modsRes.json()) as Array<{ id: string; org_id: string; key: string }>;
    const contacts = mods.find((m) => m.key === 'contacts')!;
    const createRes = await request.post('/api/crm/records', {
      data: {
        org_id: contacts.org_id,
        module_id: contacts.id,
        data: { first_name: 'Walk', last_name: `Trash${suffix}`, walk_fixture: 'true' },
      },
    });
    expect(createRes.status(), 'fixture create for the delete walk').toBeLessThan(300);
    const created = (await createRes.json()) as { id?: string; record?: { id?: string } };
    const recordId = created.id ?? created.record?.id;
    expect(recordId).toBeTruthy();

    await page.goto(`/crm/r/${recordId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();

    await walk.task(
      'FB-5-delete-undo',
      "⋯ → Delete Record → honest confirm → 'Moved to Trash' toast → Undo restores (4 clicks)",
      4,
      async () => {
        await walk.click(page.getByTestId('crm-record-more'), '⋯ menu');
        await walk.click(page.getByRole('menuitem', { name: 'Delete Record' }), 'Delete Record');
        const dialog = page.getByRole('alertdialog').filter({ hasText: 'It moves to Trash' }).first();
        await expect(dialog, "confirm copy must say it moves to Trash (not 'cannot be undone')").toBeVisible();
        walk.note('confirmCopy', (await dialog.textContent())?.replace(/\s+/g, ' ').slice(0, 160) ?? '');
        await walk.click(dialog.getByRole('button', { name: 'Delete', exact: true }), 'confirm Delete');
        const toast = toastTitles(page).filter({ hasText: movedToTrash() }).first();
        await expect(toast).toBeVisible({ timeout: 20_000 });
        const undo = page.locator('[data-sonner-toast] button').filter({ hasText: /^Undo$/ }).first();
        await expect(undo, 'the Trash toast must offer Undo').toBeVisible();
        await walk.click(undo, 'Undo');
        await expect(toastTitles(page).filter({ hasText: restored('Record') }).first()).toBeVisible({ timeout: 20_000 });
        await expect(page).toHaveURL(new RegExp(`/crm/r/${recordId}`), { timeout: 20_000 });
        await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 30_000 });
      },
      { soft: true },
    );

    // Leave nothing behind: back to Trash; the preflight prune clears walk rows.
    await request.delete(`/api/crm/records/${recordId}`);
  });
});

// ---------------------------------------------------------------------------
// RP-M2 — the healthy path renders NO layout notice (never fails open with a
// silent one-section form). The layout fetch itself is a server-side Supabase
// call, so the browser cannot throttle it — the error/missing banner contract
// is pinned by RecordLayoutNotice.test.tsx instead.
// ---------------------------------------------------------------------------
test.describe('record layout notice (RP-M2)', () => {
  test('healthy record: no layout notice, sectioned form present', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();

    await walk.task(
      'RP-M2-layout-notice',
      'No crm-record-layout-notice on the healthy path; snapshot + section nav render',
      0,
      async () => {
        walk.note('notices', await page.locator('[data-testid^="crm-record-layout-notice"]').count());
        expect(await page.locator('[data-testid^="crm-record-layout-notice"]').count()).toBe(0);
        await expect(page.getByTestId('crm-record-snapshot').first()).toBeVisible();
        walk.note(
          'throttleEvidence',
          'layout fetch is server-side (getDefaultLayout) — browser throttling cannot reach it; banner contract covered by RecordLayoutNotice.test.tsx',
        );
      },
      { soft: true },
    );
  });
});

// ---------------------------------------------------------------------------
// RP-4 — the admin persona still sees the Needs Review badge the agent header
// hides. Local-only PostgREST write flips the anchor to needs_review for the
// check and restores the original value afterwards.
// ---------------------------------------------------------------------------
test.describe('normalization badge (RP-4, WALK_ROLE=admin)', () => {
  test('admin sees Needs Review in the header meta row', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(walkRole() !== 'admin', 'run with WALK_ROLE=admin');
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();

    const restHeaders = {
      apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    const rest = `${LOCAL_SUPABASE_URL}/rest/v1/crm_records?id=eq.${anchor!.id}&select=normalization_status`;
    const before = await request.get(rest, { headers: restHeaders });
    const original = ((await before.json()) as Array<{ normalization_status: string | null }>)[0]?.normalization_status ?? null;

    try {
      await request.patch(rest, { headers: restHeaders, data: { normalization_status: 'needs_review' } });
      await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();

      await walk.task(
        'RP-4-admin-badge',
        'crm_admin: the Needs Review badge is visible in the header at rest (0 clicks)',
        0,
        async () => {
          walk.note('originalStatus', original);
          await expect(page.getByText('Needs Review', { exact: true }).first()).toBeVisible();
          walk.note('needsReviewVisible', true);
        },
        { soft: true },
      );
    } finally {
      await request.patch(rest, { headers: restHeaders, data: { normalization_status: original } });
    }
  });
});

// ---------------------------------------------------------------------------
// FB-M1 — toasts follow the CRM theme: in dark mode the sonner toaster carries
// data-sonner-theme="dark" (screenshot recorded for the regrade).
// ---------------------------------------------------------------------------
test.describe('dark-mode toast (FB-M1)', () => {
  test('a toast raised in dark mode renders on the dark toaster', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    // ui-theme in localStorage wins over the profile (theme-provider.tsx).
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('ui-theme', 'dark');
      } catch {
        /* ignore */
      }
    });
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')), {
        message: 'ui-theme=dark must flip the root class',
      })
      .toBe(true);

    await walk.task(
      'FB-M1-dark-toast',
      "Add a note in dark mode → the toast paints on sonner's dark theme",
      1,
      async () => {
        const headerButton = page.getByTestId('crm-record-add-note');
        const mobileNote = page.locator("nav[aria-label='Quick actions'] button", { hasText: /^Note$/ });
        if (await headerButton.isVisible()) await walk.click(headerButton, 'Add Note');
        else await walk.click(mobileNote, 'Note (action bar)');
        const editor = page.getByTestId('crm-notes-composer').locator('[contenteditable]').first();
        await walk.type(editor, `Walk FB-M1 ${runSuffix()}`, 'type the note');
        await walk.press(`${modKey()}+Enter`, '⌘Enter saves');
        await expect(toastTitles(page).first()).toBeVisible({ timeout: 20_000 });
        const toasterTheme = await page.locator('[data-sonner-toaster]').first().getAttribute('data-sonner-theme');
        walk.note('toasterTheme', toasterTheme);
        await walk.shot('dark-mode toast');
        expect(toasterTheme, 'toaster must follow the dark theme').toBe('dark');
      },
      { soft: true },
    );
  });
});


// ---------------------------------------------------------------------------
// PERM-1 — the agent persona is never offered an action the API refuses.
// DELETE /api/crm/records/[id] and PATCH|DELETE /api/crm/records/bulk both
// answer 403 to crm_agent, so the record ⋯ menu must carry no Delete Record
// item and the list MassActionsBar no Assign / Status / Delete button.
// (The list half lives here, not in walk-lists, to keep PERM-1 in one file.)
// ---------------------------------------------------------------------------
test.describe('manager-only actions hidden from crm_agent (PERM-1)', () => {
  test('no delete dead end on the record page or the bulk bar', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(walkRole() !== 'operator', 'PERM-1 is the crm_agent contract (default WALK_ROLE)');
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();

    await walk.task(
      'PERM-1-record-delete',
      'crm_agent: the record ⋯ menu offers no Delete Record (the route 403s them) — 1 click',
      1,
      async () => {
        // The server contract this mirrors, proven in the same run.
        const refused = await request.delete(`/api/crm/records/${anchor!.id}`);
        walk.note('deleteStatus', refused.status());
        expect(refused.status(), 'DELETE /api/crm/records/[id] must 403 the agent').toBe(403);

        await walk.click(page.getByTestId('crm-record-more'), '⋯ menu');
        const menu = page.getByRole('menu').first();
        await expect(menu).toBeVisible();
        const deleteItem = page.getByRole('menuitem', { name: 'Delete Record' });
        walk.note('deleteItems', await deleteItem.count());
        walk.note('deleteTestIds', await page.getByTestId('crm-record-delete').count());
        expect(await deleteItem.count(), 'crm_agent must not be offered Delete Record').toBe(0);
        expect(await page.getByTestId('crm-record-delete').count()).toBe(0);
        // Hidden, not emptied: the menu still carries its agent-legal items.
        await expect(page.getByRole('menuitem', { name: /^Clone Record$/ })).toBeVisible();
        await walk.press('Escape', 'close the ⋯ menu');
      },
      { soft: true },
    );

    await walk.task(
      'PERM-1-bulk-actions',
      'crm_agent: selecting a row offers no Assign / Status / Delete on the bulk bar — 1 click',
      1,
      async () => {
        const refused = await request.patch('/api/crm/records/bulk', {
          data: { record_ids: [anchor!.id], updates: { status: 'Active' } },
        });
        walk.note('bulkPatchStatus', refused.status());
        expect(refused.status(), 'PATCH /api/crm/records/bulk must 403 the agent').toBe(403);

        if (isMobileProject(project)) {
          // Same line the LS-5 bulk row draws: the bulk bar is lg+ chrome.
          walk.note('skipped', 'bulk bar is lg+ chrome (see LS-5-bulk-recount)');
          return;
        }
        await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('crm-pager-showing').first()).toBeVisible({ timeout: 30_000 });
        await walk.click(page.getByRole('checkbox', { name: 'Select all rows' }), 'select the rows');

        const bar = page.getByText(/\d+ selected/).locator('visible=true').first();
        await expect(bar, 'the bulk bar must appear on selection').toBeVisible({ timeout: 15_000 });
        for (const [key, testid] of [
          ['assign', 'crm-bulk-assign'],
          ['status', 'crm-bulk-status'],
          ['delete', 'crm-bulk-delete'],
        ] as const) {
          const count = await page.getByTestId(testid).locator('visible=true').count();
          walk.note(`bulk.${key}`, count);
          expect(count, `crm_agent must not be offered bulk ${key}`).toBe(0);
        }
        // Export stays: GET, and the agent-legal Add Tag route is POST /api/crm/tags.
        walk.note('bulk.exportStillOffered', await page.getByRole('button', { name: /export/i }).locator('visible=true').count());
      },
      { soft: true },
    );
  });
});
