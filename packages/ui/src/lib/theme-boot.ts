/**
 * Shared theme + density persistence for the operator consoles.
 *
 * Previously the CRM stored its theme under `crm-theme` and the Admin console
 * under `admin-theme`, so a user who chose dark mode in one console landed in
 * light mode in the other. Both consoles now read and write ONE key, and
 * migrate the legacy per-app value on first read so nobody loses their choice.
 *
 * The pre-paint boot script is generated here rather than hand-written inline
 * in each `layout.tsx`, so the reader (boot script) and the writer
 * (`ThemeProvider`) can never drift apart again.
 */

export type Theme = 'light' | 'dark' | 'system';

/** Neutral key — do not use product prefixes (visible in DevTools storage). */
export const THEME_STORAGE_KEY = 'ui-theme';

/**
 * Per-app keys migrated on first read. Order matters only in the pathological
 * case where a browser holds both; the first hit wins.
 */
export const LEGACY_THEME_STORAGE_KEYS = [
  'dhh-theme',
  'crm-theme',
  'admin-theme',
] as const;

/** Neutral density key. */
export const DENSITY_STORAGE_KEY = 'ui-density';

/** Per-app density keys migrated on first read. */
export const LEGACY_DENSITY_STORAGE_KEYS = ['dhh-density', 'crm-density'] as const;

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Read the persisted theme, migrating a legacy per-app value into the shared
 * key when found. Safe to call during render guards — returns null rather than
 * throwing when storage is unavailable (private mode, blocked cookies, SSR).
 */
export function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const current = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(current)) return current;

    for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (isTheme(legacy)) {
        window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
        return legacy;
      }
    }
  } catch {
    // Storage unavailable — fall through to the caller's default.
  }
  return null;
}

export function writeStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session.
  }
}

interface ThemeBootOptions {
  /**
   * Canvas colour painted before first paint to prevent a white flash.
   *
   * These MUST match the app shell's actual background. The CRM previously
   * hardcoded `#0f172a` (slate-900) while its shell rendered `bg-slate-950`
   * (`#020617`), so the anti-flash script produced the very flash it existed
   * to prevent.
   */
  lightBg: string;
  darkBg: string;
  /**
   * Apply the persisted display density pre-paint, so chrome tokens (bar
   * heights, gutters, section gaps) render at the chosen scale with no reflow.
   * Users with no saved preference get `compact` — these are data-heavy
   * consoles, so more rows per screen is the right default.
   */
  density?: boolean;
}

/**
 * Build the inline pre-paint boot script. Must run in <head> before any paint.
 *
 * Returns plain ES5 for `dangerouslySetInnerHTML` — no imports, no optional
 * chaining, no template literals, so it parses everywhere without transpiling.
 */
export function createThemeBootScript({
  lightBg,
  darkBg,
  density = false,
}: ThemeBootOptions): string {
  const legacyKeys = LEGACY_THEME_STORAGE_KEYS.map((key) => JSON.stringify(key)).join(',');

  return `
(function() {
  try {
    var html = document.documentElement;
    var KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
    var LEGACY = [${legacyKeys}];
    var valid = function(v) { return v === 'light' || v === 'dark' || v === 'system'; };

    var theme = localStorage.getItem(KEY);
    if (!valid(theme)) {
      // Migrate the legacy per-app key so an existing choice survives.
      theme = null;
      for (var i = 0; i < LEGACY.length; i++) {
        var legacy = localStorage.getItem(LEGACY[i]);
        if (valid(legacy)) {
          theme = legacy;
          try { localStorage.setItem(KEY, legacy); } catch (e) {}
          break;
        }
      }
    }
    if (!valid(theme)) theme = 'light';

    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    html.classList.remove('light', 'dark');
    html.classList.add(resolved);
    html.style.colorScheme = resolved;
    html.style.backgroundColor = resolved === 'dark' ? ${JSON.stringify(darkBg)} : ${JSON.stringify(lightBg)};
${
  density
    ? `
    var DKEY = ${JSON.stringify(DENSITY_STORAGE_KEY)};
    var DLEGACY = [${LEGACY_DENSITY_STORAGE_KEYS.map((k) => JSON.stringify(k)).join(',')}];
    var dValid = function(v) { return v === 'compact' || v === 'default' || v === 'comfortable'; };
    var d = localStorage.getItem(DKEY);
    if (!dValid(d)) {
      d = null;
      for (var j = 0; j < DLEGACY.length; j++) {
        var dLegacy = localStorage.getItem(DLEGACY[j]);
        if (dValid(dLegacy)) {
          d = dLegacy;
          try { localStorage.setItem(DKEY, dLegacy); } catch (e) {}
          break;
        }
      }
    }
    if (d === 'compact' || d === 'comfortable') {
      html.setAttribute('data-density', d);
    } else if (d === 'default') {
      html.removeAttribute('data-density');
    } else {
      // No saved preference: these are data-heavy consoles, so more rows per
      // screen is the right out-of-box default.
      html.setAttribute('data-density', 'compact');
    }`
    : ''
}
  } catch (e) {
    document.documentElement.classList.add('light');
    document.documentElement.style.backgroundColor = ${JSON.stringify(lightBg)};
  }
})();
`;
}
