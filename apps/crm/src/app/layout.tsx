import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import { createThemeBootScript } from '@crm-eco/ui/lib/theme-boot';
import { PIN_LOCK_PAGE_METADATA, PIN_LOCK_ROBOTS_METADATA } from '@crm-eco/ui/lib/pin-lock';
import { isPinLockRequest } from '@crm-eco/ui/lib/pin-lock-server';
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

const APP_METADATA: Metadata = {
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
  robots: PIN_LOCK_ROBOTS_METADATA,
};

export async function generateMetadata(): Promise<Metadata> {
  if (await isPinLockRequest()) return { ...PIN_LOCK_PAGE_METADATA };
  return APP_METADATA;
}

/**
 * Viewport Configuration for PWA
 */
/**
 * The CRM shell's actual canvas — now `bg-background` in CrmShell, i.e. the
 * shared `--background` token, so these mirror that token's resolved value.
 *
 * The pre-paint script and the browser theme-colour must both match the real
 * canvas. The dark value was previously `#0f172a` (slate-900) in both places
 * while the shell rendered slate-950, so the anti-flash script briefly painted
 * a lighter navy and then jumped — introducing the flash it exists to prevent.
 */
const CRM_CANVAS_LIGHT = '#f2f5f8'; /* --background light: 210 30% 96% */
const CRM_CANVAS_DARK = '#060b16'; /* --background dark: 221 57% 5.5% */

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
  const isLock = await isPinLockRequest();

  // /lock must never depend on tenant/auth/Supabase. An uncaught throw here
  // 503s the PIN page and leaks a Next.js Server Components error in console.
  let tenantThemeCss = '';
  if (!isLock) {
    try {
      const tenant = await getActiveTenant();
      tenantThemeCss = brandingToCssText(tenant?.branding);
    } catch {
      tenantThemeCss = '';
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {!isLock ? <script dangerouslySetInnerHTML={{ __html: themeScript }} /> : null}
        {!isLock && tenantThemeCss ? (
          <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: tenantThemeCss }} />
        ) : null}
        {!isLock ? (
          <link rel="dns-prefetch" href="https://sffisarikcreyyjzdjvb.supabase.co" />
        ) : null}
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        {isLock ? (
          children
        ) : (
          <>
            <RootProviders>{children}</RootProviders>
            <ConfirmDialogHost />
            <PromptDialogHost />
          </>
        )}
      </body>
    </html>
  );
}

