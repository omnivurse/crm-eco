import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

// Optimize font loading - reduce weights and preload critical subset
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

// Reduce font weights for faster loading - only load what's needed
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700'], // Reduced from 4 weights to 2
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Pay It Forward CRM | Healthshare Management Platform',
  description: 'Modern CRM platform for healthshare and insurance organizations',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
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
        
        {/* Preconnect to external resources for faster loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* DNS prefetch for Supabase */}
        <link rel="dns-prefetch" href="https://supabase.co" />
        
        {/* Optimize mobile viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <ThemeProvider defaultTheme="light">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

