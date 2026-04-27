import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { MarketingHeader } from '@/components/chrome/MarketingHeader';
import { MarketingFooter } from '@/components/chrome/MarketingFooter';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetBrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://doublehelix.com'),
  title: {
    default: 'Double Helix — Enterprise Healthcare Software',
    template: '%s · Double Helix',
  },
  description:
    'Double Helix pairs a member-management Admin platform with a sales & enrollment CRM. Two intertwined products, one operating system for modern healthcare organizations.',
  keywords: [
    'healthcare enrollment platform',
    'member management software',
    'health sharing software',
    'insurance CRM',
    'enrollment SaaS',
    'multi-tenant healthcare platform',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Double Helix',
    title: 'Double Helix — Enterprise Healthcare Software',
    description:
      'A member-management Admin platform and a sales & enrollment CRM, engineered as a single operating system for healthcare organizations.',
    url: 'https://doublehelix.com',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Double Helix — Enterprise Healthcare Software',
    description:
      'Two intertwined products, one operating system for modern healthcare organizations.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#05060B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrains.variable} font-sans antialiased bg-ink-950 text-white selection:bg-helix-cyan-500/30`}
      >
        <div className="min-h-screen flex flex-col">
          <MarketingHeader />
          <main className="flex-1">{children}</main>
          <MarketingFooter />
        </div>
      </body>
    </html>
  );
}
