/**
 * Pure click/keypress counter used by the `walk` fixture (Node side) and the
 * in-page trusted-event listener (browser side). No Playwright imports so the
 * logic is unit-testable with vitest.
 *
 * Counting rules (decision D12 budgets are expressed in these units):
 *  - click      = one wrapped `walk.click()`; browser side = one trusted `pointerdown`
 *                 (pointerdown, not `click`, so label→input activation and
 *                 keyboard-activated buttons never double count).
 *  - keypress   = one wrapped `walk.press()`; a chord (⌘Enter) is ONE keypress;
 *                 browser side = one trusted `keydown` whose key is not a bare
 *                 modifier (Meta/Control/Shift/Alt/…).
 *  - typed text = `walk.type()`; characters are recorded separately and are
 *                 NOT keypresses (the browser listener ignores keydowns while
 *                 the typing flag is set, and `fill` emits none anyway).
 */

export interface WalkTally {
  clicks: number;
  keypresses: number;
  typedChars: number;
}

export interface BrowserTally {
  clicks: number;
  keypresses: number;
}

export const MODIFIER_KEYS: ReadonlySet<string> = new Set([
  'Meta',
  'Control',
  'Shift',
  'Alt',
  'AltGraph',
  'CapsLock',
  'Fn',
  'Hyper',
  'Super',
  'OS',
]);

export class WalkCounter {
  private clicks = 0;
  private keypresses = 0;
  private typedChars = 0;

  recordClick(): void {
    this.clicks += 1;
  }

  recordPress(): void {
    this.keypresses += 1;
  }

  recordType(text: string): void {
    this.typedChars += text.length;
  }

  snapshot(): WalkTally {
    return { clicks: this.clicks, keypresses: this.keypresses, typedChars: this.typedChars };
  }

  reset(): void {
    this.clicks = 0;
    this.keypresses = 0;
    this.typedChars = 0;
  }
}

/** Event facts the browser listener sees; kept minimal so tests can fake it. */
export interface TrustedEventFacts {
  type: 'pointerdown' | 'keydown' | string;
  isTrusted: boolean;
  key?: string;
  typing?: boolean;
}

/** Returns which tally (if any) a DOM event increments. */
export function classifyTrustedEvent(ev: TrustedEventFacts): 'click' | 'keypress' | null {
  if (!ev.isTrusted) return null;
  if (ev.type === 'pointerdown') return 'click';
  if (ev.type === 'keydown') {
    if (ev.typing) return null;
    if (ev.key && MODIFIER_KEYS.has(ev.key)) return null;
    return 'keypress';
  }
  return null;
}

/** Throws when the wrapper tally and the browser tally disagree. */
export function reconcileTallies(
  taskId: string,
  wrapper: Pick<WalkTally, 'clicks' | 'keypresses'>,
  browser: BrowserTally,
): void {
  if (wrapper.clicks !== browser.clicks || wrapper.keypresses !== browser.keypresses) {
    throw new Error(
      `walk tally mismatch in task "${taskId}": wrapper counted ${wrapper.clicks} clicks / ${wrapper.keypresses} keypresses ` +
        `but the browser saw ${browser.clicks} trusted pointerdowns / ${browser.keypresses} trusted keydowns. ` +
        `An un-wrapped action (raw page.click/press, or a chord counted twice) slipped in.`,
    );
  }
}

export const WALK_STORAGE_KEY = '__walk_tally_v1';
export const WALK_TYPING_KEY = '__walk_typing_v1';

/**
 * Installed via `context.addInitScript` on every document. Persists to
 * sessionStorage so full navigations in the same tab keep the tally.
 * Must stay self-contained (no closures) — Playwright serialises its source.
 */
export function browserCounterInitScript(keys: { storage: string; typing: string; modifiers: string[] }): void {
  const modifiers = new Set(keys.modifiers);
  const read = (): { clicks: number; keypresses: number } => {
    try {
      const raw = window.sessionStorage.getItem(keys.storage);
      if (raw) {
        const parsed = JSON.parse(raw) as { clicks?: number; keypresses?: number };
        return { clicks: Number(parsed.clicks) || 0, keypresses: Number(parsed.keypresses) || 0 };
      }
    } catch {
      /* sessionStorage unavailable */
    }
    return { clicks: 0, keypresses: 0 };
  };
  const write = (t: { clicks: number; keypresses: number }): void => {
    try {
      window.sessionStorage.setItem(keys.storage, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  };
  const isTyping = (): boolean => {
    try {
      return window.sessionStorage.getItem(keys.typing) === '1';
    } catch {
      return false;
    }
  };
  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (!ev.isTrusted) return;
      const t = read();
      t.clicks += 1;
      write(t);
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (ev) => {
      if (!ev.isTrusted) return;
      if (isTyping()) return;
      if (modifiers.has((ev as KeyboardEvent).key)) return;
      const t = read();
      t.keypresses += 1;
      write(t);
    },
    true,
  );
}

// ---------------------------------------------------------------------------
// Task outcome (EV-5 soft mode)
// ---------------------------------------------------------------------------

export interface TaskOutcomeInput {
  /** The error `fn` threw, or null when it returned. */
  failure: unknown;
  clicks: number;
  budget: number;
  /**
   * Soft tasks record `pass=false` and let the spec continue instead of
   * failing the test — for budgets/assertions about work a later wave ships.
   */
  soft: boolean;
}

export interface TaskOutcome {
  pass: boolean;
  /** Why the task did not pass (null when it passed). */
  reason: string | null;
  /** Error the wrapper must rethrow (null in soft mode or when nothing failed). */
  rethrow: unknown;
  /** True when the wrapper must still assert the click budget (hard mode only). */
  assertBudget: boolean;
}

/** Playwright colours its assertion messages; walk.json wants plain text. */
function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

/** First meaningful lines of an error (assertion + Locator/Expected lines), ANSI-free, ≤ 240 chars. */
export function describeFailure(failure: unknown): string {
  const raw = failure instanceof Error ? failure.message || failure.name : String(failure);
  const lines = stripAnsi(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(Call log|Timeout|Error: element|- )/i.test(l));
  const text = lines.slice(0, 3).join(' · ');
  return text.length > 240 ? `${text.slice(0, 237)}…` : text || 'failed';
}

/**
 * `pass` is honest in both modes: an assertion failure OR a blown click budget
 * is a fail. Hard mode (default) rethrows the failure / asserts the budget so
 * the Playwright test fails; soft mode swallows both and only records them.
 */
export function resolveTaskOutcome(input: TaskOutcomeInput): TaskOutcome {
  const overBudget = input.clicks > input.budget;
  const failed = input.failure !== null && input.failure !== undefined;
  const pass = !failed && !overBudget;
  let reason: string | null = null;
  if (failed) reason = describeFailure(input.failure);
  else if (overBudget) reason = `over click budget (${input.clicks} > ${input.budget})`;
  return {
    pass,
    reason,
    rethrow: failed && !input.soft ? input.failure : null,
    assertBudget: !input.soft,
  };
}
