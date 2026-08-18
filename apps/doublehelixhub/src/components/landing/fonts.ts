/**
 * Landing-scoped typefaces — doublehelixhub.com.
 *
 * Same two faces the CRM and MMS landings load, so the corporate site and the
 * two product sites read as one family:
 *
 *  --font-display : Bricolage Grotesque, read by `--lp-font-display`
 *  --font-mono    : IBM Plex Mono, read by `--lp-font-mono`
 *
 * Unlike apps/crm and apps/admin — which are consoles first and load these on
 * the landing root ONLY so the app shell's type is untouched — this app is the
 * marketing site end to end, so `layout.tsx` also puts `landingFontVars` on
 * <html>. That makes `--font-display` / `--font-mono` visible to the `:root`
 * declarations in ethereal.css, so `--lp-font-display` resolves everywhere.
 *
 * It changes nothing on the existing dh-* pages: those read `--font-body` /
 * `--font-heading` (Plus Jakarta Sans, still wired in layout.tsx). These two
 * variables are only ever consumed through the `--lp-*` tokens.
 *
 * Both tokens fall back through `--font-heading` / system mono in
 * `packages/ui/src/styles/ethereal.css`, so a fetch failure at build time
 * degrades to Plus Jakarta rather than breaking the page.
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

/**
 * Applied on <html> in `app/layout.tsx`, and again on each landing root by
 * `dhh-landing.module.css` `.root` (see the note there) so a page is correct
 * on its own even if the root layout ever stops carrying it.
 */
export const landingFontVars = `${landingDisplay.variable} ${landingMono.variable}`;
