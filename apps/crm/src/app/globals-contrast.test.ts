/**
 * A11Y-1 contrast — the CRM chrome tokens, read out of the real globals.css.
 *
 * The colour-contrast row was 111 axe nodes, and they came from a handful of
 * TOKEN pairs, not 111 component decisions:
 *
 *   - `text-slate-400` / `text-slate-500`, the dim-chrome inks. Stock Tailwind
 *     put them at 2.19–2.56:1 in light (section headers, kbd chips, counts,
 *     inline-edit prompts) and `dark:text-slate-500` at 3.07–4.13:1 in dark.
 *     They now resolve through --crm-ink-dim / --crm-ink-muted, per theme.
 *   - the status TONE pair: every tone paints its own fg on its own 14%-alpha
 *     tint, so it must clear AA against THAT tint, not against white.
 *     `attention` (4.14:1) and `success` (4.49:1) did not.
 *
 * This test parses the stylesheet rather than restating the values, so editing
 * a token to a failing colour fails here instead of in the next axe run. The
 * backgrounds are the ones axe actually measured on the walked surfaces.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

/** WCAG 2.1 1.4.3 — normal-size body text. All of these are ≤14px. */
const AA_TEXT = 4.5;

/** Grounds axe measured the dim inks against on the four walked surfaces. */
const LIGHT_GROUNDS: Record<string, string> = {
  'card / row': '#ffffff',
  'sticky header': '#fefefe',
  'palette section': '#fafbfc',
  'search pill': '#f9fbfd',
  'list toolbar': '#f2f5f8',
  'kbd chip (bg-slate-200/60)': '#e9eef4',
};
const DARK_GROUNDS: Record<string, string> = {
  'canvas (--background)': '#060b16',
  'card (--card)': '#0a101d',
  'popover': '#0d1424',
  'slate-800 chip': '#1e293b',
};

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

function composite(
  fg: [number, number, number],
  alpha: number,
  bg: [number, number, number],
): [number, number, number] {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as [number, number, number];
}

/** The `:root { … }` and `.dark { … }` blocks declared by globals.css itself. */
function block(selector: ':root' | '.dark'): string {
  const start = CSS.indexOf(`\n${selector} {`);
  expect(start, `globals.css must declare ${selector}`).toBeGreaterThan(-1);
  const end = CSS.indexOf('\n}', start);
  return CSS.slice(start, end);
}

function declaration(selector: ':root' | '.dark', name: string): string {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block(selector));
  expect(match, `${selector} must declare ${name}`).not.toBeNull();
  return match![1].trim();
}

/** `91 106 126` (an --crm-ink-* triple) or `#056b4e` / `#056b4e24`. */
function color(value: string): { rgb: [number, number, number]; alpha: number } {
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    return {
      rgb: channels(`#${hex.slice(0, 6)}`),
      alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  const parts = value.split(/\s+/).map(Number);
  expect(parts, `not an "R G B" triple: ${value}`).toHaveLength(3);
  return { rgb: parts as [number, number, number], alpha: 1 };
}

describe('--crm-ink-dim / --crm-ink-muted clear AA on the grounds they paint on', () => {
  const cases = [
    { selector: ':root' as const, grounds: LIGHT_GROUNDS, theme: 'light' },
    { selector: '.dark' as const, grounds: DARK_GROUNDS, theme: 'dark' },
  ];

  for (const { selector, grounds, theme } of cases) {
    for (const token of ['--crm-ink-dim', '--crm-ink-muted']) {
      for (const [label, ground] of Object.entries(grounds)) {
        it(`${theme} ${token} on ${label}`, () => {
          const ink = color(declaration(selector, token)).rgb;
          expect(ratio(ink, channels(ground))).toBeGreaterThanOrEqual(AA_TEXT);
        });
      }
    }
  }

  it('keeps the 400-lighter-than-500 ladder in both themes', () => {
    for (const { selector } of cases) {
      const dim = relativeLuminance(color(declaration(selector, '--crm-ink-dim')).rgb);
      const muted = relativeLuminance(color(declaration(selector, '--crm-ink-muted')).rgb);
      expect(dim, `${selector}: slate-400 must stay lighter than slate-500`).toBeGreaterThan(muted);
    }
  });

  it('declares the inks as "R G B" triples so Tailwind alpha modifiers still work', () => {
    for (const { selector } of cases) {
      for (const token of ['--crm-ink-dim', '--crm-ink-muted']) {
        expect(declaration(selector, token)).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
      }
    }
  });
});

describe('status tones clear AA against their own tint', () => {
  const TONES = ['neutral', 'info', 'progress', 'attention', 'success', 'danger', 'special'] as const;
  // A tone pill is painted on the surface under it, so the tint composites over
  // white in light and over the card in dark — the same grounds axe measured.
  const cases = [
    { selector: ':root' as const, theme: 'light', under: '#ffffff' },
    { selector: '.dark' as const, theme: 'dark', under: '#0a101d' },
  ];

  for (const { selector, theme, under } of cases) {
    for (const tone of TONES) {
      it(`${theme} ${tone}`, () => {
        const fg = color(declaration(selector, `--tone-${tone}-fg`));
        const bg = color(declaration(selector, `--tone-${tone}-bg`));
        expect(fg.alpha, 'a tone foreground must be opaque').toBe(1);
        const painted = composite(bg.rgb, bg.alpha, channels(under));
        expect(ratio(fg.rgb, painted)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it('derives every tint and border from its own foreground hue', () => {
    for (const { selector } of cases) {
      for (const tone of TONES) {
        const fg = declaration(selector, `--tone-${tone}-fg`);
        expect(declaration(selector, `--tone-${tone}-bg`)).toContain(fg);
        expect(declaration(selector, `--tone-${tone}-border`)).toContain(fg);
      }
    }
  });
});
