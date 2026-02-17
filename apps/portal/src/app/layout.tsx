import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PortalHeader } from '@/components/PortalHeader';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

/**
 * PWA Metadata Configuration
 */
export const metadata: Metadata = {
  title: 'Member Portal | Pay It Forward HealthShare',
  description: 'Manage your healthshare membership, view benefits, and enroll in new plans.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pay It Forward HealthShare',
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
        <ServiceWorkerRegistration />
        <div className="min-h-screen bg-slate-50">
          <PortalHeader />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t bg-white py-6 mt-auto">
            <div className="container mx-auto px-4 text-center text-sm text-slate-500">
              <p>&copy; {new Date().getFullYear()} Pay It Forward HealthShare. All rights reserved.</p>
              <p className="mt-1">
                This is not insurance. Healthshare programs facilitate member-to-member sharing of medical expenses.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

