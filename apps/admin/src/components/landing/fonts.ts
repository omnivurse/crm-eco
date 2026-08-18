/**
 * Landing-scoped typefaces.
 *
 * Loaded here — NOT in `app/layout.tsx` — so the marketing landing gets its
 * display/ledger voice without changing a byte of the Admin console's type.
 * The variables are applied on the landing root only.
 *
 *  --font-display : Bricolage Grotesque, read by `--lp-font-display`
 *  --font-mono    : IBM Plex Mono, read by `--lp-font-mono`
 *
 * Both tokens fall back through `--font-heading` / system mono in
 * `packages/ui/src/styles/ethereal.css`, so a fetch failure degrades to the
 * console's existing heading face rather than breaking the page.
 */
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';

const landingDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

const landingMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

/** Apply on the landing root element only. */
export const landingFontVars = `${landingDisplay.variable} ${landingMono.variable}`;
