/**
 * A11Y-1 contrast — the record's compact section jump bar.
 *
 * These tabs are 12px interactive labels, so WCAG AA wants 4.5:1. They used to
 * be `text-<hue>-600/80`, and the alpha was the whole problem: it faded each
 * hue toward its own background (lime 2.42:1 on white, emerald 2.86, sky 3.04,
 * teal 4.43), and on the dark canvas `dark:text-<hue>-400/80` dropped the
 * spruce-remapped teal/cyan to 3.84:1.
 *
 * The test walks EVERY accent in the exported map — a new accent that ships a
 * failing pair fails here, not in a screen reader.
 */
import { describe, expect, it } from 'vitest';
import { MUTED_SPRUCE } from '@crm-eco/ui/tailwind.preset';
import { SECTION_COMPACT_NAV_ACCENT_CLASSES } from './section-accent-tokens';
import type { LayoutSectionAccent } from '@/lib/crm/types';

/** WCAG 2.1 1.4.3 — normal-size body text. The jump bar is 12px. */
const AA_TEXT = 4.5;
/** The light ground the jump bar sits on, and the dark canvas (--background). */
const LIGHT_GROUND = '#ffffff';
const DARK_GROUND = '#060b16';

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Composite `hex` at `alpha` over `ground` — what the browser actually paints. */
function composite(hex: string, alpha: number, ground: string): string {
  const fg = channels(hex);
  const bg = channels(ground);
  return `#${fg
    .map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * The shades these class names resolve to. teal/cyan are NOT stock Tailwind in
 * the operator consoles — `consoleColors` remaps them onto Muted Spruce, and
 * that remap is exactly why the dark teal tab failed, so the test reads the
 * real scale rather than restating Tailwind's.
 */
const SPRUCE = { 300: MUTED_SPRUCE[300], 400: MUTED_SPRUCE[400], 700: MUTED_SPRUCE[700], 800: MUTED_SPRUCE[800] };
/**
 * slate-400 / slate-500 are NOT stock Tailwind here either: tailwind.config.ts
 * binds those two TEXT shades to --crm-ink-dim / --crm-ink-muted, which differ
 * per theme (globals.css). The slate accent leans on both, so the test resolves
 * them the way the browser does.
 */
const CRM_INK: Record<'light' | 'dark', Record<number, string>> = {
  light: { 400: '#5b6a7e', 500: '#4f5d70' },
  dark: { 400: '#94a3b8', 500: '#8b99ad' },
};
const SHADES: Record<string, Record<number, string>> = {
  slate: { 100: '#f1f5f9', 300: '#cbd5e1', 700: '#334155', 800: '#1e293b', 900: '#0f172a' },
  emerald: { 300: '#6ee7b7', 400: '#34d399', 700: '#047857', 800: '#065f46' },
  blue: { 300: '#93c5fd', 400: '#60a5fa', 700: '#1d4ed8', 800: '#1e40af' },
  cyan: SPRUCE,
  teal: SPRUCE,
  purple: { 300: '#d8b4fe', 400: '#c084fc', 700: '#7e22ce', 800: '#6b21a8' },
  amber: { 300: '#fcd34d', 400: '#fbbf24', 700: '#b45309', 800: '#92400e' },
  rose: { 300: '#fda4af', 400: '#fb7185', 700: '#be123c', 800: '#9f1239' },
  pink: { 300: '#f9a8d4', 400: '#f472b6', 700: '#be185d', 800: '#9d174d' },
  indigo: { 300: '#a5b4fc', 400: '#818cf8', 700: '#4338ca', 800: '#3730a3' },
  sky: { 300: '#7dd3fc', 400: '#38bdf8', 700: '#0369a1', 800: '#075985' },
  violet: { 300: '#c4b5fd', 400: '#a78bfa', 700: '#6d28d9', 800: '#5b21b6' },
  orange: { 300: '#fdba74', 400: '#fb923c', 700: '#c2410c', 800: '#9a3412' },
  fuchsia: { 300: '#f0abfc', 400: '#e879f9', 700: '#a21caf', 800: '#86198f' },
  lime: { 300: '#bef264', 400: '#a3e635', 700: '#4d7c0f', 800: '#3f6212' },
};

/** `text-lime-700`, `dark:text-lime-400/80` → the painted colour on `ground`. */
function inkFrom(
  classes: string,
  theme: 'light' | 'dark',
  ground: string,
): string | null {
  const prefix = theme === 'dark' ? 'dark:text-' : 'text-';
  const pattern = new RegExp(`(?:^|\\s)${prefix}([a-z]+)-(\\d{3})(?:/(\\d{2}))?(?=\\s|$)`);
  const match = pattern.exec(classes);
  if (!match) return null;
  const [, hue, shade, alpha] = match;
  const hex =
    hue === 'slate' && CRM_INK[theme][Number(shade)]
      ? CRM_INK[theme][Number(shade)]
      : SHADES[hue]?.[Number(shade)];
  if (!hex) throw new Error(`no known hex for ${hue}-${shade} (add it to SHADES)`);
  return alpha ? composite(hex, Number(alpha) / 100, ground) : hex;
}

describe('section jump-bar accents clear WCAG AA', () => {
  const accents = Object.entries(SECTION_COMPACT_NAV_ACCENT_CLASSES) as Array<
    [LayoutSectionAccent, { active: string; inactive: string }]
  >;

  it('covers every accent the layout can assign', () => {
    expect(accents.length).toBeGreaterThan(10);
  });

  it.each(accents)('%s — light, both states', (_accent, set) => {
    for (const [state, classes] of Object.entries(set)) {
      const ink = inkFrom(classes, 'light', LIGHT_GROUND);
      expect(ink, `${state} has no light ink`).not.toBeNull();
      expect(contrastRatio(ink!, LIGHT_GROUND)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it.each(accents)('%s — dark, both states', (_accent, set) => {
    for (const [state, classes] of Object.entries(set)) {
      const ink = inkFrom(classes, 'dark', DARK_GROUND);
      expect(ink, `${state} has no dark ink`).not.toBeNull();
      expect(contrastRatio(ink!, DARK_GROUND)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('carries no alpha modifier on an ink — that was the original defect', () => {
    for (const [accent, set] of accents) {
      for (const [state, classes] of Object.entries(set)) {
        expect(classes, `${accent}.${state} fades its ink with an alpha modifier`).not.toMatch(
          /text-[a-z]+-\d{3}\/\d{2}/,
        );
      }
    }
  });
});
