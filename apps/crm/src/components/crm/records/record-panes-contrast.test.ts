/**
 * A11Y-2 contrast — the record's Timeline and Files panes, computed from the
 * classes the components really carry.
 *
 * WHY THIS FILE EXISTS. `RecordTimeline` and `AttachmentsPanel` were authored
 * against a dark-only design: `text-white`, `text-slate-300`, `bg-slate-800/50`
 * with no light counterpart. Both mount behind `?pane=` on the record page, so
 * the axe sweep — which only ever opened the Overview pane — never saw them,
 * and the 2026-08-23 acceptance review found them by reading the source
 * (regrade item 12: `RecordTimeline.tsx` 82/117/192/431,
 * `AttachmentsPanel.tsx` 114/320). In the light theme those inks composite to
 * 1.06–2.4:1 — a white heading on a white card is not dim, it is INVISIBLE.
 *
 * The walk now opens both panes (`A11Y-axe-chrome`, both themes), which catches
 * whatever is on screen for the fixture. This test covers what axe cannot: the
 * states the fixture does not produce (a stage change, an activity, an
 * attachment row, the loading skeleton) and the non-text targets axe does not
 * grade (icon tiles, the drop-zone boundary). Between them nothing in these two
 * panes is unmeasured.
 *
 * The grounds are MEASURED, not assumed: `A11Y-axe-chrome` probes the painted
 * background of the timeline card and the Files pane in both themes and records
 * them in walk.json (`light timeline card ground`, `dark timeline card ground`,
 * …). The values below are those readings.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TIMELINE = path.join(__dirname, 'RecordTimeline.tsx');
const ATTACHMENTS = path.join(__dirname, 'AttachmentsPanel.tsx');
const GLOBALS = path.join(__dirname, '../../../app/globals.css');

/** WCAG 2.1 1.4.3 — text under 18.66px/bold-14px. Everything here is ≤16px. */
const AA_TEXT = 4.5;
/** WCAG 2.1 1.4.11 — icons, tiles and control boundaries. */
const AA_NON_TEXT = 3;

// ── colour plumbing ────────────────────────────────────────────────────────

type Rgb = [number, number, number];

function channels(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

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

/** Stock Tailwind, the palette these two files draw from. */
const PALETTE: Record<string, string> = {
  white: '#ffffff',
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  'slate-950': '#020617',
  'purple-400': '#c084fc',
  'purple-600': '#9333ea',
  'blue-400': '#60a5fa',
  'blue-600': '#2563eb',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',
  'cyan-400': '#22d3ee',
  'cyan-600': '#0891b2',
  'cyan-700': '#0e7490',
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  'teal-700': '#0f766e',
  'red-300': '#fca5a5',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'purple-500': '#a855f7',
  'blue-500': '#3b82f6',
  'cyan-500': '#06b6d4',
  'slate-500-tint': '#64748b',
};

/**
 * `text-slate-400` / `text-slate-500` do NOT paint stock slate: A11Y-1 rebound
 * them per theme to --crm-ink-dim / --crm-ink-muted (tailwind.config.ts
 * textColor → globals.css). Read the real values so this test moves when the
 * tokens move — the same contract `globals-contrast.test.ts` enforces.
 */
function inkTokens(selector: ':root' | '.dark'): { dim: Rgb; muted: Rgb } {
  const css = readFileSync(GLOBALS, 'utf8');
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `globals.css must declare ${selector}`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf('\n}', start));
  const read = (name: string): Rgb => {
    const m = new RegExp(`${name}\\s*:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(block);
    expect(m, `${selector} must declare ${name} as an "R G B" triple`).not.toBeNull();
    return [Number(m![1]), Number(m![2]), Number(m![3])];
  };
  return { dim: read('--crm-ink-dim'), muted: read('--crm-ink-muted') };
}

const INK = { light: inkTokens(':root'), dark: inkTokens('.dark') };

type Theme = 'light' | 'dark';

/** A Tailwind text/bg/border class → the colour it actually paints, per theme. */
function paint(token: string, theme: Theme): { rgb: Rgb; alpha: number } {
  const [name, alphaPart] = token.split('/');
  const alpha = alphaPart ? Number(alphaPart) / 100 : 1;
  if (name === 'ink-dim') return { rgb: INK[theme].dim, alpha };
  if (name === 'ink-muted') return { rgb: INK[theme].muted, alpha };
  const hex = PALETTE[name];
  expect(hex, `unknown palette entry: ${name}`).toBeTruthy();
  return { rgb: channels(hex), alpha };
}

/**
 * The painted ground: the pane background with each translucent layer above it
 * composited on top, bottom-first — the same walk axe (and `probeGround` in
 * walk-a11y.spec.ts) performs.
 */
function ground(base: string, layers: string[], theme: Theme): Rgb {
  let out = channels(base);
  for (const layer of layers) {
    const { rgb, alpha } = paint(layer, theme);
    out = composite(rgb, alpha, out);
  }
  return out;
}

/**
 * The grounds these panes paint on, read off the running app by
 * `A11Y-axe-chrome`'s `probeGround` (walk.json note `light/dark timeline card
 * ground`). Light `.glass-card` is rgba(255,255,255,.92) over a white --card,
 * so it resolves to white; the dark card is the CRM canvas card token with the
 * glass gradient over it.
 */
const GROUND: Record<Theme, { card: string; pane: string }> = {
  // Measured by `probeGround`, run 2026-08-23T17-05-16-702Z:
  //   light timeline card ground #fefefe · light files pane ground #f2f5f8
  //   dark  … ground #060b16 (+gradient overlay)
  // The dark `.glass-card` paints a rgba(15,23,42,.7)→(.5) gradient that a
  // backgroundColor probe cannot sample, so the card row below is that gradient
  // composited over the measured canvas at its LIGHTEST stop (.7) — the worst
  // case for the light ink sitting on it.
  light: { card: '#fefefe', pane: '#f2f5f8' },
  dark: { card: '#0c1324', pane: '#060b16' },
};

interface Pair {
  what: string;
  where: string;
  /** Text class (without the `text-` prefix), resolved per theme. */
  fg: Record<Theme, string>;
  /** Translucent layers over the pane/card ground, bottom-first. */
  layers?: Record<Theme, string[]>;
  on?: 'card' | 'pane';
  target?: number;
}

/**
 * Every pair the two panes paint. `fg.light` / `fg.dark` are what the class
 * chain resolves to in that theme — e.g. `text-slate-900 dark:text-white` is
 * `{ light: 'slate-900', dark: 'white' }`.
 */
const PAIRS: Pair[] = [
  // ── RecordTimeline ──────────────────────────────────────────────────────
  {
    what: 'stage-change badge ink (from/to stage)',
    where: 'RecordTimeline.tsx:82',
    fg: { light: 'slate-700', dark: 'slate-300' },
    layers: { light: ['slate-100'], dark: ['slate-800/50'] },
  },
  {
    what: 'stage-change badge boundary',
    where: 'RecordTimeline.tsx:82',
    fg: { light: 'slate-300', dark: 'slate-600' },
    layers: { light: ['slate-100'], dark: ['slate-800/50'] },
    target: 0, // recorded, not gated: the badge ink carries the meaning, the border is decoration
  },
  {
    what: 'activity title',
    where: 'RecordTimeline.tsx:110',
    fg: { light: 'slate-900', dark: 'white' },
    on: 'card',
  },
  {
    what: 'activity status badge ink (open)',
    where: 'RecordTimeline.tsx:117',
    fg: { light: 'slate-700', dark: 'slate-300' },
    layers: { light: ['slate-100'], dark: ['slate-800/50'] },
  },
  {
    what: 'activity status badge ink (completed)',
    where: 'RecordTimeline.tsx:116',
    fg: { light: 'green-700', dark: 'green-400' },
    layers: { light: ['green-500/10'], dark: ['green-500/10'] },
  },
  {
    what: 'note body',
    where: 'RecordTimeline.tsx:151',
    fg: { light: 'slate-700', dark: 'slate-300' },
    on: 'card',
  },
  {
    what: 'attachment-event tile icon',
    where: 'RecordTimeline.tsx:192',
    fg: { light: 'ink-muted', dark: 'ink-dim' },
    layers: { light: ['slate-100'], dark: ['slate-800/50'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'attachment-event file name',
    where: 'RecordTimeline.tsx:196',
    fg: { light: 'slate-900', dark: 'white' },
    on: 'card',
  },
  {
    what: 'CSV / approval event body',
    where: 'RecordTimeline.tsx:230,256,286,301,308',
    fg: { light: 'slate-700', dark: 'slate-300' },
    on: 'card',
  },
  {
    what: 'meta-row separator “•”',
    where: 'RecordTimeline.tsx:380,395',
    fg: { light: 'ink-dim', dark: 'ink-dim' },
    on: 'pane',
    target: AA_NON_TEXT,
  },
  {
    what: 'meta-row relative time',
    where: 'RecordTimeline.tsx:392',
    fg: { light: 'ink-muted', dark: 'ink-muted' },
    on: 'pane',
  },
  {
    what: 'loading skeleton block',
    where: 'RecordTimeline.tsx:431,433',
    fg: { light: 'slate-200', dark: 'slate-800/50' },
    on: 'pane',
    target: 0, // a skeleton is decorative; recorded so a re-skin cannot make it black-on-white again
  },
  {
    what: 'filter chip ink (inactive)',
    where: 'RecordTimeline.tsx:454,473',
    fg: { light: 'slate-700', dark: 'slate-300' },
    on: 'pane',
  },
  {
    // Found by the widened sweep, not by reading: axe measured the count at
    // 4.15:1 because `opacity-70` fades the chip ink AND everything in it.
    // Opacity is not a colour, so no token could have caught this — only the
    // composited pixel does. 80% keeps the "quieter than the label" intent.
    what: 'filter chip count, faded by opacity-80',
    where: 'RecordTimeline.tsx:478',
    fg: { light: 'slate-700/80', dark: 'slate-300/80' },
    on: 'pane',
  },
  {
    what: 'empty-state heading',
    where: 'RecordTimeline.tsx:494',
    fg: { light: 'slate-900', dark: 'white' },
    on: 'pane',
  },
  {
    what: 'stage-change event icon',
    where: 'RecordTimeline.tsx:55',
    fg: { light: 'purple-600', dark: 'purple-400' },
    layers: { light: ['purple-500/10'], dark: ['purple-500/10'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'activity event icon',
    where: 'RecordTimeline.tsx:56',
    fg: { light: 'blue-600', dark: 'blue-400' },
    layers: { light: ['blue-500/10'], dark: ['blue-500/10'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'note event icon',
    where: 'RecordTimeline.tsx:57',
    fg: { light: 'amber-700', dark: 'amber-400' },
    layers: { light: ['amber-500/10'], dark: ['amber-500/10'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'attachment event icon',
    where: 'RecordTimeline.tsx:58',
    fg: { light: 'cyan-700', dark: 'cyan-400' },
    layers: { light: ['cyan-500/10'], dark: ['cyan-500/10'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'audit event icon',
    where: 'RecordTimeline.tsx:59',
    fg: { light: 'ink-dim', dark: 'ink-dim' },
    layers: { light: ['slate-500/10'], dark: ['slate-500/10'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'message event icon',
    where: 'RecordTimeline.tsx:60',
    fg: { light: 'green-700', dark: 'green-400' },
    layers: { light: ['green-500/10'], dark: ['green-500/10'] },
    target: AA_NON_TEXT,
  },
  // ── AttachmentsPanel ────────────────────────────────────────────────────
  {
    what: 'attachment row tile icon',
    where: 'AttachmentsPanel.tsx:114',
    fg: { light: 'ink-muted', dark: 'ink-dim' },
    layers: { light: ['slate-100'], dark: ['slate-800/50'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'attachment file name',
    where: 'AttachmentsPanel.tsx:120',
    fg: { light: 'slate-900', dark: 'white' },
    layers: { light: ['slate-50'], dark: ['slate-900/30'] },
  },
  {
    what: 'attachment size / age',
    where: 'AttachmentsPanel.tsx:127',
    fg: { light: 'ink-muted', dark: 'ink-muted' },
    layers: { light: ['slate-50'], dark: ['slate-900/30'] },
  },
  {
    what: 'row action icon (rest)',
    where: 'AttachmentsPanel.tsx:149,163',
    fg: { light: 'ink-muted', dark: 'ink-dim' },
    layers: { light: ['slate-50'], dark: ['slate-900/30'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'delete menu item',
    where: 'AttachmentsPanel.tsx:171',
    fg: { light: 'slate-700', dark: 'slate-300' },
    on: 'card',
  },
  {
    what: 'delete menu item (destructive)',
    where: 'AttachmentsPanel.tsx:181',
    fg: { light: 'red-600', dark: 'red-400' },
    on: 'card',
  },
  {
    what: 'delete menu item, focused',
    where: 'AttachmentsPanel.tsx:181',
    fg: { light: 'red-700', dark: 'red-300' },
    layers: { light: ['red-500/10'], dark: ['red-500/10'] },
  },
  {
    what: 'menu separator',
    where: 'AttachmentsPanel.tsx:178',
    fg: { light: 'slate-200', dark: 'white/10' },
    on: 'card',
    target: 0, // a 1px hairline is decoration; gated only against being INVISIBLE (see the dark-only-ink scan)
  },
  {
    what: 'drop-zone boundary (the control outline)',
    where: 'AttachmentsPanel.tsx:311',
    fg: { light: 'slate-500', dark: 'slate-500' },
    on: 'pane',
    target: AA_NON_TEXT,
  },
  {
    what: 'drop-zone tile icon',
    where: 'AttachmentsPanel.tsx:320',
    fg: { light: 'ink-muted', dark: 'ink-dim' },
    layers: { light: ['slate-100'], dark: ['slate-800/50'] },
    target: AA_NON_TEXT,
  },
  {
    what: 'drop-zone prompt',
    where: 'AttachmentsPanel.tsx:324',
    fg: { light: 'slate-900', dark: 'white' },
    on: 'pane',
  },
  {
    what: 'drop-zone hint',
    where: 'AttachmentsPanel.tsx:327',
    fg: { light: 'ink-muted', dark: 'ink-muted' },
    on: 'pane',
  },
  {
    what: 'empty-state heading (what a crm_viewer sees)',
    where: 'AttachmentsPanel.tsx:391',
    fg: { light: 'slate-900', dark: 'white' },
    on: 'pane',
  },
];

function measure(pair: Pair, theme: Theme): number {
  const base = GROUND[theme][pair.on ?? 'card'];
  const bg = ground(base, pair.layers?.[theme] ?? [], theme);
  const { rgb, alpha } = paint(pair.fg[theme], theme);
  // A faded ink (opacity / an alpha modifier) is measured as the pixel it
  // paints, which is what axe grades — not as its nominal colour.
  return ratio(alpha < 1 ? composite(rgb, alpha, bg) : rgb, bg);
}

describe('the record Timeline and Files panes clear contrast in BOTH themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const pair of PAIRS) {
      const target = pair.target ?? AA_TEXT;
      const title = `${theme} · ${pair.what} (${pair.where})`;
      if (target === 0) {
        it(`${title} — recorded, not gated`, () => {
          expect(measure(pair, theme)).toBeGreaterThan(0);
        });
        continue;
      }
      it(`${title} ≥ ${target}:1`, () => {
        expect(measure(pair, theme)).toBeGreaterThanOrEqual(target);
      });
    }
  }
});

/**
 * The invariant behind every pair above: neither pane may carry a DARK-ONLY
 * ink. Both files were written for a dark canvas, so a single un-prefixed
 * `text-white` re-creates the whole defect class (a white heading on a white
 * card) in one edit. Every banned token must be reached through a `dark:`
 * variant.
 */
describe('no dark-only ink survives in either pane', () => {
  // Only inks that VANISH on a light ground. `border-slate-600` is 7.5:1 on
  // white — legitimate there — so it is measured as a pair above instead of
  // being banned here; a ban that flags a correct class trains people to
  // delete the rule.
  const BANNED = [
    'text-white',
    'text-slate-300',
    'bg-slate-800',
    'bg-slate-900',
    'border-white',
    'bg-white/',
  ];

  for (const file of [TIMELINE, ATTACHMENTS]) {
    const name = path.basename(file);
    const source = readFileSync(file, 'utf8');
    for (const banned of BANNED) {
      it(`${name} — every \`${banned}\` is behind a dark: variant`, () => {
        const pattern = new RegExp(`(^|[\\s'"\`])((?:[a-z-]+:)*)${banned.replace('/', '\\/')}`, 'g');
        const bare: string[] = [];
        for (const match of source.matchAll(pattern)) {
          const variants = match[2] ?? '';
          if (!variants.includes('dark:')) {
            const line = source.slice(0, match.index ?? 0).split('\n').length;
            bare.push(`${name}:${line} — ${variants}${banned}`);
          }
        }
        expect(bare, 'a dark-only ink paints itself onto the light theme').toEqual([]);
      });
    }
  }
});
