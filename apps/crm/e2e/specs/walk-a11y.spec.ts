/**
 * A11Y-1 — keyboard / assistive-tech pass on the four walked surfaces, in both
 * themes.
 *
 *   A11Y-axe-list / -record / -drawer / -palette
 *       axe-core (WCAG 2.0/2.1 A+AA plus best practices) on the module list,
 *       a record, the open Add Member drawer and the open ⌘K palette. The gate
 *       is ZERO serious/critical from the semantics rules (role / name / state
 *       / nesting); every count — including moderate and minor — is recorded in
 *       walk.json (`notes.*`, `notes.rules`).
 *   A11Y-axe-dark
 *       The same four surfaces in the dark theme. Contrast is per-theme — an
 *       ink that clears AA on white can fail on the navy ground and vice
 *       versa — so dark is walked, not assumed.
 *   A11Y-contrast
 *       `color-contrast` across all eight surface/theme pairs, plus the
 *       per-token-pair breakdown (`notes.worstPairs`, `<run>/contrast.json`)
 *       so the row stays arguable in fix terms, not as an anonymous count.
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
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../walk-fixture';
import { FIXTURE, runDir, walkRole } from '../env';
import { assertTrapsInTest } from '../traps';
import { added } from '../../src/lib/crm/toast-copy';
import { modKey, runSuffix, toastTitles, trackRequests } from '../walk-helpers';
import type { Walk } from '../walk-fixture';
import type { Page } from '@playwright/test';

const DESKTOP_ONLY = 'the axe/keyboard pass is a per-surface audit — desktop-1440 only';
/** Max keyboard stops from a cold record load to the section nav (A11Y-1 budget). */
const SKIP_LINK_TAB_BUDGET = 6;
/** Split out of the semantics gate so contrast reports as its own row, per surface. */
const CONTRAST_RULE = 'color-contrast';
/** Running contrast tally, filled by the axe tasks and asserted by A11Y-contrast. */
const contrastNodes = new Map<string, number>();

/**
 * Every color-contrast node the audit sees, kept whole. A bare count ("111
 * nodes") cannot be argued with or fixed; the fix list is TOKEN PAIRS, so the
 * pass records fg/bg/ratio/expected per node, prints the distinct pairs into
 * walk.json, and dumps the raw list to `<run>/contrast.json`. Nothing about
 * contrast is excluded — a node that is judged a false positive still lands
 * here with its ratio.
 */
type ContrastNode = {
  surface: string;
  ratio: number;
  expected: number;
  fg: string;
  bg: string;
  fontSize: string;
  fontWeight: string;
  target: string;
  html: string;
};
const contrastDetail: ContrastNode[] = [];

/** "4.5:1" | 4.5 → 4.5 */
function ratioNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(':1', ''));
  return Number.isFinite(n) ? n : 0;
}

/** `#94a3b8 on #ffffff @13px/400` — one line per distinct token pair. */
function pairKey(n: ContrastNode): string {
  return `${n.fg} on ${n.bg} @${n.fontSize}/${n.fontWeight}`;
}

/**
 * Tracked semantics exceptions, matched narrowly (rule + node) so anything else
 * in the same rule still fails hard.
 *
 * EMPTY, and it should stay that way. It used to hold one entry: the record
 * shell mounted the pane TabsList and the TabsContent under two SEPARATE Radix
 * <Tabs> roots, so the Overview trigger's generated `aria-controls` named a
 * panel id its own root never rendered (aria-valid-attr-value, critical). That
 * was fixed at the structure — <main> IS the single Tabs root now
 * (RecordDetailShellV2, `<Tabs asChild>`) — so the rule gates hard again and an
 * empty list is the assertion, not a placeholder.
 */
const KNOWN_EXCEPTIONS: ReadonlyArray<{ rule: string; target: string; why: string }> = [];
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

/**
 * The two dim-chrome inks resolve through per-theme tokens (globals.css
 * --crm-ink-dim / --crm-ink-muted, bound to `text-slate-400` / `-500` in
 * tailwind.config.ts). If that binding ever breaks the declaration is DROPPED,
 * the ink silently inherits its parent, and contrast can still read "0 nodes"
 * while the design has moved. So assert the resolved value, per theme.
 */
async function assertInkTokens(page: Page, walk: Walk, theme: 'light' | 'dark'): Promise<void> {
  const STOCK = { dimSurface: 'rgb(148, 163, 184)', mutedSurface: 'rgb(100, 116, 139)' };
  const expected =
    theme === 'light'
      ? { dim: 'rgb(91, 106, 126)', muted: 'rgb(79, 93, 112)', ...STOCK }
      : { dim: 'rgb(148, 163, 184)', muted: 'rgb(139, 153, 173)', ...STOCK };
  // Probes the real utility class, not the variable — that is the whole chain:
  // `text-slate-400` → tailwind.config textColor → --crm-ink-dim → a painted rgb().
  const resolved = await page.evaluate(() => {
    const probe = (className: string) => {
      const el = document.createElement('span');
      el.className = className;
      el.textContent = 'probe';
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      el.remove();
      return color;
    };
    const surface = (className: string) => {
      const el = document.createElement('span');
      el.className = className;
      document.body.appendChild(el);
      const color = getComputedStyle(el).backgroundColor;
      el.remove();
      return color;
    };
    return {
      dim: probe('text-slate-400'),
      muted: probe('text-slate-500'),
      // The remap is `textColor`, NOT `colors` — surfaces and dividers must
      // still be stock Tailwind slate in both themes. If this ever moves, a
      // `bg-slate-400` chip has quietly been recoloured by a text fix.
      dimSurface: surface('bg-slate-400'),
      mutedSurface: surface('bg-slate-500'),
    };
  });
  walk.note(
    `${theme} ink`,
    `text dim ${resolved.dim} · text muted ${resolved.muted} · bg dim ${resolved.dimSurface} · bg muted ${resolved.mutedSurface}`,
  );
  expect(resolved, `the ${theme} dim-chrome ink tokens must resolve`).toEqual(expected);
}

async function auditSurface(page: Page, walk: Walk, surface: string, noteKey = ''): Promise<void> {
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
  walk.note(`${noteKey}critical`, counts.critical);
  walk.note(`${noteKey}serious`, counts.serious);
  walk.note(`${noteKey}moderate`, counts.moderate);
  walk.note(`${noteKey}minor`, counts.minor);
  walk.note(`${noteKey}contrastNodes`, contrastCount.critical + contrastCount.serious + contrastCount.moderate + contrastCount.minor);
  walk.note(`${noteKey}rules`, ruleSummary(results.violations));
  contrastNodes.set(surface, contrastCount.critical + contrastCount.serious + contrastCount.moderate + contrastCount.minor);
  for (const violation of contrast) {
    for (const node of violation.nodes) {
      const data = (node.any?.[0]?.data ?? {}) as Record<string, unknown>;
      contrastDetail.push({
        surface,
        ratio: ratioNumber(data.contrastRatio),
        expected: ratioNumber(data.expectedContrastRatio),
        fg: String(data.fgColor ?? '?'),
        bg: String(data.bgColor ?? '?'),
        fontSize: String(data.fontSize ?? '?'),
        fontWeight: String(data.fontWeight ?? '?'),
        target: node.target.join(' '),
        html: node.html.slice(0, 200),
      });
    }
  }
  if (tracked.length > 0) {
    walk.note(`${noteKey}knownExceptions`, ruleSummary(tracked));
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
      await assertInkTokens(page, walk, 'light');
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

    // The four surfaces again in DARK. Contrast is per-theme — a token that
    // clears AA on white can fail on the navy ground and vice versa — so the
    // dark pass is walked, not assumed. Runs last because the theme flip is an
    // init script and cannot be un-injected for this page.
    await walk.task('A11Y-axe-dark', 'axe on the four surfaces in dark theme (0 serious/critical)', 1, async () => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('ui-theme', 'dark');
        } catch {
          // Storage blocked — the assertion below fails loudly rather than auditing light twice.
        }
      });
      await page.emulateMedia({ colorScheme: 'dark' });

      await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('crm-create-primary')).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')), {
          message: 'the dark pass must actually be in dark theme',
        })
        .toBe(true);
      await assertInkTokens(page, walk, 'dark');
      await auditSurface(page, walk, 'dark · the contacts list', 'list ');

      await walk.click(page.getByTestId('crm-create-primary'), 'Add Member');
      await expect(page.getByTestId('crm-qc-form')).toBeVisible();
      await auditSurface(page, walk, 'dark · the Add Member drawer', 'drawer ');
      await walk.press('Escape', 'close the drawer');

      await walk.press(`${modKey()}+k`, 'open palette (⌘K)');
      const input = page.getByTestId('crm-palette-input');
      await expect(input).toBeVisible();
      await walk.type(input, FIXTURE.anchor.phone, 'type phone digits');
      await expect(page.getByRole('dialog').getByTestId('crm-palette-result').first()).toBeVisible({ timeout: 20_000 });
      await auditSurface(page, walk, 'dark · the ⌘K palette', 'palette ');
      await walk.press('Escape', 'close the palette');

      await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
      await auditSurface(page, walk, 'dark · the record page', 'record ');
    });

    // CLOSED (was soft): the 111 nodes were four token pairs, not 111
    // decisions — the dim-chrome inks, two status tones, the section-accent
    // alpha and one dark-chrome pill. Fixed at the token values, so this row
    // now gates HARD across BOTH themes and any regression fails the walk.
    await walk.task(
      'A11Y-contrast',
      'axe color-contrast across the four surfaces, light and dark (0 nodes)',
      0,
      async () => {
        let total = 0;
        for (const [surface, count] of contrastNodes) {
          walk.note(surface, count);
          total += count;
        }
        // Distinct token pairs, worst ratio first — the actual fix list.
        const byPair = new Map<string, { count: number; ratio: number; expected: number }>();
        for (const node of contrastDetail) {
          const key = pairKey(node);
          const seen = byPair.get(key);
          if (seen) seen.count += 1;
          else byPair.set(key, { count: 1, ratio: node.ratio, expected: node.expected });
        }
        const pairs = Array.from(byPair.entries()).sort((a, b) => a[1].ratio - b[1].ratio);
        walk.note('pairs', pairs.length);
        walk.note(
          'worstPairs',
          pairs.map(([key, v]) => `${key} = ${v.ratio}:1 (need ${v.expected}:1) ×${v.count}`).join(' | ') || 'none',
        );
        writeFileSync(
          path.join(runDir(), 'contrast.json'),
          `${JSON.stringify({ total, pairs: Object.fromEntries(byPair), nodes: contrastDetail }, null, 2)}\n`,
        );
        walk.note('total', total);
        expect(total, 'color-contrast nodes across list/record/drawer/palette, light + dark').toBe(0);
      },
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
