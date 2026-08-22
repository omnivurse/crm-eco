import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { PIN_LOCK_PAGE_METADATA, PIN_LOCK_ROBOTS_METADATA } from '@crm-eco/ui/lib/pin-lock';
import { isPinLockRequest } from '@crm-eco/ui/lib/pin-lock-server';
import { DevtoolsQuietScript } from '@crm-eco/ui/components/devtools-quiet-script';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ThemeProvider, themeInitScript } from '@/components/theme-provider';
import { landingFontVars } from '@/components/landing/fonts';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

const plusJakartaHeading = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700', '800'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

const SITE_TITLE = 'Double Helix Software | The Operating System for Health Benefits';
const SITE_DESCRIPTION =
  'Licensed multi-tenant SaaS for benefits advisors, agencies, and TPAs. CRM Core + Admin Enrollment in one platform.';

const APP_METADATA: Metadata = {
  metadataBase: new URL('https://doublehelixhub.com'),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    url: 'https://doublehelixhub.com',
    siteName: 'Double Helix Software',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Double Helix Software' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  robots: PIN_LOCK_ROBOTS_METADATA,
};

export async function generateMetadata(): Promise<Metadata> {
  if (await isPinLockRequest()) return { ...PIN_LOCK_PAGE_METADATA };
  return APP_METADATA;
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * `landingFontVars` adds --font-display (Bricolage Grotesque) and --font-mono
 * (IBM Plex Mono), the two faces the CRM and MMS landings use. They are
 * declared on <html> so the `:root` declarations in ethereal.css can see them
 * and `--lp-font-display` / `--lp-font-mono` resolve site-wide. The dh-* pages
 * read --font-body / --font-heading and are unaffected — these two variables
 * are only ever consumed through the --lp-* tokens.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isLock = await isPinLockRequest();

  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${plusJakartaHeading.variable} ${landingFontVars}`}
      suppressHydrationWarning
    >
      <head>
        <DevtoolsQuietScript />
        {!isLock ? <script dangerouslySetInnerHTML={{ __html: themeInitScript }} /> : null}
      </head>
      <body className="font-sans antialiased">
        {isLock ? (
          children
        ) : (
          <ThemeProvider>
            <div className="dh-mesh" aria-hidden />
            <div className="dh-grain" aria-hidden />
            <div className="relative z-[1] flex min-h-[100dvh] flex-col">
              <SiteHeader />
              <div className="flex-1">{children}</div>
              <SiteFooter />
            </div>
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}
