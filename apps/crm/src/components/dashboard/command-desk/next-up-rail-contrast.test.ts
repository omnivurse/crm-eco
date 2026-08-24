/**
 * A11Y-2 colour contrast — the "Not on file" facts on the Next Up rail.
 *
 * The 2026-08-23 chrome sweep reported three failing nodes at
 * desktop-1440/operator: `dd[title="Not on file"]`, #7a8491 on #ffffff, 3.79:1.
 * The class was `text-muted-foreground/70` — the token faded to 70% — and the
 * fade is what pushed it under the floor. Read against globals.css so this test
 * follows the token instead of hard-coding a hex that a re-theme would orphan.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIL = path.join(__dirname, 'NextUpRail.tsx');
const GLOBALS = path.join(__dirname, '../../../app/globals.css');

/** WCAG 2.1 1.4.3 — the fact value is text-xs. */
const AA_TEXT = 4.5;

type Rgb = [number, number, number];

function relativeLuminance([r, g, b]: Rgb): number {
  const [rr, gg, bb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as Rgb;
}

/** `--muted-foreground: <h> <s>% <l>%` from the light-theme `:root` block. */
function mutedForeground(): Rgb {
  const css = readFileSync(GLOBALS, 'utf8');
  const start = css.indexOf('\n:root {');
  expect(start, 'globals.css must declare :root').toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf('\n}', start));
  const m = /--muted-foreground:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(block);
  expect(m, ':root must declare --muted-foreground as "H S% L%"').not.toBeNull();
  return hslToRgb(Number(m![1]), Number(m![2]), Number(m![3]));
}

const WHITE: Rgb = [255, 255, 255];

describe('NextUpRail — the absent-value fact', () => {
  const source = readFileSync(RAIL, 'utf8');

  /** The `cn(...)` argument list on the fact's `<dd>`. */
  const factClasses = (): string => {
    const m = /cn\('truncate text-xs',([^)]*)\)/.exec(source);
    expect(m, "the fact <dd>'s className moved — update this test with it").not.toBeNull();
    return m![1];
  };

  it('does not fade the muted token under an opacity modifier', () => {
    // `/70` composited to #7a8491 (3.79:1). Any `/<n>` on this token is the
    // same defect wearing a different number. Scoped to the fact's own
    // className: the decorative `<Sparkles aria-hidden>` at /60 is not text and
    // is hidden from the accessibility tree, so 1.4.3 does not reach it.
    expect(factClasses()).not.toMatch(/text-muted-foreground\/\d+/);
  });

  it('clears 4.5:1 on the card at full token strength', () => {
    expect(factClasses()).toContain('italic text-muted-foreground');
    expect(ratio(mutedForeground(), WHITE)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('proves the old value really did fail — this test is not vacuous', () => {
    // The class that shipped, recomputed: token at 70% over the white card.
    const faded = composite(mutedForeground(), 0.7, WHITE);
    expect(ratio(faded, WHITE)).toBeLessThan(AA_TEXT);
  });
});
