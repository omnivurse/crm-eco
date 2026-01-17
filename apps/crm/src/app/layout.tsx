import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['600', '700'],
  display: 'swap',
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
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <ThemeProvider defaultTheme="light">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

