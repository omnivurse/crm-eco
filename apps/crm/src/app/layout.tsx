import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { RootProviders } from '@/components/providers/RootProviders';
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

/**
 * PWA Metadata Configuration
 */
export const metadata: Metadata = {
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
};

/**
 * Viewport Configuration for PWA
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Inline script to prevent theme flash - runs synchronously before any paint
// This MUST be in <head> and run before browser renders anything
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('crm-theme') || 'light';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    var html = document.documentElement;
    // Remove any existing theme classes first
    html.classList.remove('light', 'dark');
    // Add the resolved theme
    html.classList.add(resolved);
    // Set color-scheme for native form controls
    html.style.colorScheme = resolved;
    // Set background immediately to prevent white flash
    document.documentElement.style.backgroundColor = resolved === 'dark' ? '#0f172a' : '#ffffff';
  } catch (e) {
    document.documentElement.classList.add('light');
    document.documentElement.style.backgroundColor = '#ffffff';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme script MUST be first to prevent any flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        
        {/* DNS prefetch for Supabase */}
        <link rel="dns-prefetch" href="https://sffisarikcreyyjzdjvb.supabase.co" />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}

