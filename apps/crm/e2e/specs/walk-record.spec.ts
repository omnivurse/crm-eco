/**
 * EV-5 — record page: T6 inline field patch (D7: silent emerald check + aria-live,
 * no toast), header density at rest (D6), and "reload keeps the Notes pane".
 *
 * T6 writes ONE text field on the fixture anchor and restores it in the next
 * task, so the seed stays as the other specs expect it (local DB only).
 */
import { expect, test } from '../walk-fixture';
import { walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { isBelowLg, nudgeIntoClickableView, runSuffix, toastTitles, trackRequests } from '../walk-helpers';

/** Inline-editable text cells on the contacts overview, most harmless first. */
const T6_FIELD_CANDIDATES = ['preferred_name', 'middle_name', 'referring_member', 'mailing_city'] as const;

test.describe('record page walk', () => {
  test('T6 patch one field inline + header density at rest', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
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
        const globalSearch = page.locator('input[placeholder="Search records..."]:visible');
        const findInRecord = page.locator('input[data-inline-record-search]:visible');
        const searchInputs = (await globalSearch.count()) + (await findInRecord.count());
        walk.note('searchInputs', searchInputs);
        walk.note('searchInputs.globalInHeader', await globalSearch.count());
        walk.note('searchInputs.findInRecord', await findInRecord.count());

        const addTags = page.locator('button:visible', { hasText: /^Add Tags$/ });
        walk.note('addTagsPillAtRest', await addTags.count());

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
        if (searchInputs !== 1) problems.push(`${searchInputs} search inputs in the header (want 1)`);
        if ((await addTags.count()) > 0) problems.push('dashed "Add Tags" pill visible at rest');
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
