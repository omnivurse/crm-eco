import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PortalHeader } from '@/components/PortalHeader';
import { BottomNav } from '@/components/BottomNav';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { UpdateToast } from '@/components/pwa/UpdateToast';
import { PinLockOverlay } from '@crm-eco/ui';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
});

/**
 * PWA Metadata Configuration
 */
export const metadata: Metadata = {
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
};

/**
 * Viewport Configuration for PWA
 */
export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* PWA Apple Touch Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
        
        {/* PWA Splash Screens for iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <PinLockOverlay pin="012049" appName="Secure Access" />
        <ServiceWorkerRegistration />
        <div className="min-h-screen bg-slate-50">
          <PortalHeader />
          <main className="w-full min-w-0 px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 py-6 lg:py-8 pb-20 md:pb-6">
            {children}
          </main>
          <footer className="border-t bg-white py-6 mt-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 text-center text-sm text-slate-500">
              <p>&copy; {new Date().getFullYear()} Double Helix Hub. All rights reserved.</p>
              <p className="mt-1">
                This is not insurance. Health sharing programs facilitate member-to-member sharing of medical expenses.
              </p>
            </div>
          </footer>
          <BottomNav />
          <InstallPrompt />
          <UpdateToast />
        </div>
      </body>
    </html>
  );
}

