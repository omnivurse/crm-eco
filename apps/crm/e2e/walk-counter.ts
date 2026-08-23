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
