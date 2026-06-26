import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import './globals.css';
import { PortalAppShell } from '@/components/PortalAppShell';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { UpdateToast } from '@/components/pwa/UpdateToast';
import { getPortalTenant } from '@/lib/tenant';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Member Portal | Double Helix Hub',
  description: 'Manage your health sharing membership, view benefits, and enroll in new plans.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Double Helix Hub',
  },
  formatDetection: {
    telephone: true,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#030712',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the active member's tenant branding server-side and emit it as a
  // static <style> below. This keeps theming hydration-safe (no client
  // setProperty / client provider in the server layout). `getPortalTenant()` is
  // a soft resolver — it returns null on public/unauthenticated routes, in
  // which case `css` is '' and we fall through to the theme.css defaults.
  const tenant = await getPortalTenant();
  const css = brandingToCssText(tenant?.branding);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {css && (
          <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: css }} />
        )}
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <ServiceWorkerRegistration />
        <PortalAppShell>{children}</PortalAppShell>
        <InstallPrompt />
        <UpdateToast />
      </body>
    </html>
  );
}
