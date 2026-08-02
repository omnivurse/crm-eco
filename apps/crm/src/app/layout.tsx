import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import { createThemeBootScript } from '@crm-eco/ui/lib/theme-boot';
import { LeadGenQuotePinGate } from '@crm-eco/ui/components/pin-lock-overlay';
import { ConfirmDialogHost } from '@crm-eco/ui/components/confirm-dialog';
import { PromptDialogHost } from '@crm-eco/ui/components/prompt-dialog';
import { RootProviders } from '@/components/providers/RootProviders';
import { getActiveTenant } from '@/lib/tenant';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700'],
  display: 'swap',
  preload: false,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

/**
 * PWA Metadata Configuration
 */
export const metadata: Metadata = {
  title: 'Double Helix Hub | Health Management Platform',
  description: 'Modern management platform for health sharing and insurance organizations',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon-32.png', type: 'image/png', sizes: '32x32' }],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Double Helix Hub',
  },
  formatDetection: {
    telephone: true,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

/**
 * Viewport Configuration for PWA
 */
/**
 * The CRM shell's actual canvas — `bg-slate-50 dark:bg-slate-950` in CrmShell.
 *
 * The pre-paint script and the browser theme-colour must both match these. The
 * dark value was previously `#0f172a` (slate-900) in both places while the
 * shell rendered slate-950, so the anti-flash script briefly painted a lighter
 * navy and then jumped — introducing the flash it exists to prevent.
 */
const CRM_CANVAS_LIGHT = '#f8fafc';
const CRM_CANVAS_DARK = '#020617';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: CRM_CANVAS_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: CRM_CANVAS_DARK },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Inline script to prevent theme flash - runs synchronously before any paint.
// This MUST be in <head> and run before the browser renders anything.
//
// Generated from the shared helper so the CRM and Admin consoles read the same
// storage key (and migrate their legacy per-app keys identically). `density`
// applies the persisted display scale pre-paint so the chrome tokens render at
// the chosen size with no reflow.
const themeScript = createThemeBootScript({
  lightBg: CRM_CANVAS_LIGHT,
  darkBg: CRM_CANVAS_DARK,
  density: true,
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the active tenant's branding server-side and inject it as a
  // static <style> so the first paint already reflects the tenant palette.
  // Mutating CSS custom properties on the client would cause the documented
  // React #418/#423 hydration mismatch. getActiveTenant() is request-cached
  // (React cache) and returns null for unauthenticated requests, in which
  // case brandingToCssText('') falls through to the theme.css defaults.
  const tenant = await getActiveTenant();
  const tenantThemeCss = brandingToCssText(tenant?.branding);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme script MUST be first to prevent any flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        {/* Tenant branding tokens — server-rendered, overrides theme.css for
            the active org. Empty string when no custom branding (PIFH). */}
        {tenantThemeCss ? (
          <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: tenantThemeCss }} />
        ) : null}

        {/* DNS prefetch for Supabase */}
        <link rel="dns-prefetch" href="https://sffisarikcreyyjzdjvb.supabase.co" />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <LeadGenQuotePinGate />
        <RootProviders>{children}</RootProviders>
        <ConfirmDialogHost />
        <PromptDialogHost />
      </body>
    </html>
  );
}

