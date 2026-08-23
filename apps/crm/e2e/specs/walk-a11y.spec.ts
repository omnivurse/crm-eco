/**
 * A11Y-1 — keyboard / assistive-tech pass on the four walked surfaces.
 *
 *   A11Y-axe-list / -record / -drawer / -palette
 *       axe-core (WCAG 2.0/2.1 A+AA plus best practices) on the module list,
 *       a record, the open Add Member drawer and the open ⌘K palette. The gate
 *       is ZERO serious/critical from the semantics rules (role / name / state
 *       / nesting); every count — including moderate and minor — is recorded in
 *       walk.json (`notes.*`, `notes.rules`).
 *   A11Y-contrast  (SOFT)
 *       `color-contrast` across the same four surfaces. It is a palette
 *       decision, not an aria fix, so it is recorded honestly as a failing
 *       soft row with its node count instead of being silently excluded.
 *   A11Y-skip-to-section-nav
 *       From a cold record load, ≤ 6 keyboard stops must reach the section
 *       nav, walking the real journey: Tab, and Enter on a skip link when one
 *       is focused (shell "Skip to content" → record "Skip to record
 *       details" → the section nav).
 *   A11Y-keyboard-T1 / -T3
 *       The two persona tasks with the mouse unplugged: ⌘K → digits → Enter
 *       opens the record; `n` → type → ⌘Enter saves a note. Zero clicks.
 *
 * Desktop-1440 + the operator persona only — the axe pass is a per-surface
 * audit, not a per-breakpoint one, and the drawer/palette entry points differ
 * below lg (those breakpoints are covered by the drawer and persona specs).
 */
import AxeBuilder from '@axe-core/playwright';
import type { Result as AxeResult } from 'axe-core';
import { expect, test } from '../walk-fixture';
import { FIXTURE, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { added } from '../../src/lib/crm/toast-copy';
import { modKey, runSuffix, toastTitles, trackRequests } from '../walk-helpers';
import type { Walk } from '../walk-fixture';
import type { Page } from '@playwright/test';

const DESKTOP_ONLY = 'the axe/keyboard pass is a per-surface audit — desktop-1440 only';
/** Max keyboard stops from a cold record load to the section nav (A11Y-1 budget). */
const SKIP_LINK_TAB_BUDGET = 6;
/** Contrast is a palette decision (D-level), not an aria/role/name fix — soft, never excluded. */
const CONTRAST_RULE = 'color-contrast';
/** Running contrast tally, filled by the axe task and asserted by the soft one. */
const contrastNodes = new Map<string, number>();

/**
 * ONE tracked semantics exception, matched narrowly (rule + node) so anything
 * else in the same rule still fails hard. The record shell mounts the pane
 * TabsList and the TabsContent under two SEPARATE Radix <Tabs> roots, so the
 * Overview trigger's generated `aria-controls` names a panel id the other root
 * never renders. Fixing it means one Tabs root around header + body — a
 * structural change to RecordDetailShellV2, not an aria attribute. Recorded as
 * a failing soft row (A11Y-known-exceptions), never silently dropped.
 */
const KNOWN_EXCEPTIONS: ReadonlyArray<{ rule: string; target: string; why: string }> = [
  {
    rule: 'aria-valid-attr-value',
    target: '-trigger-overview',
    why: 'RecordDetailShellV2 renders the pane TabsList and TabsContent under two Radix Tabs roots',
  },
];
/** Running tally of tracked exceptions, asserted by the soft task. */
const exceptionNodes = new Map<string, string>();

function isKnownException(rule: string, targets: string[]): boolean {
  return KNOWN_EXCEPTIONS.some((k) => k.rule === rule && targets.some((t) => t.includes(k.target)));
}

type ImpactCount = { critical: number; serious: number; moderate: number; minor: number };

function countByImpact(violations: AxeResult[]): ImpactCount {
  const counts: ImpactCount = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    const impact = (v.impact ?? 'minor') as keyof ImpactCount;
    if (impact in counts) counts[impact] += v.nodes.length || 1;
  }
  return counts;
}

/** "color-contrast(3), region(1)" — the rule ids behind the counts, for walk.json. */
function ruleSummary(violations: AxeResult[]): string {
  if (violations.length === 0) return 'none';
  return violations
    .map((v) => `${v.id}[${v.impact ?? 'minor'}]×${v.nodes.length}`)
    .sort()
    .join(', ');
}

/** First node of each blocking violation, with its selector — the fix list. */
function blockingDetail(violations: AxeResult[]): string {
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)
    .join('\n');
}

async function auditSurface(page: Page, walk: Walk, surface: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const semantics = results.violations.filter(
    (v) => v.id !== CONTRAST_RULE && !isKnownException(v.id, v.nodes.map((n) => n.target.join(' '))),
  );
  const tracked = results.violations.filter((v) =>
    isKnownException(v.id, v.nodes.map((n) => n.target.join(' '))),
  );
  const contrast = results.violations.filter((v) => v.id === CONTRAST_RULE);
  const counts = countByImpact(semantics);
  const contrastCount = countByImpact(contrast);
  walk.note('critical', counts.critical);
  walk.note('serious', counts.serious);
  walk.note('moderate', counts.moderate);
  walk.note('minor', counts.minor);
  walk.note('contrastNodes', contrastCount.critical + contrastCount.serious + contrastCount.moderate + contrastCount.minor);
  walk.note('rules', ruleSummary(results.violations));
  contrastNodes.set(surface, contrastCount.critical + contrastCount.serious + contrastCount.moderate + contrastCount.minor);
  if (tracked.length > 0) {
    walk.note('knownExceptions', ruleSummary(tracked));
    exceptionNodes.set(surface, ruleSummary(tracked));
  }
  await walk.shot(`axe ${surface}`);
  expect(
    counts.critical + counts.serious,
    `axe serious/critical on ${surface}:\n${blockingDetail(semantics)}`,
  ).toBe(0);
}

test.describe('a11y walk (A11Y-1)', () => {
  test('axe: list, record, Add Member drawer, ⌘K palette', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(project !== 'desktop-1440', DESKTOP_ONLY);
    test.skip(walkRole() !== 'operator', 'the axe pass walks the operator persona');
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor, 'fixture anchor (Wendy Walker) must resolve').not.toBeNull();

    await walk.task('A11Y-axe-list', 'axe on the contacts list (0 serious/critical)', 0, async () => {
      await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('crm-create-primary')).toBeVisible({ timeout: 30_000 });
      await auditSurface(page, walk, 'the contacts list');
    });

    await walk.task('A11Y-axe-record', 'axe on a record page (0 serious/critical)', 0, async () => {
      await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
      await auditSurface(page, walk, 'the record page');
    });

    await walk.task('A11Y-axe-drawer', 'axe on the open Add Member drawer (0 serious/critical)', 1, async () => {
      await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
      await walk.click(page.getByTestId('crm-create-primary'), 'Add Member');
      await expect(page.getByTestId('crm-qc-form')).toBeVisible();
      await auditSurface(page, walk, 'the Add Member drawer');
      await walk.press('Escape', 'close the drawer');
    });

    await walk.task('A11Y-axe-palette', 'axe on the open ⌘K palette with results (0 serious/critical)', 0, async () => {
      await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
      const input = page.getByTestId('crm-palette-input');
      await expect(input).toBeVisible();
      await walk.type(input, FIXTURE.anchor.phone, 'type phone digits');
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByTestId('crm-palette-result').first()).toBeVisible({ timeout: 20_000 });

      // The listbox/option wiring itself (A11Y-1): the input drives a listbox
      // and aria-activedescendant points at the row Enter would open.
      const listbox = dialog.getByRole('listbox');
      await expect(listbox).toHaveCount(1);
      const listboxId = await listbox.getAttribute('id');
      expect(await input.getAttribute('role')).toBe('combobox');
      expect(await input.getAttribute('aria-expanded')).toBe('true');
      expect(await input.getAttribute('aria-controls')).toBe(listboxId);
      const options = dialog.getByRole('option');
      const optionCount = await options.count();
      walk.note('optionCount', optionCount);
      expect(optionCount).toBeGreaterThan(0);
      const selected = dialog.locator('[role="option"][aria-selected="true"]');
      await expect(selected).toHaveCount(1);
      const activeId = await input.getAttribute('aria-activedescendant');
      expect(activeId, 'aria-activedescendant must name the selected option').toBe(await selected.getAttribute('id'));
      walk.note('activeDescendantFollowsSelection', true);

      await auditSurface(page, walk, 'the ⌘K palette');
      await walk.press('Escape', 'close the palette');
    });

    // Recorded, not hidden: contrast is a palette decision for the design
    // owner, so it fails softly with the per-surface counts in walk.json.
    await walk.task(
      'A11Y-contrast',
      'axe color-contrast across the four surfaces (0 nodes)',
      0,
      async () => {
        let total = 0;
        for (const [surface, count] of contrastNodes) {
          walk.note(surface, count);
          total += count;
        }
        walk.note('total', total);
        expect(total, 'color-contrast nodes across list/record/drawer/palette').toBe(0);
      },
      { soft: true },
    );

    await walk.task(
      'A11Y-known-exceptions',
      'axe semantics violations parked as tracked exceptions (0)',
      0,
      async () => {
        for (const [surface, summary] of exceptionNodes) walk.note(surface, summary);
        walk.note('total', exceptionNodes.size);
        expect(
          Array.from(exceptionNodes.entries()).map(([s2, r]) => `${s2}: ${r}`),
          KNOWN_EXCEPTIONS.map((k) => `${k.rule} — ${k.why}`).join('; '),
        ).toEqual([]);
      },
      { soft: true },
    );
  });

  test('A11Y-skip-to-section-nav: ≤6 Tab stops from a cold load', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(project !== 'desktop-1440', DESKTOP_ONLY);
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();

    await walk.task(
      'A11Y-skip-to-section-nav',
      `Tab reaches the record skip link within ${SKIP_LINK_TAB_BUDGET} stops; Enter focuses the section nav`,
      0,
      async () => {
        await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
        // Start from the document, not from whatever the app focused.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

        const focused = () =>
          page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            return { testid: el?.dataset?.testid ?? null, id: el?.id ?? null };
          });
        const trail: string[] = [];
        let stops = 0;
        let landed = false;
        while (stops < SKIP_LINK_TAB_BUDGET) {
          const here = await focused();
          if (here.testid === 'crm-skip-to-content' || here.testid === 'crm-record-skip-link') {
            // A focused skip link is taken, not tabbed past — that is the point of it.
            await expect(page.getByTestId(here.testid)).toBeVisible();
            await walk.press('Enter', `Enter on ${here.testid}`);
          } else {
            await walk.press('Tab', `Tab ${stops + 1}`);
          }
          stops += 1;
          const now = await focused();
          trail.push(now.testid ?? now.id ?? '(unnamed)');
          if (now.id === 'record-section-nav') {
            landed = true;
            break;
          }
        }
        walk.note('stopsToSectionNav', stops);
        walk.note('trail', trail.join(' → '));
        expect(landed, `focus did not reach the section nav within ${SKIP_LINK_TAB_BUDGET} stops: ${trail.join(' → ')}`).toBe(true);
        expect(trail, 'the journey must go through a skip link').toContain('crm-skip-to-content');
      },
    );
  });

  test('A11Y keyboard-only T1 and T3 (zero clicks)', async ({ page, request, bareRequest, walk }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(project !== 'desktop-1440', DESKTOP_ONLY);
    // The T3 leg saves a note, which crm_viewer is refused (403); the T1 leg is
    // role-independent and stays covered by operator + admin.
    test.skip(walkRole() === 'viewer', 'the T3 leg writes a note — crm_viewer is refused (403)');
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor).not.toBeNull();

    await walk.task('A11Y-keyboard-T1', 'Find Wendy Walker by phone with the keyboard only (0 clicks)', 0, async () => {
      await page.goto('/crm', { waitUntil: 'domcontentloaded' });
      await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
      const input = page.getByTestId('crm-palette-input');
      await expect(input).toBeVisible();
      await walk.type(input, FIXTURE.anchor.phone, 'type phone digits');
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Records', { exact: true })).toBeVisible();
      await expect(dialog.getByTestId('crm-palette-result').filter({ hasText: /Wendy\s+Walker/i }).first()).toBeVisible();
      await walk.press('Enter', 'Enter opens the selected option');
      await expect(page).toHaveURL(/\/crm\/r\/[0-9a-f-]{36}/);
      expect(new URL(page.url()).pathname.split('/').pop()).toBe(anchor!.id);
      await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
    });

    const notePosts = trackRequests(page, /\/api\/crm\/notes(\?|$)/);
    const suffix = runSuffix();
    await walk.task('A11Y-keyboard-T3', "Add a note with the 'n' hotkey and ⌘Enter (0 clicks)", 0, async () => {
      await expect(page.getByTestId('crm-notes-composer')).toHaveCount(0);
      await walk.press('n', "'n' hotkey");
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.isContentEditable === true), {
          message: 'the hotkey must land focus in the composer',
        })
        .toBe(true);
      const editor = page.getByTestId('crm-notes-composer').locator('[contenteditable]').first();
      await walk.type(editor, `Walk A11Y ${suffix}`, 'type the note');
      const before = notePosts.filter((r) => r.method === 'POST').length;
      await walk.press(`${modKey()}+Enter`, '⌘Enter saves');
      await expect
        .poll(() => notePosts.filter((r) => r.method === 'POST' && r.status !== null).length, { timeout: 20_000 })
        .toBeGreaterThan(before);
      const post = notePosts.filter((r) => r.method === 'POST').at(-1)!;
      walk.note('postStatus', post.status);
      expect(post.status).toBeGreaterThanOrEqual(200);
      expect(post.status).toBeLessThan(300);
      await expect(toastTitles(page).filter({ hasText: added('Note') }).first()).toBeVisible();
    });
  });
});
