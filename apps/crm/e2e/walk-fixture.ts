/**
 * EV-4 — the `walk` fixture. Every user action in a spec goes through it so the
 * click/keypress tally is honest:
 *   walk.task(id, label, budget, fn)  — scope + budget + wall clock
 *   walk.click(locator, label)        — 1 click
 *   walk.press(key, label)            — 1 keypress (a chord like Meta+Enter = 1)
 *   walk.type(locator, text, label)   — typed chars, NOT keypresses
 * A capture-phase listener injected into every document counts ONLY
 * event.isTrusted pointerdown/keydown; at task end both tallies must agree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Locator, type Page, type APIRequestContext } from '@playwright/test';
import { runDir } from './env';
import {
  MODIFIER_KEYS,
  WALK_STORAGE_KEY,
  WALK_TYPING_KEY,
  WalkCounter,
  browserCounterInitScript,
  reconcileTallies,
  type BrowserTally,
} from './walk-counter';

export interface WalkStep {
  label: string;
  shot: string;
  kind: 'click' | 'press' | 'type' | 'shot' | 'end' | 'error';
  ms: number;
}

export interface WalkTaskRecord {
  id: string;
  label: string;
  clicks: number;
  keypresses: number;
  typedChars: number;
  ms: number;
  budget: number;
  pass: boolean;
  project: string;
  viewport: string;
  test: string;
  steps: WalkStep[];
}

export interface Walk {
  click(locator: Locator, label: string, options?: Parameters<Locator['click']>[0]): Promise<void>;
  press(key: string, label: string): Promise<void>;
  type(locator: Locator, text: string, label: string): Promise<void>;
  /** Named screenshot without counting anything. */
  shot(label: string): Promise<void>;
  task<T>(id: string, label: string, budget: number, fn: () => Promise<T>): Promise<T>;
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
  let active: { id: string; label: string; budget: number; startedAt: number; steps: WalkStep[]; baseline: BrowserTally; shotIndex: number } | null = null;

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
      await page.screenshot({ path: file, timeout: 10_000 });
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
      await setTypingFlag(page, true);
      try {
        await locator.fill(text);
      } finally {
        await setTypingFlag(page, false);
      }
      counter.recordType(text);
      await takeShot(label, 'type');
    },
    async shot(label) {
      await takeShot(label, 'shot');
    },
    async task<T>(id: string, label: string, budget: number, fn: () => Promise<T>): Promise<T> {
      if (active) throw new Error(`walk.task("${id}") started while task "${active.id}" is still running — tasks do not nest`);
      counter.reset();
      await resetBrowserTally(page);
      const baseline = await readBrowserTally(page);
      active = { id, label, budget, startedAt: performance.now(), steps: [], baseline, shotIndex: 0 };
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
      const record: WalkTaskRecord = {
        id,
        label,
        clicks: tally.clicks,
        keypresses: tally.keypresses,
        typedChars: tally.typedChars,
        ms,
        budget,
        pass: failure === null && tally.clicks <= budget,
        project: meta.project,
        viewport: viewportString(),
        test: meta.testTitle,
        steps: active.steps,
      };
      records.push(record);
      fs.mkdirSync(meta.runRoot, { recursive: true });
      fs.appendFileSync(path.join(meta.runRoot, 'tasks.jsonl'), `${JSON.stringify(record)}\n`);
      active = null;
      await resetBrowserTally(page);
      if (failure !== null) throw failure;
      reconcileTallies(id, tally, browser);
      expect(tally.clicks, `task "${id}" click budget (${tally.clicks} > ${budget})`).toBeLessThanOrEqual(budget);
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
    const walk = createWalk(page, { project: testInfo.project.name, testTitle: testInfo.title, shotRoot, runRoot: root });
    await provide(walk);
    for (const rec of walk.records) {
      for (const step of rec.steps) {
        const abs = path.join(root, step.shot);
        if (fs.existsSync(abs)) await testInfo.attach(`${rec.id}/${step.label}`, { path: abs, contentType: 'image/png' });
      }
    }
  },
});

export { expect };
