/**
 * Tenant branding → CSS custom-property helpers (framework-agnostic, no React).
 *
 * The single canonical brand store is `organizations.branding` (jsonb). Both the
 * CRM and admin tenant resolvers read it verbatim as `Record<string, unknown>`
 * (see apps/crm/src/lib/tenant.ts and apps/admin/src/lib/tenant.ts), so the
 * shape is intentionally free-form. These helpers translate whatever brand
 * colors are present into the SAME token format the design system already uses:
 * space-separated HSL triples ("H S% L%") consumed via `hsl(var(--token))` in
 * packages/ui/tailwind.preset.ts and declared in packages/ui/src/styles/theme.css.
 *
 * Usage (server-rendered, in a root layout):
 *   const css = brandingToCssText(tenant.branding);
 *   // -> inject as a static <style dangerouslySetInnerHTML={{ __html: css }} />
 *
 * brandingToCssText returns '' for empty / unrecognizable branding so the
 * tenant falls through to the theme.css defaults (e.g. PIFH keeps branding='{}'
 * and provably renders the cyan #06b6d4 default).
 */

/** Tokens we allow tenants to override, mapped to their branding key aliases. */
const COLOR_TOKENS = ['primary', 'secondary', 'accent'] as const;
type ColorToken = (typeof COLOR_TOKENS)[number];

/**
 * Convert a hex color (#rgb, #rrggbb, with/without leading '#') into the
 * "H S% L%" triple format used by theme.css (e.g. "#06b6d4" -> "187 94% 43%").
 * Returns '' for anything that is not a parseable hex string.
 */
export function hexToHslTriple(hex: string): string {
  if (typeof hex !== 'string') return '';
  let value = hex.trim().replace(/^#/, '');

  // Expand shorthand (#abc -> #aabbcc)
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (!/^[0-9a-fA-F]{6}$/.test(value)) return '';

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  const hue = Math.round(h);
  const sat = Math.round(s * 100);
  const lum = Math.round(l * 100);

  return `${hue} ${sat}% ${lum}%`;
}

/** Narrow an unknown value to a plain object (jsonb columns can be anything). */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Resolve a single brand color from a branding object, tolerant of shapes:
 *   - nested:  branding.colors.primary
 *   - flat:    branding.primary_color  (and branding.primary)
 * Returns the raw color string (expected hex) or null.
 */
function readColor(
  branding: Record<string, unknown>,
  colors: Record<string, unknown> | null,
  token: ColorToken,
): string | null {
  const candidates: unknown[] = [
    colors?.[token],
    branding[`${token}_color`],
    branding[token],
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return null;
}

/**
 * Build the override declarations (one per resolvable token) as a string like
 * "--primary: 187 94% 43%;--secondary: 217 91% 60%;". Returns '' when nothing
 * resolves to a valid hex.
 */
function brandingToDeclarations(branding?: Record<string, unknown> | null): string {
  const record = asRecord(branding);
  if (!record) return '';

  const colors = asRecord(record.colors);
  const decls: string[] = [];

  for (const token of COLOR_TOKENS) {
    const raw = readColor(record, colors, token);
    if (!raw) continue;
    const triple = hexToHslTriple(raw);
    if (!triple) continue;
    decls.push(`--${token}: ${triple};`);
  }

  return decls.join('');
}

/**
 * Translate a tenant's `organizations.branding` object into a CSS string that
 * overrides the brand tokens in BOTH the light (`:root`) and dark (`.dark`)
 * scopes — theme.css re-declares the same tokens under `.dark`, so a
 * `:root`-only rule would be reverted the moment dark mode is active.
 *
 * Returns '' when no recognizable colors are present, so empty branding ('{}')
 * falls through to the theme.css defaults unchanged.
 */
export function brandingToCssText(branding?: Record<string, unknown> | null): string {
  const decls = brandingToDeclarations(branding);
  if (!decls) return '';
  return `:root{${decls}}.dark{${decls}}`;
}
