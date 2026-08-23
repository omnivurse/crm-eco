/**
 * EV-5 — the A+ persona tasks T1–T5 (decision D12 budgets).
 *
 *   T1 find by phone      ⌘K → digits → Records bucket → Enter      2 keypresses + digits / 2 clicks (mobile)
 *   T2 coverage at a glance  0 clicks on the record page
 *   T3 Add Note           1 click + ⌘Enter, then again with the `n` hotkey (0 clicks)
 *   T4 Add Member         1 click + Enter (10 values by type+Tab in config order), ≤1 click to see it on the list (D1)
 *   T5 oldest Pending → Call   1 click from the desk, 2 clicks from /crm/modules/contacts
 *
 * Hard tasks (T1–T4) fail the test when the product misses the budget today;
 * soft tasks record pass=false (walk.json `reason`) and continue — they assert
 * work a later wave ships (D1 "see on list", the desk pending lane, the list
 * tel: anchor). Every action goes through `walk` so the tally stays honest.
 */
import { expect, test } from '../walk-fixture';
import { FIXTURE, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { added } from '../../src/lib/crm/toast-copy';
import {
  isFullyInViewport,
  isMobileProject,
  modKey,
  revealByScrolling,
  runSuffix,
  stubTelLinks,
  telHref,
  toastTitles,
  todayMdy,
  trackRequests,
  uniquePhone,
} from '../walk-helpers';

/** Quick-create contacts paste order (lib/crm/quick-create-config.ts) up to the last text field we fill. */
const T4_PASTE_ORDER: ReadonlyArray<{ key: string; value: ((ctx: { last: string; phone: string; email: string }) => string) | null }> = [
  { key: 'first_name', value: () => 'Walk' },
  { key: 'last_name', value: (c) => c.last },
  { key: 'phone', value: (c) => c.phone },
  { key: 'email', value: (c) => c.email },
  { key: 'date_of_birth', value: () => '01/15/1980' },
  { key: 'mailing_city', value: () => 'Austin' },
  { key: 'mailing_state', value: null }, // native <select> — Tab through, nothing typed
  { key: 'health_insurance_plan_name', value: () => 'Walk Health Plan' },
  { key: 'health_insurance_start_date', value: () => todayMdy() },
  // DE-1/D3: `product` is a native <select> of the org's tier-A options +
  // "Other…" — the keyboard paste is type-ahead, so the value is an option label.
  { key: 'product', value: () => 'Health Sharing' },
  { key: 'sharing_effective_date', value: () => todayMdy() },
];

test.describe('persona walk (D12)', () => {
  test('T1 find by phone', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor, 'fixture anchor (Wendy Walker) must resolve').not.toBeNull();

    await page.goto('/crm', { waitUntil: 'domcontentloaded' });

    await walk.task('T1', 'Find Wendy Walker by phone', 2, async () => {
      if (mobile) {
        await walk.click(page.getByTestId('crm-topbar-search-mobile'), 'open search');
      } else {
        await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
      }
      const input = page.getByTestId('crm-palette-input');
      await expect(input).toBeVisible();
      await walk.type(input, FIXTURE.anchor.phone, 'type phone digits');
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Records', { exact: true })).toBeVisible();
      const hit = dialog.getByTestId('crm-palette-result').filter({ hasText: /Wendy\s+Walker/i }).first();
      await expect(hit).toBeVisible();
      walk.note('records-bucket', true);
      if (mobile) {
        await walk.click(hit, 'open the first hit');
      } else {
        await walk.press('Enter', 'Enter opens the first hit');
      }
      await expect(page).toHaveURL(/\/crm\/r\/[0-9a-f-]{36}/);
      const landedId = new URL(page.url()).pathname.split('/').pop();
      walk.note('landedId', landedId ?? null);
      expect(landedId, 'Enter must open the contacts anchor (not the members twin)').toBe(anchor!.id);
      // The task ends when the record is readable, not when the URL flips: the
      // client-side transition streams the page (dev server: seconds).
      const t0 = Date.now();
      await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
      walk.note('renderMs', Date.now() - t0);
    });
  });

  test('T2 coverage at a glance', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor, 'fixture anchor (Wendy Walker) must resolve').not.toBeNull();
    // Full load of the record (T1 covers the palette transition); T2 is a 0-click read.
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });

    await walk.task('T2', 'Coverage at a glance — read without clicking', 0, async () => {
      await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
      const snapshot = page.getByTestId('crm-record-snapshot').first();
      await expect(snapshot).toBeVisible();
      const statusBadge = page.getByRole('button', { name: new RegExp(anchor!.status ?? 'Active') }).first();
      await expect(statusBadge).toBeVisible();
      const tel = page.locator(`a[href="${telHref(FIXTURE.anchor.phone)}"]`).first();
      await expect(tel).toBeVisible();
      await expect(snapshot.getByText(/Enrolled by/i).first()).toBeVisible();
      await expect(page.getByText(FIXTURE.anchor.memberNumber, { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('region', { name: 'Recent notes' })).toBeVisible();
      await walk.shot('coverage at a glance');
    });

    await walk.task(
      'T2-above-fold',
      'Coverage Snapshot, status, phone, Enrolled by, member #, Recent notes all inside the viewport (no scroll)',
      0,
      async () => {
        const checks: Array<[string, ReturnType<typeof page.locator>]> = [
          ['snapshot', page.getByTestId('crm-record-snapshot').first()],
          ['status', page.getByRole('button', { name: new RegExp(anchor!.status ?? 'Active') }).first()],
          ['tel', page.locator(`a[href="${telHref(FIXTURE.anchor.phone)}"]`).first()],
          ['enrolledBy', page.getByTestId('crm-record-snapshot').first().getByText(/Enrolled by/i).first()],
          ['memberNumber', page.getByText(FIXTURE.anchor.memberNumber, { exact: true }).first()],
          ['recentNotes', page.getByRole('region', { name: 'Recent notes' })],
        ];
        const missing: string[] = [];
        for (const [name, loc] of checks) {
          const inside = await isFullyInViewport(loc);
          walk.note(`inViewport.${name}`, inside);
          if (!inside) missing.push(name);
        }
        expect(missing, `below the fold at ${page.viewportSize()?.width}px: ${missing.join(', ')}`).toEqual([]);
      },
      { soft: true },
    );
  });

  test('T3 Add Note — button + ⌘Enter, then the n hotkey', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    // POST /api/crm/notes requires a writer role — crm_viewer is refused with 403,
    // so T3/T3-hotkey walk the writing personas. The viewer contract is asserted by
    // DE-viewer-post-403 (walk-viewer-api) and DE-viewer-no-create (walk-drawer).
    test.skip(walkRole() === 'viewer', 'crm_viewer cannot write notes (403) — see DE-viewer-post-403');
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();
    const notePosts = trackRequests(page, /\/api\/crm\/notes(\?|$)/);
    const suffix = runSuffix();

    const editorFocused = () =>
      page.evaluate(() => (document.activeElement as HTMLElement | null)?.isContentEditable === true);

    const composeAndSave = async (label: string, opts: { proveDraftSurvives?: boolean } = {}) => {
      await expect
        .poll(editorFocused, { message: 'focus must land in the contenteditable composer' })
        .toBe(true);
      const editor = page.getByTestId('crm-notes-composer').locator('[contenteditable]').first();
      const body = `Walk ${label} ${suffix}`;
      await walk.type(editor, body, 'type the note');

      if (opts.proveDraftSurvives) {
        // Task efficiency is only a 10 when an interrupted user cannot lose
        // work. Ask for the composer a SECOND time on top of a half-typed
        // note and prove the draft is still there. `n` is ignored while focus
        // sits in a contenteditable (useRecordHotkeys.shouldIgnoreEvent), so
        // Tab out first — keystrokes only, the row's 1-click budget stands.
        for (let i = 0; i < 3 && (await editorFocused()); i += 1) {
          await walk.press('Tab', 'Tab out of the composer');
        }
        expect(await editorFocused(), 'focus must leave the editor before the n hotkey can fire').toBe(false);
        await walk.press('n', "'n' again on top of a half-typed note");
        await expect(page.getByTestId('crm-notes-composer'), 'the composer must stay open').toHaveCount(1);
        const draft = ((await editor.innerText()) ?? '').trim();
        walk.note(`${label}.draftAfterSecondCompose`, draft.slice(0, 80));
        expect(draft, 'a second compose request must NOT wipe the half-typed note').toContain(body);
        // …and it puts the caret back, so ⌘Enter still saves without a click.
        expect(await editorFocused(), 'the re-opened composer must re-focus the editor').toBe(true);
        walk.note(`${label}.draftSurvivedSecondCompose`, true);
      }

      const before = notePosts.filter((r) => r.method === 'POST').length;
      await walk.press(`${modKey()}+Enter`, '⌘Enter saves');
      await expect
        .poll(() => notePosts.filter((r) => r.method === 'POST' && r.status !== null).length, { timeout: 20_000 })
        .toBeGreaterThan(before);
      const post = notePosts.filter((r) => r.method === 'POST').at(-1)!;
      walk.note(`${label}.postStatus`, post.status);
      expect(post.status, 'POST /api/crm/notes must be 2xx').toBeGreaterThanOrEqual(200);
      expect(post.status).toBeLessThan(300);
      const toast = toastTitles(page).filter({ hasText: added('Note') }).first();
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText(added('Note'));
    };

    await walk.task('T3', 'Add a note: Add Note → type → ⌘Enter, with no draft loss on a second compose', 1, async () => {
      const headerButton = page.getByTestId('crm-record-add-note');
      const mobileNote = page.locator("nav[aria-label='Quick actions'] button", { hasText: /^Note$/ });
      if (await headerButton.isVisible()) {
        await walk.click(headerButton, 'Add Note');
      } else {
        walk.note('entry', 'mobile action bar');
        await walk.click(mobileNote, 'Note (action bar)');
      }
      await composeAndSave('T3', { proveDraftSurvives: true });
    });

    await walk.task('T3-hotkey', "Add a note with the 'n' hotkey (no clicks)", 0, async () => {
      await expect(page.getByTestId('crm-notes-composer')).toHaveCount(0);
      await walk.press('n', "'n' hotkey");
      await composeAndSave('T3-hotkey');
    });
  });

  test('T4 Add Member — 1 click + Enter, then see it on the list (D1)', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    // canCreateRecords(crm_viewer) is false, so the Add Member affordance is not
    // rendered at all — the click would hang rather than prove anything. That
    // hiding IS the viewer contract, asserted by DE-viewer-no-create.
    test.skip(walkRole() === 'viewer', 'crm_viewer has no create affordance — see DE-viewer-no-create');
    await assertTrapsInTest({ page, request, bareRequest, project });
    // Contacts is the hand-entry module and the originating list (D1).
    await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
    const suffix = runSuffix();
    const ctx = {
      last: `Walk${suffix}`,
      phone: uniquePhone(),
      email: `walk.t4.${suffix.toLowerCase()}@example.invalid`,
    };
    let createdId: string | null = null;

    await walk.task('T4', 'Add Member: 1 click, 10 values by Tab, Enter', 1, async () => {
      const trigger = mobile ? page.getByTestId('crm-create-primary-mobile') : page.getByTestId('crm-create-primary');
      await walk.click(trigger, 'Add Member');
      await expect(page.getByTestId('crm-qc-form')).toBeVisible();
      await expect(page.locator('#qc-contacts-first_name')).toBeFocused();

      let typed = 0;
      for (let i = 0; i < T4_PASTE_ORDER.length; i++) {
        const step = T4_PASTE_ORDER[i];
        await expect(page.locator(':focus'), `tab order: expected qc-contacts-${step.key}`).toHaveAttribute('id', `qc-contacts-${step.key}`);
        if (step.value) {
          await walk.type(page.locator(':focus'), step.value(ctx), `type ${step.key}`);
          typed += 1;
        }
        if (i < T4_PASTE_ORDER.length - 1) await walk.press('Tab', `Tab → next field`);
      }
      walk.note('valuesTyped', typed);
      expect(typed).toBe(10);

      const created = page.waitForResponse(
        (res) => /\/api\/crm\/records(\?|$)/.test(res.url()) && res.request().method() === 'POST',
        { timeout: 30_000 },
      );
      await walk.press('Enter', 'Enter saves & opens');
      const res = await created;
      walk.note('postStatus', res.status());
      expect(res.status(), 'POST /api/crm/records must be 2xx').toBeGreaterThanOrEqual(200);
      expect(res.status()).toBeLessThan(300);
      const body = (await res.json().catch(() => null)) as { id?: string; record?: { id?: string } } | null;
      createdId = body?.id ?? body?.record?.id ?? null;
      walk.note('createdId', createdId);
      const toast = toastTitles(page).filter({ hasText: added('Member') }).first();
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText(added('Member'));
      await expect(page).toHaveURL(/\/crm\/r\/[0-9a-f-]{36}/);
      if (createdId) await expect(page).toHaveURL(new RegExp(`/crm/r/${createdId}`));
      await expect(page.getByTestId('crm-qc-form')).toHaveCount(0);
    });

    await walk.task(
      'T4-see-on-list',
      'From the new record, ≤1 click back to the originating list showing the new row (D1)',
      1,
      async () => {
        const action = page.locator('[data-sonner-toast] button').filter({ hasText: /view in list/i }).first();
        if ((await action.count()) > 0 && (await action.isVisible())) {
          walk.note('via', 'toast action');
          await walk.click(action, 'toast: View in list');
        } else {
          walk.note('via', 'breadcrumb');
          const back = page.locator("nav[aria-label='Breadcrumb'] a").first();
          await walk.click(back, 'breadcrumb back to Contacts');
        }
        await expect(page).toHaveURL(/\/crm\/modules\/contacts/);
        // Table rows render first/last name in separate cells; cards join them —
        // the per-run last name is unique either way. Both layouts are in the DOM
        // (one display:none per breakpoint), so match the visible copy.
        await expect(page.getByText(ctx.last, { exact: false }).locator('visible=true').first()).toBeVisible({ timeout: 20_000 });
      },
      { soft: true },
    );
  });

  test('T5 oldest Pending → Call — desk (1) and list (2)', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    await stubTelLinks(page);
    await assertTrapsInTest({ page, request, bareRequest, project });
    const pat = FIXTURE.pendingOldest;

    await page.goto('/crm', { waitUntil: 'domcontentloaded' });
    await walk.task(
      'T5-desk',
      `Desk → Call ${pat.name} (1 click)`,
      1,
      async () => {
        // The desk renders the queue twice (md+ table, mobile list); the role
        // query skips whichever copy is display:none for this viewport.
        const call = page.getByRole('link', { name: `Call ${pat.name}` }).first();
        await expect(call, 'the desk must list the oldest Pending person with a Call link').toBeVisible({ timeout: 30_000 });
        await walk.click(call, `Call ${pat.name}`);
        const href = await call.getAttribute('href');
        walk.note('href', href);
        expect(href).toBe(telHref(pat.phone));
      },
      { soft: true },
    );

    await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
    await walk.task(
      'T5-list',
      `Contacts → Pending chip → ${pat.name} tel: link (2 clicks)`,
      2,
      async () => {
        const chip = page.locator('[data-testid="crm-lane-chip"][data-lane="lane-pending"]');
        await expect(chip).toBeVisible();
        await expect(chip).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
        await walk.click(chip, 'Pending chip');
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        // Desktop table: first/last name in separate cells ("Pat" | "Pending"); mobile cards:
        // "Pat Pending" — both layouts are in the DOM, so match the visible copy.
        const [first, last] = pat.name.split(' ');
        const patText = page.getByText(new RegExp(`^${first}(\\s+${last})?$`)).locator('visible=true');
        // The Pending chip sorts created_at asc (TE-3b), so the oldest row is
        // first; the mobile card list is virtualised — scrolling (not counted)
        // renders it when it is not.
        walk.note('scrollSteps', await revealByScrolling(patText));
        await expect(patText.first()).toBeVisible({ timeout: 20_000 });
        // Only a VISIBLE tel: anchor counts — the mobile card list (md:hidden) is in
        // the DOM on desktop too and would otherwise mask the table's button-only Call.
        const tel = page.locator(`a[href="${telHref(pat.phone)}"]`).locator('visible=true').first();
        const telCount = await tel.count();
        walk.note('telAnchors', telCount);
        if (telCount === 0) {
          walk.note('rowCallControl', (await page.getByTestId('crm-row-call').count()) > 0 ? 'button (crm-row-call)' : 'none');
          throw new Error(`no a[href="${telHref(pat.phone)}"] on the list — the desktop table renders Call as a button, not a tel: anchor`);
        }
        await walk.click(tel, 'tel: anchor');
        expect(await tel.getAttribute('href')).toBe(telHref(pat.phone));
      },
      { soft: true },
    );
  });
});
