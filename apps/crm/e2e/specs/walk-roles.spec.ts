/**
 * EV-5 — role walk (PERM-*): the read-only persona never hits a dead end.
 *
 * Run it as the viewer:
 *   WALK_ROLE=viewer npx playwright test -c e2e/playwright.config.ts e2e/specs/walk-roles.spec.ts
 *
 * The operator and admin passes cover the create/edit paths; this file walks
 * the SAME stops as a crm_viewer and asserts each one renders something the
 * user can read and act on — never the CRM error boundary, never a bounce to
 * the login page, never a blank shell. The gated deep link (Import Data, which
 * the sidebar hides from this role) gets its own row: landing somewhere that
 * does not say why is a dead end even when the redirect itself is correct.
 */
import { expect, test } from '../walk-fixture';
import { FIXTURE, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { pathWithQuery } from '../walk-helpers';

/** Copy that means the page gave up: Next's overlay, 404, or app/crm/error.tsx. */
const DEAD_END = /Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error|Unable to Load CRM/i;

test.describe('viewer persona has no dead ends (PERM-viewer)', () => {
  test.beforeEach(() => {
    test.skip(walkRole() !== 'viewer', 'run with WALK_ROLE=viewer');
  });

  test('every viewer stop renders; the gated deep link explains itself', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();

    const stops: Array<{ label: string; path: string }> = [
      { label: 'desk', path: '/crm' },
      { label: 'contacts-list', path: '/crm/modules/contacts' },
      { label: 'record', path: anchor!.url },
      { label: 'search', path: `/crm/search?q=${encodeURIComponent(FIXTURE.anchor.phone)}` },
      { label: 'trash', path: '/crm/trash' },
    ];
    // The CRM shell always paints its top bar; either twin proves the chrome is up.
    // Both twins are in the DOM at every breakpoint (one is display:none), so
    // narrow to the visible one — `.first()` would pick the hidden desktop pill
    // on the phone project.
    const shell = () =>
      page.locator('[data-testid="crm-topbar-search"], [data-testid="crm-topbar-search-mobile"]').locator('visible=true').first();

    await walk.task(
      'PERM-viewer-no-dead-end',
      'crm_viewer walks desk → list → record → search → trash: every stop renders, none bounces to login or the error boundary (0 clicks)',
      0,
      async () => {
        for (const stop of stops) {
          const res = await page.goto(stop.path, { waitUntil: 'domcontentloaded' });
          const status = res?.status() ?? null;
          const landed = pathWithQuery(page);
          walk.note(`${stop.label}.status`, status);
          walk.note(`${stop.label}.landed`, landed);
          expect(status, `${stop.label}: the viewer must get a page, not an error status`).toBeLessThan(400);
          expect(landed, `${stop.label}: a read-only role must not be bounced to login/PIN`).not.toMatch(/^\/(crm-login|lock)/);
          await expect(shell(), `${stop.label}: the CRM shell must paint`).toBeVisible({ timeout: 30_000 });
          const dead = await page.getByText(DEAD_END).count();
          walk.note(`${stop.label}.deadEndText`, dead);
          expect(dead, `${stop.label}: no error-boundary / 404 copy`).toBe(0);
          // Something to read: a heading or the page's own empty/status panel.
          const readable = await page.locator('h1, h2, [role="status"]').locator('visible=true').count();
          walk.note(`${stop.label}.readableBlocks`, readable);
          expect(readable, `${stop.label}: the page must show a heading or an explanation`).toBeGreaterThan(0);
        }
      },
    );

    await walk.task(
      'PERM-viewer-gated-link',
      'A gated deep link (/crm/import) lands somewhere that says why the viewer cannot use it (0 clicks)',
      0,
      async () => {
        const res = await page.goto('/crm/import', { waitUntil: 'domcontentloaded' });
        walk.note('status', res?.status() ?? null);
        expect(res?.status() ?? 0, 'the gate must answer, not error').toBeLessThan(400);
        await expect(shell(), 'the landing page must render the CRM shell').toBeVisible({ timeout: 30_000 });
        // The gate redirects from inside a Suspense boundary, so the hop lands
        // after first paint — let the client settle before reading the URL.
        await page.waitForLoadState('networkidle').catch(() => undefined);
        const landed = pathWithQuery(page);
        walk.note('landed', landed);
        walk.note('importWizardHeadings', await page.getByRole('heading', { name: /import/i }).locator('visible=true').count());
        expect(landed, 'a viewer must not be parked on a page their role cannot use').not.toMatch(/^\/crm\/import/);
        expect(await page.getByText(DEAD_END).count(), 'no error-boundary copy behind the gate').toBe(0);
        // The redirect carries ?error=no_import_permission — the landing page
        // has to turn that into words, otherwise the viewer is silently moved.
        const explained = await page
          .getByText(/permission|not available to your role|read-only|no access|can't import|cannot import/i)
          .locator('visible=true')
          .count();
        walk.note('explanationBlocks', explained);
        expect(explained, 'the landing page must explain the refused route').toBeGreaterThan(0);
      },
      // HARD (wave 4): the viewer bounce off /crm/import lands on a page that
      // says why, on every project. A regression must turn `playwright test`
      // red on its own, not only `walk:crm:gate`.
    );
  });
});
