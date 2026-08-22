import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import { PIN_LOCK_PAGE_METADATA, PIN_LOCK_ROBOTS_METADATA } from '@crm-eco/ui/lib/pin-lock';
import { isPinLockRequest } from '@crm-eco/ui/lib/pin-lock-server';
import { DevtoolsQuietScript } from '@crm-eco/ui/components/devtools-quiet-script';
import { ConfirmDialogHost } from '@crm-eco/ui/components/confirm-dialog';
import { PromptDialogHost } from '@crm-eco/ui/components/prompt-dialog';
import './globals.css';
import { PortalAppShell } from '@/components/PortalAppShell';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { UpdateToast } from '@/components/pwa/UpdateToast';
import { getPortalTenant } from '@/lib/tenant';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
});

const plusJakartaHeading = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  preload: false,
});

const APP_METADATA: Metadata = {
  title: 'Member Portal | Double Helix Hub',
  description: 'Manage your health sharing membership, view benefits, and enroll in new plans.',
  manifest: '/manifest.webmanifest',
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

export const viewport: Viewport = {
  themeColor: '#0b6d85',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLock = await isPinLockRequest();
  let css = '';
  if (!isLock) {
    try {
      const tenant = await getPortalTenant();
      css = brandingToCssText(tenant?.branding);
    } catch {
      css = '';
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <DevtoolsQuietScript />
        {!isLock ? (
          <>
            <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
            <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          </>
        ) : null}
        {!isLock && css ? (
          <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: css }} />
        ) : null}
      </head>
      <body className={`${plusJakarta.variable} ${plusJakartaHeading.variable} font-sans antialiased`}>
        {isLock ? (
          children
        ) : (
          <>
            <ServiceWorkerRegistration />
            <PortalAppShell>{children}</PortalAppShell>
            <InstallPrompt />
            <UpdateToast />
            <ConfirmDialogHost />
            <PromptDialogHost />
          </>
        )}
      </body>
    </html>
  );
}
