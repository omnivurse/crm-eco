/**
 * EV-5 — the quick-create drawer (DE-*): 10 values pasted with zero mouse
 * actions, the duplicate-phone card keeps what was typed, an impossible date
 * is rejected inline with no POST (DE-5, may fail today), a Pending lead saves
 * without a date (DE-6, may fail today), the viewer persona has no create
 * affordance, and the raw server code PENDING_REQUIRES_START_DATE never
 * reaches the screen.
 *
 * Records the walk creates carry a per-run suffix (local DB only).
 */
import { expect, test } from '../walk-fixture';
import { FIXTURE, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { added } from '../../src/lib/crm/toast-copy';
import { isMobileProject, runSuffix, toastTitles, todayMdy, trackRequests, uniquePhone } from '../walk-helpers';

const SERVER_CODE = 'PENDING_REQUIRES_START_DATE';

/** Contacts paste order (lib/crm/quick-create-config.ts) through the 10th typed value. */
const PASTE_ORDER: ReadonlyArray<{ key: string; value: ((c: { first: string; last: string; phone: string; email: string; dob: string }) => string) | null }> = [
  { key: 'first_name', value: (c) => c.first },
  { key: 'last_name', value: (c) => c.last },
  { key: 'phone', value: (c) => c.phone },
  { key: 'email', value: (c) => c.email },
  { key: 'date_of_birth', value: (c) => c.dob },
  { key: 'mailing_city', value: () => 'Austin' },
  { key: 'mailing_state', value: null },
  { key: 'health_insurance_plan_name', value: () => 'Walk Health Plan' },
  { key: 'health_insurance_start_date', value: () => todayMdy() },
  // DE-1/D3: `product` is a native <select> (tier-A options + "Other…") —
  // `walk.type` drives it by type-ahead, so the value is an option label.
  { key: 'product', value: () => 'Health Sharing' },
  { key: 'sharing_effective_date', value: () => todayMdy() },
];

test.describe('quick-create drawer walk', () => {
  test('keyboard paste, duplicate card, invalid date, Pending lead', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    const mobile = isMobileProject(project);
    test.skip(walkRole() === 'viewer', 'viewer persona has no create path — see the viewer test');
    await assertTrapsInTest({ page, request, bareRequest, project });
    await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });

    const trigger = () => (mobile ? page.getByTestId('crm-create-primary-mobile') : page.getByTestId('crm-create-primary'));
    const form = () => page.getByTestId('crm-qc-form');
    const field = (moduleKey: string, key: string) => page.locator(`#qc-${moduleKey}-${key}`);
    const recordPosts = trackRequests(page, /\/api\/crm\/records(\?|$)/);
    const postCount = () => recordPosts.filter((r) => r.method === 'POST').length;
    const serverCodeVisible = async () => (await page.getByText(SERVER_CODE, { exact: false }).count()) > 0;
    const suffix = runSuffix();

    const pasteValues = async (moduleKey: string, ctx: Parameters<NonNullable<(typeof PASTE_ORDER)[number]['value']>>[0]) => {
      let typed = 0;
      for (let i = 0; i < PASTE_ORDER.length; i++) {
        const step = PASTE_ORDER[i];
        await expect(page.locator(':focus'), `tab order: expected qc-${moduleKey}-${step.key}`).toHaveAttribute('id', `qc-${moduleKey}-${step.key}`);
        if (step.value) {
          await walk.type(page.locator(':focus'), step.value(ctx), `type ${step.key}`);
          typed += 1;
        }
        if (i < PASTE_ORDER.length - 1) await walk.press('Tab', 'Tab → next field');
      }
      return typed;
    };

    await walk.task('DE-open', 'Open Add Member (1 click) — first field focused', 1, async () => {
      await walk.click(trigger(), 'Add Member');
      await expect(form()).toBeVisible();
      await expect(field('contacts', 'first_name')).toBeFocused();
    });

    const fresh = {
      first: 'Walk',
      last: `Paste${suffix}`,
      phone: uniquePhone(),
      email: `walk.paste.${suffix.toLowerCase()}@example.invalid`,
      dob: '01/15/1980',
    };
    await walk.task('DE-paste', '10 values pasted in config order with zero mouse actions', 0, async () => {
      const typed = await pasteValues('contacts', fresh);
      walk.note('valuesTyped', typed);
      expect(typed).toBe(10);
      for (const step of PASTE_ORDER) {
        if (!step.value) continue;
        await expect(field('contacts', step.key)).not.toHaveValue('');
      }
    });

    await walk.task(
      'DE-dup-card',
      'Duplicate phone (same name + the anchor phone) → amber card, every typed value kept, Enter does not POST',
      0,
      async () => {
        // Re-point the identity at the fixture anchor: same name + same phone → blocking card.
        await walk.type(field('contacts', 'first_name'), FIXTURE.anchor.firstName, 'first name → Wendy');
        await walk.type(field('contacts', 'last_name'), FIXTURE.anchor.lastName, 'last name → Walker');
        await walk.type(field('contacts', 'phone'), FIXTURE.anchor.phone, 'phone → anchor phone');
        await walk.press('Tab', 'blur phone → duplicate lookup');
        const card = form().getByRole('alert').filter({ hasText: /already on a record|already exists/i }).first();
        await expect(card).toBeVisible({ timeout: 20_000 });
        walk.note('cardText', (await card.textContent())?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? '');
        await expect(card.getByRole('button', { name: /Create anyway/ })).toBeVisible();
        // Nothing typed is lost.
        await expect(field('contacts', 'mailing_city')).toHaveValue('Austin');
        await expect(field('contacts', 'health_insurance_plan_name')).toHaveValue('Walk Health Plan');
        await expect(field('contacts', 'product')).toHaveValue('Health Sharing');
        await expect(field('contacts', 'email')).toHaveValue(fresh.email);
        const posts = postCount();
        await walk.type(field('contacts', 'sharing_effective_date'), todayMdy(), 'refocus the last text field');
        await walk.press('Enter', 'Enter (blocked by the duplicate card)');
        await page.waitForTimeout(1_500);
        walk.note('postsAfterEnter', postCount() - posts);
        expect(postCount() - posts, 'the blocking duplicate card must stop the POST').toBe(0);
        await expect(card).toBeVisible();
        walk.note('serverCodeVisible', await serverCodeVisible());
        expect(await serverCodeVisible()).toBe(false);
      },
    );

    await walk.task('DE-discard', 'Escape → Discard what you typed (1 click)', 1, async () => {
      await walk.press('Escape', 'Escape');
      const dialog = page.getByRole('alertdialog', { name: 'Discard what you typed?' });
      await expect(dialog).toBeVisible();
      await walk.click(dialog.getByRole('button', { name: 'Discard' }), 'Discard');
      await expect(form()).toHaveCount(0);
    });

    await walk.task(
      'DE-invalid-date',
      "Impossible date 13/45/2026 is rejected inline (role=alert) and nothing is POSTed",
      1,
      async () => {
        await walk.click(trigger(), 'Add Member');
        await expect(field('contacts', 'first_name')).toBeFocused();
        const bad = {
          first: 'Walk',
          last: `BadDate${suffix}`,
          phone: uniquePhone(),
          email: `walk.baddate.${suffix.toLowerCase()}@example.invalid`,
          dob: '13/45/2026',
        };
        await pasteValues('contacts', bad);
        walk.note('dobAfterBlur', await field('contacts', 'date_of_birth').inputValue());
        const posts = postCount();
        await walk.press('Enter', 'Enter (submit)');
        const alert = form().getByRole('alert').filter({ hasText: /date/i }).first();
        const alertSeen = await alert
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        await page.waitForTimeout(500);
        const newPosts = postCount() - posts;
        const last = recordPosts.filter((r) => r.method === 'POST').at(-1);
        walk.note('inlineDateAlert', alertSeen ? ((await alert.textContent())?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? true) : false);
        walk.note('postsAfterEnter', newPosts);
        walk.note('lastPostStatus', newPosts > 0 ? (last?.status ?? null) : null);
        walk.note('serverCodeVisible', await serverCodeVisible());
        expect(await serverCodeVisible(), `"${SERVER_CODE}" must never reach the screen`).toBe(false);
        if (newPosts > 0 && last && last.status !== null && last.status < 300) {
          // It saved — the walk landed on the new record; leave it and report.
          await expect(page).toHaveURL(/\/crm\/r\//, { timeout: 20_000 });
        }
        expect(newPosts, 'an impossible date must be rejected before the round-trip').toBe(0);
        expect(alertSeen, 'an inline role=alert must name the date problem').toBe(true);
      },
      { soft: true },
    );

    // Clean slate for the lead case (a still-open drawer or the new record page).
    await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
    await walk.task(
      'DE-lead-pending',
      'A Pending lead saves without a coverage date (DE-6)',
      4,
      async () => {
        await walk.click(trigger(), 'Add Member');
        await expect(field('contacts', 'first_name')).toBeFocused();
        const typeGroup = page.getByRole('group', { name: 'Record type' });
        await walk.click(typeGroup.getByRole('button', { name: /^Lead$/ }), 'switch to Lead');
        await expect(field('leads', 'first_name')).toBeVisible();
        // Status first (2 clicks), then the names — Enter from the last-name
        // field is the native submit (same path as the Add Lead button).
        const statusTrigger = field('leads', 'lead_status');
        await walk.click(statusTrigger, 'Status select');
        const option = page.getByRole('option', { name: /^Pending$/ });
        await expect(option).toBeVisible();
        await walk.click(option, 'Pending');
        await expect(statusTrigger).toContainText('Pending');
        await walk.type(field('leads', 'first_name'), 'Walk', 'first name');
        await walk.type(field('leads', 'last_name'), `Lead${suffix}`, 'last name');
        await expect(field('leads', 'last_name')).toBeFocused();
        const posts = postCount();
        await walk.press('Enter', 'Enter saves the lead');
        const validation = form().getByRole('alert').filter({ hasText: /effective date|start date/i }).first();
        const res = await Promise.race([
          page.waitForResponse((r) => /\/api\/crm\/records(\?|$)/.test(r.url()) && r.request().method() === 'POST', { timeout: 15_000 }).then((r) => r.status()),
          validation.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'validation' as const),
        ]).catch(() => 'timeout' as const);
        walk.note('outcome', typeof res === 'number' ? `POST ${res}` : res);
        if (res === 'validation') walk.note('validationText', (await validation.textContent())?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? '');
        walk.note('postsAfterSubmit', postCount() - posts);
        walk.note('serverCodeVisible', await serverCodeVisible());
        expect(await serverCodeVisible(), `"${SERVER_CODE}" must never reach the screen`).toBe(false);
        expect(typeof res === 'number' && res >= 200 && res < 300, `a Pending lead must save without a date (got ${String(res)})`).toBe(true);
        const toast = toastTitles(page).filter({ hasText: added('Lead') }).first();
        await expect(toast).toBeVisible({ timeout: 15_000 });
        await expect(toast).toHaveText(added('Lead'));
      },
      { soft: true },
    );
  });

  test('viewer persona: no create affordance', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(walkRole() !== 'viewer', 'run with WALK_ROLE=viewer');
    await assertTrapsInTest({ page, request, bareRequest, project });
    await page.goto('/crm', { waitUntil: 'domcontentloaded' });
    await walk.task(
      'DE-viewer-no-create',
      'crm_viewer sees no Add Member / Create control',
      0,
      async () => {
        const primary = await page.getByTestId('crm-create-primary').count();
        const mobilePrimary = await page.getByTestId('crm-create-primary-mobile').count();
        walk.note('crm-create-primary', primary);
        walk.note('crm-create-primary-mobile', mobilePrimary);
        expect(primary + mobilePrimary, 'viewer must not see a create affordance').toBe(0);
      },
      { soft: true },
    );
  });
});
