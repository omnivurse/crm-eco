import type { Metadata, Viewport } from 'next';
import { PIN_LOCK_PAGE_METADATA, PIN_LOCK_ROBOTS_METADATA } from '@crm-eco/ui/lib/pin-lock';
import { isPinLockRequest } from '@crm-eco/ui/lib/pin-lock-server';
import { DevtoolsQuietScript } from '@crm-eco/ui/components/devtools-quiet-script';
import { ThemeProvider, themeInitScript } from '@/components/theme-provider';
import { landingFontVars } from '@/lib/fonts';
import { brand } from '@/lib/brand';
import './globals.css';

const APP_METADATA: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: `${brand.product} · ${brand.tagline} · ${brand.name}`,
    template: `%s · ${brand.product}`,
  },
  description: `${brand.advocate} — ${brand.tagline} Compare published hospital cash prices. Transparency-file rates, not insurance quotes.`,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: brand.siteUrl,
    siteName: `${brand.name} ${brand.product}`,
    title: `${brand.product} · ${brand.tagline}`,
    description: `${brand.advocate}. Published hospital cash by metro. Honest coverage, no invented quotes.`,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: `${brand.advocate} · ${brand.tagline}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${brand.product} · ${brand.tagline}`,
    description: `${brand.advocate}. Published hospital cash prices. Not insurance. Not a quote.`,
    images: ['/og.png'],
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
  robots: PIN_LOCK_ROBOTS_METADATA,
};

export async function generateMetadata(): Promise<Metadata> {
  if (await isPinLockRequest()) return { ...PIN_LOCK_PAGE_METADATA };
  return APP_METADATA;
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: brand.colors.mist },
    { media: '(prefers-color-scheme: dark)', color: brand.colors.night },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isLock = await isPinLockRequest();

  return (
    <html lang="en" className={landingFontVars} suppressHydrationWarning>
      <head>
        <DevtoolsQuietScript />
        {!isLock ? <script dangerouslySetInnerHTML={{ __html: themeInitScript }} /> : null}
      </head>
      <body
        className="min-h-[100dvh] antialiased"
        style={isLock ? undefined : { ['--cashpay-signal' as string]: brand.signal }}
      >
        {isLock ? children : <ThemeProvider>{children}</ThemeProvider>}
      </body>
    </html>
  );
}
