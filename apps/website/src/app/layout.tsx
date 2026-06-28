import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
});

// Warm "old-style" serif for display + headings — deliberately not the default
// Inter/Geist look of generic Next.js sites. Reads established and trustworthy.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  preload: false,
  axes: ['opsz'],
});

const SITE_URL = 'https://payitforwardhealth.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Pay It Forward Health | Community Health Sharing',
    template: '%s | Pay It Forward Health',
  },
  description:
    'Pay It Forward Health is an affordable alternative to traditional health insurance. Members share one another’s medical costs in a caring community — no networks, no open-enrollment windows, join any time. Not insurance.',
  keywords: [
    'health sharing',
    'health share',
    'medical cost sharing',
    'affordable healthcare',
    'healthshare',
    'pay it forward health',
    'alternative to health insurance',
  ],
  openGraph: {
    title: 'Pay It Forward Health | Community Health Sharing',
    description:
      'An affordable, community-driven alternative to health insurance. Members care for one another by sharing medical costs together.',
    url: SITE_URL,
    siteName: 'Pay It Forward Health',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pay It Forward Health | Community Health Sharing',
    description:
      'An affordable, community-driven alternative to health insurance. Join a caring community that shares medical costs together.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#003A5C',
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
        className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
