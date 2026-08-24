/**
 * EV-4 — the `walk` fixture. Every user action in a spec goes through it so the
 * click/keypress tally is honest:
 *   walk.task(id, label, budget, fn)  — scope + budget + wall clock
 *   walk.click(locator, label)        — 1 click
 *   walk.press(key, label)            — 1 keypress (a chord like Meta+Enter = 1)
 *   walk.type(locator, text, label)   — typed chars, NOT keypresses (a native
 *                                      <select> is driven by type-ahead)
 * A capture-phase listener injected into every document counts ONLY
 * event.isTrusted pointerdown/keydown; at task end both tallies must agree.
 *   walk.task(id, label, budget, fn, { soft: true }) — EV-5: record pass=false
 *                                      (with `reason`) instead of failing the test
 *   walk.note(key, value)             — facts for walk.json tasks[].notes
 */
import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Locator, type Page, type APIRequestContext } from '@playwright/test';
import { runDir } from './env';
import {
  armPageIssueTrap,
  hasUntrackedPageIssue,
  pageIssuesSince,
  pageIssuesSoFar,
  recordTrap,
  splitPageIssues,
  trapNoPageIssues,
  type PageIssue,
  type SuppressedPageIssue,
} from './traps';
import {
  MODIFIER_KEYS,
  WALK_STORAGE_KEY,
  WALK_TYPING_KEY,
  WalkCounter,
  browserCounterInitScript,
  reconcileTallies,
  resolveTaskOutcome,
  type BrowserTally,
} from './walk-counter';

export interface WalkStep {
  label: string;
  shot: string;
  kind: 'click' | 'press' | 'type' | 'shot' | 'end' | 'error';
  ms: number;
}

/** Free-form facts a task records into walk.json (counts, hrefs, observed copy…). */
export type WalkNoteValue = string | number | boolean | null;

export interface WalkTaskRecord {
  id: string;
  label: string;
  clicks: number;
  keypresses: number;
  typedChars: number;
  ms: number;
  budget: number;
  pass: boolean;
  /** Soft tasks record pass=false instead of failing the test (future-wave assertions). */
  soft: boolean;
  /** Graded `console.error` calls the browser made inside this task's window. */
  consoleErrors: number;
  /** Graded uncaught exceptions (`pageerror`) inside this task's window. */
  pageErrors: number;
  /** Diagnosed (PI-n) lines seen in this row's window — disclosed, not charged. */
  knownIssues?: PageIssue[];
  /** The graded lines themselves — what turned the row red. */
  browserIssues?: PageIssue[];
  /** Allowlisted lines, carried WITH the reason each was dropped. Never hidden. */
  suppressedIssues?: SuppressedPageIssue[];
  /** Why pass=false (assertion message / over budget); absent when it passed. */
  reason?: string;
  project: string;
  viewport: string;
  test: string;
  steps: WalkStep[];
  notes?: Record<string, WalkNoteValue>;
}

export interface WalkTaskOptions {
  /**
   * `soft: true` — the task records `pass=false` (with `reason`) when its
   * assertions fail or its click budget is exceeded, and the spec continues.
   * Use it for budgets/assertions that describe work a later wave ships, so
   * walk.json stays honest without aborting the walk. Harness errors (tally
   * mismatch, `walk.*` outside a task) still throw.
   */
  soft?: boolean;
}

export interface Walk {
  click(locator: Locator, label: string, options?: Parameters<Locator['click']>[0]): Promise<void>;
  press(key: string, label: string): Promise<void>;
  type(locator: Locator, text: string, label: string): Promise<void>;
  /** Named screenshot without counting anything. */
  shot(label: string): Promise<void>;
  /** Record a fact on the current task (lands in walk.json `tasks[].notes`). */
  note(key: string, value: WalkNoteValue): void;
  task<T>(id: string, label: string, budget: number, fn: () => Promise<T>, options?: WalkTaskOptions): Promise<T>;
  /** Tasks recorded so far in this test. */
  readonly records: readonly WalkTaskRecord[];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'step';
}

async function readBrowserTally(page: Page): Promise<BrowserTally> {
  try {
    return await page.evaluate((key) => {
      try {
        const raw = window.sessionStorage.getItem(key);
        const parsed = raw ? (JSON.parse(raw) as { clicks?: number; keypresses?: number }) : {};
        return { clicks: Number(parsed.clicks) || 0, keypresses: Number(parsed.keypresses) || 0 };
      } catch {
        return { clicks: 0, keypresses: 0 };
      }
    }, WALK_STORAGE_KEY);
  } catch {
    // about:blank / navigation in flight — treat as zero.
    return { clicks: 0, keypresses: 0 };
  }
}

async function resetBrowserTally(page: Page): Promise<void> {
  try {
    await page.evaluate((key) => {
      try {
        window.sessionStorage.setItem(key, JSON.stringify({ clicks: 0, keypresses: 0 }));
      } catch {
        /* ignore */
      }
    }, WALK_STORAGE_KEY);
  } catch {
    /* about:blank — nothing to reset */
  }
}

async function setTypingFlag(page: Page, on: boolean): Promise<void> {
  try {
    await page.evaluate(
      ([key, value]) => {
        try {
          if (value) window.sessionStorage.setItem(key, '1');
          else window.sessionStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      },
      [WALK_TYPING_KEY, on] as const,
    );
  } catch {
    /* ignore */
  }
}

export function createWalk(page: Page, meta: { project: string; testTitle: string; shotRoot: string; runRoot: string }): Walk {
  const counter = new WalkCounter();
  const records: WalkTaskRecord[] = [];
  /**
   * How many collected page issues have already been charged to a row. Every
   * issue the browser logs is charged to exactly one task — including the ones
   * logged while the spec was navigating BETWEEN tasks, which is where a
   * hydration error on a fresh page load actually lands. Charging only what
   * happens strictly inside a task would leave a row green while the page it
   * just opened was logging an error, which is the false result this trap
   * exists to kill.
   */
  let consumedIssues = 0;
  let active: {
    id: string;
    label: string;
    budget: number;
    soft: boolean;
    startedAt: number;
    steps: WalkStep[];
    baseline: BrowserTally;
    /** pageIssuesSoFar().length when the task opened — its console window starts here. */
    issueCursor: number;
    shotIndex: number;
    notes: Record<string, WalkNoteValue>;
  } | null = null;

  const requireTask = (what: string) => {
    if (!active) throw new Error(`walk.${what}() called outside walk.task() — every counted action must belong to a task`);
    return active;
  };

  const viewportString = () => {
    const vp = page.viewportSize();
    return vp ? `${vp.width}x${vp.height}` : 'unknown';
  };

  const takeShot = async (label: string, kind: WalkStep['kind']): Promise<void> => {
    const t = requireTask('shot');
    t.shotIndex += 1;
    const dir = path.join(meta.shotRoot, slug(t.id));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${String(t.shotIndex).padStart(2, '0')}-${slug(label)}.png`);
    try {
      // `caret: 'initial'` — Playwright's DEFAULT is 'hide', which paints
      // `caret-color: transparent` into the live document to keep shots stable.
      // The page-errors trap then read that back as a React hydration mismatch
      // (`+ style={{caret-color:"transparent"}}` on the record's find-in-record
      // input) — the harness reporting its own footprint as a product defect,
      // which is the exact class of false result this trap exists to kill. The
      // walk's screenshots are evidence for a human, not pixel comparisons, so
      // a blinking caret costs nothing.
      await page.screenshot({ path: file, timeout: 10_000, caret: 'initial' });
    } catch {
      // A navigation in flight can reject the screenshot; the step still counts.
    }
    t.steps.push({ label, shot: path.relative(meta.runRoot, file), kind, ms: Math.round(performance.now() - t.startedAt) });
  };

  const walk: Walk = {
    records,
    async click(locator, label, options) {
      requireTask('click');
      await locator.click(options);
      counter.recordClick();
      await takeShot(label, 'click');
    },
    async press(key, label) {
      requireTask('press');
      await page.keyboard.press(key);
      counter.recordPress();
      await takeShot(label, 'press');
    },
    async type(locator, text, label) {
      requireTask('type');
      const tag = await locator.evaluate((el) => el.tagName.toLowerCase());
      await setTypingFlag(page, true);
      try {
        if (tag === 'select') {
          // A native <select> (quick-create's closed lists, D3) has no caret:
          // the keyboard "paste" is type-ahead — the keystrokes pick the first
          // option whose label starts with the text. Still typed chars, never
          // keypresses (the typing flag hides the keydowns from the tally).
          await locator.focus();
          await locator.pressSequentially(text);
          const picked = await locator.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.label ?? '');
          if (!picked.toLowerCase().startsWith(text.toLowerCase())) {
            throw new Error(`walk.type: type-ahead "${text}" on a <select> picked "${picked || '(nothing)'}" — type the start of an option label`);
          }
        } else {
          await locator.fill(text);
        }
      } finally {
        await setTypingFlag(page, false);
      }
      counter.recordType(text);
      await takeShot(label, 'type');
    },
    async shot(label) {
      await takeShot(label, 'shot');
    },
    note(key, value) {
      const t = requireTask('note');
      t.notes[key] = value;
    },
    async task<T>(id: string, label: string, budget: number, fn: () => Promise<T>, options?: WalkTaskOptions): Promise<T> {
      if (active) throw new Error(`walk.task("${id}") started while task "${active.id}" is still running — tasks do not nest`);
      const soft = options?.soft === true;
      counter.reset();
      await resetBrowserTally(page);
      const baseline = await readBrowserTally(page);
      active = {
        id,
        label,
        budget,
        soft,
        startedAt: performance.now(),
        steps: [],
        baseline,
        // Not `pageIssuesSoFar().length`: the window opens where the previous
        // row's window closed, so the navigation a spec does just before the
        // task is charged to the task it was setting up. The first row of a
        // test therefore carries the trap sweep's own page loads.
        issueCursor: consumedIssues,
        shotIndex: 0,
        notes: {},
      };
      let result: T;
      let failure: unknown = null;
      try {
        result = await fn();
        await takeShot('end', 'end');
      } catch (err) {
        failure = err;
        await takeShot('error', 'error');
        result = undefined as T;
      }
      const tally = counter.snapshot();
      const after = await readBrowserTally(page);
      const browser: BrowserTally = {
        clicks: Math.max(0, after.clicks - baseline.clicks),
        keypresses: Math.max(0, after.keypresses - baseline.keypresses),
      };
      const ms = Math.round(performance.now() - active.startedAt);
      const { real: browserIssues, suppressed: suppressedIssues } = splitPageIssues(pageIssuesSince(page, active.issueCursor));
      consumedIssues = pageIssuesSoFar(page).length;
      // A task row answers ONE question: does this task work, in this budget?
      // PI-n is a diagnosed defect in the shared CRM shell, so it is on every
      // page the walk opens — charging it to each row turned 20 of 67 rows red
      // for something none of them measures, and buried whether NV-cross-tab or
      // A11Y-keyboard-T1 actually still work. The VERDICT is not softened: each
      // PI-n line still reddens the per-test and setup `page-errors` traps, so
      // walk.json and `walk:crm:gate` are red either way, and the lines are
      // carried on the row itself (`knownIssues`) rather than dropped.
      const chargeable = browserIssues.filter((i) => !i.known);
      const knownIssues = browserIssues.filter((i) => i.known);
      const outcome = resolveTaskOutcome({ failure, clicks: tally.clicks, budget, soft, browserIssues: chargeable });
      const record: WalkTaskRecord = {
        id,
        label,
        clicks: tally.clicks,
        keypresses: tally.keypresses,
        typedChars: tally.typedChars,
        ms,
        budget,
        pass: outcome.pass,
        soft,
        consoleErrors: chargeable.filter((i) => i.kind === 'console').length,
        pageErrors: chargeable.filter((i) => i.kind === 'pageerror').length,
        ...(chargeable.length > 0 ? { browserIssues: chargeable } : {}),
        // Diagnosed defects seen inside this row's window. Not charged to the
        // row, never hidden from it.
        ...(knownIssues.length > 0 ? { knownIssues } : {}),
        ...(suppressedIssues.length > 0 ? { suppressedIssues } : {}),
        ...(outcome.reason ? { reason: outcome.reason } : {}),
        project: meta.project,
        viewport: viewportString(),
        test: meta.testTitle,
        steps: active.steps,
        ...(Object.keys(active.notes).length > 0 ? { notes: active.notes } : {}),
      };
      records.push(record);
      fs.mkdirSync(meta.runRoot, { recursive: true });
      fs.appendFileSync(path.join(meta.runRoot, 'tasks.jsonl'), `${JSON.stringify(record)}\n`);
      active = null;
      await resetBrowserTally(page);
      if (outcome.rethrow !== null) throw outcome.rethrow;
      // Harness integrity is never soft: an un-wrapped action is a bug in the spec.
      reconcileTallies(id, tally, browser);
      if (outcome.assertBudget) {
        expect(tally.clicks, `task "${id}" click budget (${tally.clicks} > ${budget})`).toBeLessThanOrEqual(budget);
      }
      return result;
    },
  };
  return walk;
}

type WalkFixtures = {
  walk: Walk;
  /** An APIRequestContext with NO cookies (for the pin-gate trap). */
  bareRequest: APIRequestContext;
};

export const test = base.extend<WalkFixtures>({
  context: async ({ context }, provide) => {
    await context.addInitScript(browserCounterInitScript, {
      storage: WALK_STORAGE_KEY,
      typing: WALK_TYPING_KEY,
      modifiers: Array.from(MODIFIER_KEYS),
    });
    await provide(context);
  },
  bareRequest: async ({ playwright, baseURL }, provide) => {
    // Inside a test, playwright.request.newContext() inherits the test's storageState
    // (operator cookies) — force an empty jar so the pin-gate trap really is cookie-less.
    const ctx = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    await provide(ctx);
    await ctx.dispose();
  },
  walk: async ({ page }, provide, testInfo) => {
    const root = runDir();
    const shotRoot = path.join(root, 'shots', slug(testInfo.project.name), slug(testInfo.title));
    // Arm the browser-error collectors before the spec's first navigation, so
    // the graded window is the whole test — not just the trap sweep.
    armPageIssueTrap(page);
    const walk = createWalk(page, { project: testInfo.project.name, testTitle: testInfo.title, shotRoot, runRoot: root });
    await provide(walk);
    for (const rec of walk.records) {
      for (const step of rec.steps) {
        const abs = path.join(root, step.shot);
        if (fs.existsSync(abs)) await testInfo.attach(`${rec.id}/${step.label}`, { path: abs, contentType: 'image/png' });
      }
    }
    // A walk that logged an uncaught exception or a console.error is not a
    // green walk, however many rows passed. Recorded into the ledger (so
    // walk.json and the gate carry it) and thrown, so `playwright test` is red
    // on its own — the report can never sit next to an unexplained red badge.
    const issues = trapNoPageIssues(page, `${testInfo.title} [${testInfo.project.name}]`);
    recordTrap({ ...issues, phase: 'in-test', project: testInfo.project.name });
    // Red in walk.json and red at the gate either way. The THROW is reserved
    // for an error the walk has not already diagnosed: PI-n lives in the shared
    // shell, so throwing on it here would fail every spec in the suite and the
    // owner would get an exit code instead of 387 measured rows.
    if (hasUntrackedPageIssue(page)) throw new Error(`TRAP:${issues.name} — ${issues.detail}`);
  },
});

export { expect };
