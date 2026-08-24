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
 * Desktop-1440 + the operator persona — the entry points for the drawer and
 * the palette differ below lg, so those two surfaces are audited where they
 * are actually reachable.
 *
 * EVERYTHING ELSE — every other breakpoint, every other role, and the record
 * panes behind `?pane=` — is swept by A11Y-2 at the bottom of this file, which
 * carries the full project/role matrix. Read that block before quoting any
 * "0 serious/critical" number: the two tasks cover different surfaces on
 * purpose, and each records the surfaces it opened in walk.json (`scanned`).
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

/**
 * Each blocking violation with its selector AND the first node's markup — the
 * fix list. The markup matters: a selector like `.border-b-0` names no file,
 * and the chrome sweep audits surfaces whose owner is not obvious from a class.
 */
function blockingDetail(violations: AxeResult[]): string {
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}[${v.impact}]: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}\n    ${(v.nodes[0]?.html ?? '').slice(0, 160)}`,
    )
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

/**
 * Where a pass accumulates its evidence. The four-surface sweep and the chrome
 * sweep keep separate books so neither can be quoted as the other.
 *
 * `blocking` changes WHEN the semantics gate fires, never WHETHER. Without it
 * the first bad surface throws and the remaining surfaces — and the whole dark
 * leg — go unscanned, so one defect hides the next. With it every surface is
 * audited and ONE row (`A11Y-axe-chrome-semantics`) asserts the whole list is
 * empty. Same gate, more evidence behind it. The main sink leaves it undefined
 * and keeps failing per surface, exactly as before.
 */
interface ContrastSink {
  nodes: Map<string, number>;
  detail: ContrastNode[];
  blocking?: string[];
}
const mainSink: ContrastSink = { nodes: contrastNodes, detail: contrastDetail };

async function auditSurface(page: Page, walk: Walk, surface: string, noteKey = '', sink: ContrastSink = mainSink): Promise<void> {
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
  sink.nodes.set(surface, contrastCount.critical + contrastCount.serious + contrastCount.moderate + contrastCount.minor);
  for (const violation of contrast) {
    for (const node of violation.nodes) {
      const data = (node.any?.[0]?.data ?? {}) as Record<string, unknown>;
      sink.detail.push({
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
  const blocking = counts.critical + counts.serious;
  const detail = `axe serious/critical on ${surface}:\n${blockingDetail(semantics)}`;
  if (sink.blocking) {
    if (blocking > 0) sink.blocking.push(detail);
    return;
  }
  expect(blocking, detail).toBe(0);
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

/* ==========================================================================
 * A11Y-2 — the chrome sweep. WHY IT EXISTS: everything above is desktop-1440
 * + operator, so "0 serious/critical including contrast" was a true statement
 * about ONE persona at ONE width on FOUR surfaces, and silent about the rest.
 * Three whole classes of chrome had never been axe-scanned:
 *
 *   · the phone / tablet chrome — the nav drawer that replaces the sidebar
 *     below lg, and the single "Filters & View" sheet that replaces the list
 *     toolbar below md. Different DOM, different tokens;
 *   · the admin-only chrome — the Settings sidebar's long link list, and the
 *     mass-actions bar that only a writer role can raise;
 *   · the record's OTHER panes. The record scan above only ever sees the
 *     Overview pane; Timeline and Files mount behind `?pane=` and carry
 *     components (RecordTimeline, AttachmentsPanel) that no walk had opened.
 *
 * ── THE MATRIX (what each project/role actually scans) ────────────────────
 *
 *   A11Y-axe-chrome        every project × every role, LIGHT theme
 *     always .............. command desk · contacts list · record Overview ·
 *                           record Timeline pane · record Files pane
 *     mobile-390 only ..... nav drawer · "Filters & View" sheet
 *     admin only .......... Settings page + its sidebar link list
 *     operator/admin, ≥1024 mass-actions bar (viewer has no row checkboxes;
 *                           the phone list has no select-all column)
 *
 *   A11Y-axe-chrome-dark   every project × every role, DARK theme
 *     always .............. record Timeline pane · record Files pane
 *     mobile-390 only ..... nav drawer
 *     admin only .......... Settings sidebar
 *     (the desk/list/Overview tokens are already walked in dark by
 *     A11Y-axe-dark; re-scanning them at three widths buys nothing, so the
 *     dark leg spends its runtime on the panes and chrome nothing else sees.)
 *
 *   A11Y-contrast-chrome   color-contrast over everything the two tasks above
 *                          scanned, as its own gate and its own token-pair fix
 *                          list (`contrast-chrome-<project>-<role>.json`).
 *
 * Every task records `scanned` in walk.json — the list of surfaces it really
 * opened on THIS project/role — so the claim in the report is re-derivable
 * from the artifact instead of being read off this comment.
 *
 * ── WHAT THE WIDENED SWEEP FOUND (2026-08-23) ────────────────────────────
 * Both gate rows below are RED on every project/role, and every finding is in
 * a component this wave does not own. They are listed here so the next reader
 * knows the rows are reporting product defects, not spec bugs:
 *
 *   aria-required-children (critical) — RecordRelatedListChips.tsx:246 declares
 *     role="tablist" and puts the "Customize related lists" button (:290)
 *     inside it as a non-`tab` child. Every pane except Overview, every
 *     project, both themes.
 *   button-name (critical) — the mass-actions bar's overflow trigger, and the
 *     card-view row checkboxes on the phone list (ListView.tsx:255).
 *   color-contrast — FIXED for the seven nodes this sweep reported at
 *     desktop-1440/operator, each with a measured replacement and a unit test
 *     that fails if the shade slides back:
 *       · NextUpRail.tsx `text-muted-foreground/70` 3.79:1 → the token at full
 *         strength, 8.33:1 (next-up-rail-contrast.test.ts). The italic already
 *         said "not on file"; the fade was saying it twice, illegibly.
 *       · RecordRelatedListChips.tsx white on bg-violet-500 4.23:1 → violet-600
 *         5.70:1. Every OTHER hue in that map was below the floor too
 *         (emerald-500 2.54, cyan-500 2.43, amber-500 2.15 …), so all 13 active
 *         styles moved to the first shade that clears 4.5:1
 *         (chip-contrast.test.ts grades the whole map, not just the hue axe
 *         happened to open).
 *       · FilterableTimeline.tsx white on bg-white/20 4.43:1 → an opaque
 *         teal-900 badge, 9.48:1. The translucent white was LIGHTENING the chip
 *         beneath it, so the subtle treatment was the defect. The chip itself
 *         (bg-teal-600, 3.74:1) moved to teal-700, 5.47:1.
 *     STILL OPEN, and not in this wave's seven: ListView.tsx:188-191 avatar
 *     initials, white on bg-emerald-500 2.53 / bg-blue-500 3.67 /
 *     bg-indigo-500 4.46:1.
 *   duplicate React key (console.error, admin only) —
 *     app/crm/settings/page.tsx:228 keys the cards by `card.href`, and :59 and
 *     :147 both point at /crm/settings/fields.
 *
 * The two panes this wave DOES own — RecordTimeline, AttachmentsPanel — are
 * clean in both themes; see record-panes-contrast.test.ts for their ratios.
 * ======================================================================== */
const chromeSink: ContrastSink = { nodes: new Map(), detail: [], blocking: [] };

/**
 * The effective painted background of an element: the first opaque ancestor
 * colour with every translucent layer above it composited back down (the same
 * walk axe does internally). Recorded so the ratios asserted in
 * `record-panes-contrast.test.ts` stand on a MEASURED ground rather than an
 * assumed white, and so a future re-skin of the record pane shows up here.
 */
async function probeGround(page: Page, walk: Walk, selector: string, key: string): Promise<void> {
  const ground = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const layers: Array<[number, number, number, number]> = [];
    let node: HTMLElement | null = el;
    let gradient = false;
    while (node) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage.includes('gradient')) gradient = true;
      const m = /rgba?\(([^)]+)\)/.exec(style.backgroundColor);
      if (m) {
        const parts = m[1].split(',').map((v) => Number(v.trim()));
        const [r, g, b] = parts;
        const a = parts.length > 3 ? parts[3] : 1;
        if (a > 0) {
          layers.push([r, g, b, a]);
          if (a >= 1) break;
        }
      }
      node = node.parentElement;
    }
    let out: [number, number, number] = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const [r, g, b, a] = layers[i];
      out = [r, g, b].map((v, j) => Math.round(v * a + out[j] * (1 - a))) as [number, number, number];
    }
    const hex = `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    return gradient ? `${hex} (+gradient overlay)` : hex;
  }, selector);
  walk.note(key, ground ?? 'not rendered');
}

test.describe('a11y chrome sweep (A11Y-2)', () => {
  test('axe: the desk, the record panes and the per-breakpoint / per-role chrome', async ({
    page,
    request,
    bareRequest,
    walk,
  }, testInfo) => {
    const project = testInfo.project.name;
    const role = walkRole();
    // The nav drawer and the collapsed toolbar are BELOW lg / md; 1024 is lg,
    // so tablet-1024 takes the desktop branch for both. That is the product's
    // breakpoint, not a shortcut — asserted below, not assumed.
    const phone = project === 'mobile-390';
    const { anchor } = await assertTrapsInTest({ page, request, bareRequest, project });
    expect(anchor, 'fixture anchor (Wendy Walker) must resolve').not.toBeNull();

    const scanned: string[] = [];
    const at = (name: string): string => {
      scanned.push(name);
      return `${project}/${role} · ${name}`;
    };
    const paneUrl = (pane: string): string =>
      `${anchor!.url}${anchor!.url.includes('?') ? '&' : '?'}pane=${pane}`;

    /** `?pane=timeline` — the Timeline top tab (RecordTimeline). */
    const openTimelinePane = async (): Promise<void> => {
      await page.goto(paneUrl('timeline'), { waitUntil: 'domcontentloaded' });
      await expect(
        page
          .getByRole('button', { name: /^All \(\d+\)$/ })
          .or(page.getByRole('heading', { name: 'No timeline events' })),
        'the Timeline pane must mount (filter bar or its empty state)',
      ).toBeVisible({ timeout: 60_000 });
    };

    /** `?pane=attachments` — the Files pane (AttachmentsPanel). */
    const openFilesPane = async (): Promise<void> => {
      await page.goto(paneUrl('attachments'), { waitUntil: 'domcontentloaded' });
      await expect(
        page
          .getByText('Click to upload or drag and drop')
          .or(page.getByRole('heading', { name: 'No attachments' })),
        'the Files pane must mount (upload zone for a writer, empty state for a viewer)',
      ).toBeVisible({ timeout: 60_000 });
    };

    await walk.task(
      'A11Y-axe-chrome',
      `axe on the ${project} chrome as ${role}, light (0 serious/critical)`,
      2,
      async () => {
        // 1. The command desk — the landing surface, never audited before.
        await page.goto('/crm', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
        await auditSurface(page, walk, at('the command desk'), 'desk ', chromeSink);

        // 2. The list AT THIS WIDTH — cards + collapsed toolbar below md,
        //    table + rail above lg.
        await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('crm-pager-showing').first()).toBeVisible({ timeout: 30_000 });
        await auditSurface(page, walk, at('the contacts list'), 'list ', chromeSink);

        // 3. The record AT THIS WIDTH — the phone action bar is lg:hidden chrome.
        await page.goto(anchor!.url, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('group', { name: 'Add note' })).toBeVisible({ timeout: 60_000 });
        await auditSurface(page, walk, at('the record (Overview)'), 'record ', chromeSink);

        // 4. The record's OTHER panes. Both mount components no walk had ever
        //    opened, and both are reached by URL — zero clicks.
        await openTimelinePane();
        await probeGround(page, walk, '.glass-card', 'light timeline card ground');
        await auditSurface(page, walk, at('the record Timeline pane'), 'timeline ', chromeSink);

        await openFilesPane();
        // `.border-dashed` is the upload zone root — the tile's own ground.
        await probeGround(page, walk, '.border-dashed, main', 'light files pane ground');
        await auditSurface(page, walk, at('the record Files pane'), 'files ', chromeSink);

        // 5. Phone only: the nav drawer replaces the whole sidebar below lg,
        //    and the toolbar collapses behind one "Filters & View" sheet.
        if (phone) {
          const menu = page.getByRole('button', { name: 'Open menu' }).first();
          await expect(menu, 'the phone shell must carry a nav trigger').toBeVisible({ timeout: 30_000 });
          await walk.click(menu, 'Open menu');
          await expect(page.getByTestId('crm-mobile-nav-drawer')).toBeVisible({ timeout: 20_000 });
          await auditSurface(page, walk, at('the mobile nav drawer'), 'navDrawer ', chromeSink);
          await walk.press('Escape', 'close the nav drawer');

          await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
          await expect(page.getByTestId('crm-pager-showing').first()).toBeVisible({ timeout: 30_000 });
          const filters = page.getByRole('button', { name: /Filters & View/ }).first();
          await expect(filters, 'below md the toolbar must collapse behind one sheet').toBeVisible({ timeout: 30_000 });
          await walk.click(filters, 'Filters & View');
          const sheet = page.getByRole('dialog').locator('visible=true').first();
          await expect(sheet).toBeVisible();
          await auditSurface(page, walk, at('the mobile Filters & View sheet'), 'filterSheet ', chromeSink);
          // Escape, never Apply — the sweep must leave the fixture as it found it.
          await walk.press('Escape', 'close the filter sheet');
        } else {
          // The claim "lg+ has no drawer" is asserted, not assumed.
          expect(
            await page.getByTestId('crm-mobile-nav-drawer').locator('visible=true').count(),
            'above lg the sidebar is inline — no drawer to scan',
          ).toBe(0);
          walk.note('navDrawer', 'lg+ renders the sidebar inline (audited with the list)');
        }

        // 6. Admin only: the Settings surface. NV-inventory counts 28 links for
        //    an admin and 0 for everyone else — none had ever been scanned.
        if (role === 'admin') {
          await page.goto('/crm/settings', { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
          const links = await page.getByTestId('crm-sidenav-item').locator('visible=true').count();
          walk.note('settingsSidebarLinks', links);
          expect(links, 'the admin Settings sidebar must actually be on screen to be scanned').toBeGreaterThan(0);
          await auditSurface(page, walk, at('the Settings sidebar'), 'settings ', chromeSink);
        } else {
          walk.note('settingsSidebarLinks', 0);
        }

        // 7. Writer roles, ≥1024: the mass-actions bar. crm_viewer has no row
        //    checkboxes at all (PERM-1-bulk-actions' sibling contract), and the
        //    phone list has no select-all column.
        if (role !== 'viewer' && !phone) {
          await page.goto('/crm/modules/contacts', { waitUntil: 'domcontentloaded' });
          await expect(page.getByTestId('crm-pager-showing').first()).toBeVisible({ timeout: 30_000 });
          const selectAll = page.getByRole('checkbox', { name: 'Select all rows' }).first();
          await expect(selectAll, 'a writer role must have a select-all checkbox to raise the bulk bar').toBeVisible({
            timeout: 30_000,
          });
          await walk.click(selectAll, 'Select all rows');
          // Wait on the bar's OWN copy, not on a manage-only button:
          // MassActionsBar.tsx gates Assign/Status/Delete behind
          // canManageRecords(), which is false for crm_agent — the operator
          // persona. Keying on `crm-bulk-status` scanned nothing for the very
          // persona the sweep runs as.
          // RecordTable.tsx:1397 renders the same "N selected" copy in the
          // md:hidden card-view header, so `.first()` picked a hidden twin.
          const bulkBar = page.getByText(/^\d+ selected$/).locator('visible=true').first();
          await expect(bulkBar, 'select-all must raise the mass-actions bar').toBeVisible({ timeout: 20_000 });
          walk.note('bulkManageActions', await page.getByTestId('crm-bulk-status').count());
          await auditSurface(page, walk, at('the mass-actions bar'), 'bulk ', chromeSink);
          // Clearing the selection is state-only — nothing is written.
          await walk.press('Escape', 'clear the selection');
        } else {
          walk.note('massActionsBar', role === 'viewer' ? 'crm_viewer has no row checkboxes' : 'no select-all column on a phone');
        }

        walk.note('scanned', scanned.join(' · '));
        walk.note('surfaces', scanned.length);
      },
    );

    // DARK. The theme flip is an init script and cannot be un-injected, so it
    // runs last on this page — same constraint as A11Y-axe-dark above.
    await walk.task(
      'A11Y-axe-chrome-dark',
      `axe on the ${project} record panes and ${role} chrome, dark (0 serious/critical)`,
      1,
      async () => {
        const darkScanned: string[] = [];
        const darkAt = (name: string): string => {
          darkScanned.push(name);
          return `${project}/${role} · dark · ${name}`;
        };
        await page.addInitScript(() => {
          try {
            window.localStorage.setItem('ui-theme', 'dark');
          } catch {
            // Storage blocked — the poll below fails loudly rather than auditing light twice.
          }
        });
        await page.emulateMedia({ colorScheme: 'dark' });

        await openTimelinePane();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')), {
            message: 'the dark chrome pass must actually be in dark theme',
          })
          .toBe(true);
        await probeGround(page, walk, '.glass-card', 'dark timeline card ground');
        await auditSurface(page, walk, darkAt('the record Timeline pane'), 'darkTimeline ', chromeSink);

        await openFilesPane();
        await probeGround(page, walk, '.border-dashed, main', 'dark files pane ground');
        await auditSurface(page, walk, darkAt('the record Files pane'), 'darkFiles ', chromeSink);

        if (phone) {
          const menu = page.getByRole('button', { name: 'Open menu' }).first();
          await expect(menu).toBeVisible({ timeout: 30_000 });
          await walk.click(menu, 'Open menu');
          await expect(page.getByTestId('crm-mobile-nav-drawer')).toBeVisible({ timeout: 20_000 });
          await auditSurface(page, walk, darkAt('the mobile nav drawer'), 'darkNavDrawer ', chromeSink);
          await walk.press('Escape', 'close the nav drawer');
        }

        if (role === 'admin') {
          await page.goto('/crm/settings', { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
          await auditSurface(page, walk, darkAt('the Settings sidebar'), 'darkSettings ', chromeSink);
        }

        walk.note('scanned', darkScanned.join(' · '));
        walk.note('surfaces', darkScanned.length);
        // Mirror of the semantics book, recorded HERE because the two gate rows
        // below run in series: whichever fails first ends the test, and the
        // other row's evidence would never reach walk.json. The gates still
        // gate; this only makes the evidence survive a red run.
        walk.note('blockingSurfaces', chromeSink.blocking!.length);
        walk.note(
          'blocking',
          chromeSink.blocking!.map((b) => b.replace(/\s+/g, ' ')).join('  ‖  ').slice(0, 1800) || 'none',
        );
      },
    );

    // Contrast on the chrome, in its own book and its own gate — the same
    // token-pair shape the four-surface row uses, so a regression here is as
    // arguable in fix terms as the ones CLOSE-3 closed.
    await walk.task(
      'A11Y-contrast-chrome',
      `axe color-contrast across the ${project}/${role} chrome, light and dark (0 nodes)`,
      0,
      async () => {
        let total = 0;
        for (const [surface, count] of chromeSink.nodes) {
          walk.note(surface, count);
          total += count;
        }
        const byPair = new Map<string, { count: number; ratio: number; expected: number }>();
        for (const node of chromeSink.detail) {
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
          path.join(runDir(), `contrast-chrome-${project}-${role}.json`),
          `${JSON.stringify({ project, role, total, pairs: Object.fromEntries(byPair), nodes: chromeSink.detail }, null, 2)}\n`,
        );
        walk.note('total', total);
        expect(total, `color-contrast nodes across the ${project}/${role} chrome`).toBe(0);
      },
    );

    // THE semantics gate for the whole sweep. It is deliberately one row over
    // every surface both tasks above opened: a per-surface throw would stop at
    // the first bad pane and leave the rest of the matrix unscanned, which is
    // how `RecordRelatedListChips` sat unseen behind `?pane=` in the first
    // place. Failing here names every rule, selector and markup snippet at once.
    await walk.task(
      'A11Y-axe-chrome-semantics',
      `axe serious/critical across every ${project}/${role} surface swept above (0)`,
      0,
      async () => {
        walk.note('blockingSurfaces', chromeSink.blocking!.length);
        walk.note('surfacesScanned', chromeSink.nodes.size);
        expect(
          chromeSink.blocking,
          `axe serious/critical on the ${project}/${role} chrome — every swept surface, not just the first`,
        ).toEqual([]);
      },
    );
  });
});
