/**
 * Auth-scoped typefaces — the landing family's display + ledger voice.
 *
 *  --font-display : Bricolage Grotesque, read by `--lp-font-display`
 *  --font-mono    : IBM Plex Mono, read by `--lp-font-mono`
 *
 * Loaded HERE and not in `app/layout.tsx`, exactly as apps/crm and apps/admin
 * load them on their landing roots: the advisor portal is a console first and
 * its Editorial Luxury type (Fraunces display, Plus Jakarta body) must not
 * change on a single portal screen. These variables are applied on the auth
 * shell only — see AdvisorAuthShell.
 *
 * Without them this app is the one surface in the family that CANNOT match:
 * `app/layout.tsx` sets `--font-display` to Fraunces globally, so the auth
 * hero would render the family's display line in a serif while every other
 * product's did not.
 *
 * `preload: false` matches the app's existing loaders and keeps the front
 * door's critical path clear; `display: 'swap'` plus the explicit fallbacks
 * mean a fetch failure degrades to Plus Jakarta / system mono rather than
 * blocking sign-in.
 */
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';

const authDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

const authMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

/** Apply on the auth shell root only. */
export const advisorAuthFontVars = `${authDisplay.variable} ${authMono.variable}`;
