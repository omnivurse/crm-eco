/**
 * Logged-in smoke (EV-1 acceptance): we are on /crm behind the PIN gate, not
 * on the lock/quote page, and the fixture record renders the V2 chrome.
 * Uses the walk fixture (one task) so every run writes walk.json.
 */
import { expect, test } from '../walk-fixture';
import { PIN_LOCK_TITLE } from '../env';
import { assertTrapsInTest } from '../traps';

test('operator lands on /crm and the fixture record shows the V2 Add-note group', async ({ page, request, bareRequest, walk }, testInfo) => {
  await page.goto('/crm', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/crm(\/|\?|$)/);
  await expect.poll(() => page.title()).not.toBe(PIN_LOCK_TITLE);

  // Re-assert the per-project traps before anything is counted (navigates).
  const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project: testInfo.project.name });
  expect(anchor, 'fixture anchor record (Wendy Walker) must resolve via /api/crm/search').not.toBeNull();

  await walk.task('smoke', 'Open the fixture record and dismiss nothing', 5, async () => {
    await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
    await walk.shot('record page');
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();
    // One counted keypress proves the wrapper ↔ browser tally agreement end-to-end.
    await walk.press('Escape', 'Escape (no-op)');
    await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible();
  });
});
