import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { PinLockOverlay } from '@crm-eco/ui';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Pay It Forward Health | Community Health Sharing',
    template: '%s | Pay It Forward Health',
  },
  description:
    'Join a community of members who share medical expenses together. Affordable healthshare plans starting at less than traditional insurance. Not insurance.',
  keywords: [
    'health sharing',
    'healthshare',
    'medical cost sharing',
    'affordable healthcare',
    'health sharing ministry',
    'pay it forward health',
  ],
  openGraph: {
    title: 'Pay It Forward Health | Community Health Sharing',
    description:
      'Join a community of members who share medical expenses together. Affordable healthshare plans for individuals and families.',
    url: 'https://payitforwardhealth.com',
    siteName: 'Pay It Forward Health',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pay It Forward Health | Community Health Sharing',
    description:
      'Affordable healthshare plans for individuals and families. Join our sharing community today.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}
      >
        <PinLockOverlay pin="012049" appName="Secure Access" />
        <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
