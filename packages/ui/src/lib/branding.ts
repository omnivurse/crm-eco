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

/** sRGB channel → linear-light, per WCAG 2.x relative luminance. */
function srgbToLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance (0 = black, 1 = white) of a hex color, or null when
 * the hex is not parseable.
 */
export function hexRelativeLuminance(hex: string): number | null {
  if (typeof hex !== 'string') return null;
  let value = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const r = srgbToLinear(parseInt(value.slice(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(value.slice(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(value.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Foreground triples: near-white paper and near-black ink (theme.css scale). */
const FOREGROUND_LIGHT = '210 40% 98%';
const FOREGROUND_DARK = '222 47% 11%';
const LUM_LIGHT = 0.9498; // relative luminance of hsl(210 40% 98%)
const LUM_DARK = 0.0113; // relative luminance of hsl(222 47% 11%)

/**
 * Pick the foreground (paper or ink) with the higher WCAG contrast against a
 * tenant color, so text on `bg-<token>` stays readable whatever the tenant
 * chose. Returns '' for unparseable hex.
 *
 * Why this exists: a tenant that overrides `--secondary` to a saturated blue
 * (PIFH: #1d4ed8) inherited the CRM's ink `--secondary-foreground` (meant for
 * its muted-gray secondary) → blue pills with black text.
 */
export function hexToContrastForegroundTriple(hex: string): string {
  const lum = hexRelativeLuminance(hex);
  if (lum === null) return '';
  const contrastWithLight = (LUM_LIGHT + 0.05) / (lum + 0.05);
  const contrastWithDark = (lum + 0.05) / (LUM_DARK + 0.05);
  return contrastWithLight >= contrastWithDark ? FOREGROUND_LIGHT : FOREGROUND_DARK;
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
 * Build the override declarations (color + contrast foreground per resolvable
 * token) as a string like
 * "--primary: 187 94% 43%;--primary-foreground: 210 40% 98%;--secondary: …".
 * Returns '' when nothing resolves to a valid hex.
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
    // Every overridden surface token gets a matching readable foreground;
    // otherwise the app's own `--<token>-foreground` (tuned for ITS default
    // color) is applied on top of the tenant color.
    const foreground = hexToContrastForegroundTriple(raw);
    if (foreground) decls.push(`--${token}-foreground: ${foreground};`);
  }

  return decls.join('');
}

export interface ResolvedBrandDisplay {
  companyName: string | null;
  logoUrl: string | null;
}

/** Read company name + logo URL from organizations.branding jsonb. */
export function resolveBrandDisplay(
  branding?: Record<string, unknown> | null,
  orgName?: string | null,
): ResolvedBrandDisplay {
  const record = asRecord(branding);
  const pickString = (...candidates: unknown[]): string | null => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    return null;
  };

  const logoUrl = record
    ? pickString(record.logo_url, record.logoUrl, record.logo)
    : null;
  const companyName =
    pickString(record?.company_name, record?.companyName, record?.name) ??
    (orgName?.trim() || null);

  return { companyName, logoUrl };
}

/** CSS custom properties for inline `style` (avoids dangerouslySetInnerHTML). */
export function brandingToCssVariables(
  branding?: Record<string, unknown> | null,
): Record<string, string> {
  const decls = brandingToDeclarations(branding);
  if (!decls) return {};

  const vars: Record<string, string> = {};
  for (const chunk of decls.split(';')) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith('--')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key && value) vars[key] = value;
  }
  return vars;
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
