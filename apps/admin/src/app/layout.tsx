import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import { createThemeBootScript } from '@crm-eco/ui/lib/theme-boot';
import { PIN_LOCK_ROBOTS_METADATA } from '@crm-eco/ui/lib/pin-lock';
import { ConfirmDialogHost } from '@crm-eco/ui/components/confirm-dialog';
import { PromptDialogHost } from '@crm-eco/ui/components/prompt-dialog';
import { Toaster } from '@crm-eco/ui';
import { getActiveTenant } from '@/lib/tenant';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  preload: false,
});

const jakartaHeading = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'MMS | Benefits Enrollment & Member Management | Double Helix Hub',
  description: 'MMS — benefits enrollment and member management software for health sharing organizations.',
  icons: {
    icon: [{ url: '/favicon-32.png', type: 'image/png', sizes: '32x32' }],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  robots: PIN_LOCK_ROBOTS_METADATA,
};

/**
 * The Admin shell's actual canvas — `--adm-void`, now an alias for the shared
 * `--background` token. Kept in sync with the pre-paint script so there is no
 * flash on load. The dark value is the one settled ground for the suite; it
 * was #050505 (neutral OLED black) before.
 */
const ADMIN_CANVAS_LIGHT = '#f5f9fa'; /* --background light: 192 33% 97% */
const ADMIN_CANVAS_DARK = '#060b16'; /* --background dark: 221 57% 5.5% */

/**
 * Generated from the shared helper, so the Admin console reads the same theme
 * and density keys as the CRM (migrating the legacy `admin-theme` value on
 * first read). A user's dark-mode and density choices now survive switching
 * between consoles.
 */
const themeBootScript = createThemeBootScript({
  lightBg: ADMIN_CANVAS_LIGHT,
  darkBg: ADMIN_CANVAS_DARK,
  density: true,
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Soft-fail when local env is missing so /login can still render.
  let tenantThemeCss = '';
  try {
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const tenant = await getActiveTenant();
      tenantThemeCss = brandingToCssText(tenant?.branding);
    }
  } catch (err) {
    console.warn('[Admin Layout] Skipping tenant branding resolve:', err);
  }

  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {tenantThemeCss ? (
          <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: tenantThemeCss }} />
        ) : null}
      </head>
      <body className={`${jakarta.variable} ${jakartaHeading.variable} font-sans antialiased`}>
        <ThemeProvider defaultTheme="light">
          {children}
          <ConfirmDialogHost />
          <PromptDialogHost />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
