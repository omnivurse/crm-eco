/**
 * A11Y-2 colour contrast — the record chips and the timeline filter pills.
 *
 * The 2026-08-23 chrome sweep reported these as failing nodes at
 * desktop-1440/operator:
 *   · `.bg-violet-500 > span`  white on #8b5cf6  4.23:1  (RecordRelatedListChips)
 *   · `.bg-white/20`           white on #517f87  4.43:1  (FilterableTimeline)
 * Both are white text on a mid-tone fill, and both were one Tailwind step too
 * light. `bg-white/20` is the more interesting of the two: it LIGHTENS the chip
 * underneath it, so the "subtle" treatment was the thing pushing the count
 * text below the floor.
 *
 * This test reads the classes the components really carry, so a re-skin back to
 * a `-500` fill fails here instead of in a browser six weeks later. It is not a
 * substitute for the axe sweep — axe grades what is on screen for the fixture;
 * this grades every chip colour in the map, including the ones no fixture
 * record happens to activate.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CHIPS = path.join(__dirname, 'RecordRelatedListChips.tsx');
const TIMELINE = path.join(__dirname, 'FilterableTimeline.tsx');

/** WCAG 2.1 1.4.3 — every string in these two files is ≤16px, non-bold. */
const AA_TEXT = 4.5;

type Rgb = [number, number, number];

function channels(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [rr, gg, bb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(channels(a)), relativeLuminance(channels(b))].sort(
    (x, y) => y - x,
  );
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Stock Tailwind — the only palette these two files draw from. */
const PALETTE: Record<string, string> = {
  white: '#ffffff',
  'teal-500': '#14b8a6', 'teal-600': '#0d9488', 'teal-700': '#0f766e', 'teal-800': '#115e59', 'teal-900': '#134e4a',
  'amber-500': '#f59e0b', 'amber-600': '#d97706', 'amber-700': '#b45309',
  'cyan-500': '#06b6d4', 'cyan-600': '#0891b2', 'cyan-700': '#0e7490',
  'emerald-500': '#10b981', 'emerald-600': '#059669', 'emerald-700': '#047857',
  'violet-500': '#8b5cf6', 'violet-600': '#7c3aed', 'violet-700': '#6d28d9',
  'indigo-500': '#6366f1', 'indigo-600': '#4f46e5', 'indigo-700': '#4338ca',
  'pink-500': '#ec4899', 'pink-600': '#db2777', 'pink-700': '#be185d',
  'purple-500': '#a855f7', 'purple-600': '#9333ea', 'purple-700': '#7e22ce',
  'orange-500': '#f97316', 'orange-600': '#ea580c', 'orange-700': '#c2410c',
  'sky-500': '#0ea5e9', 'sky-600': '#0284c7', 'sky-700': '#0369a1',
  'fuchsia-500': '#d946ef', 'fuchsia-600': '#c026d3', 'fuchsia-700': '#a21caf',
  'rose-500': '#f43f5e', 'rose-600': '#e11d48', 'rose-700': '#be123c',
};

describe('RecordRelatedListChips — the ACTIVE chip is white on a solid fill', () => {
  const source = readFileSync(CHIPS, 'utf8');
  const actives = [...source.matchAll(/active:\s*'bg-([a-z]+-\d{3}) text-white/g)].map((m) => m[1]);

  it('finds every active chip style (guards against the regex silently matching nothing)', () => {
    // 13 hue entries + the fallback style at the bottom of the file.
    expect(actives.length).toBeGreaterThanOrEqual(13);
  });

  it('paints white text on a fill that clears 4.5:1 — every hue in the map', () => {
    const failures = actives
      .map((shade) => {
        const hex = PALETTE[shade];
        expect(hex, `add ${shade} to PALETTE`).toBeDefined();
        return { shade, r: ratio('#ffffff', hex) };
      })
      .filter(({ r }) => r < AA_TEXT);
    // Named, not counted: a bare "1 failure" makes the next reader re-measure.
    expect(failures.map((f) => `${f.shade} ${f.r}:1`)).toEqual([]);
  });

  it('keeps the border on the same colour as the fill', () => {
    const source2 = readFileSync(CHIPS, 'utf8');
    for (const [, fill, border] of source2.matchAll(
      /active:\s*'bg-([a-z]+-\d{3}) text-white border-([a-z]+-\d{3})/g,
    )) {
      expect(border).toBe(fill);
    }
  });
});

describe('FilterableTimeline — the active pill and its count badge', () => {
  const source = readFileSync(TIMELINE, 'utf8');

  it('paints the active pill on a fill white text can sit on', () => {
    const m = /active\s*\n?\s*\?\s*'bg-([a-z]+-\d{3}) border-[a-z]+-\d{3} text-white'/.exec(source);
    expect(m, 'the active pill style moved — update this test with it').not.toBeNull();
    expect(ratio('#ffffff', PALETTE[m![1]])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('never lightens the count badge with a translucent white', () => {
    // The original defect: `bg-white/20` composited the chip UP toward white,
    // so white-on-white-ish measured 4.43:1.
    expect(source).not.toMatch(/\?\s*'bg-white\/\d+ text-white'/);
  });

  it('paints the active count badge dark enough for white text', () => {
    const m = /active\s*\n?\s*\?\s*'bg-([a-z]+-\d{3}) text-white'/.exec(source);
    expect(m, 'the active count-badge style moved — update this test with it').not.toBeNull();
    expect(ratio('#ffffff', PALETTE[m![1]])).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
