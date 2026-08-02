import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import { createThemeBootScript } from '@crm-eco/ui/lib/theme-boot';
import { LeadGenQuotePinGate } from '@crm-eco/ui/components/pin-lock-overlay';
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
};

/**
 * The Admin shell's actual canvas — `--adm-void` in globals.css.
 * Kept in sync with the pre-paint script so there is no flash on load.
 */
const ADMIN_CANVAS_LIGHT = '#f6fafb';
const ADMIN_CANVAS_DARK = '#050505';

/**
 * Generated from the shared helper, so the Admin console reads the same theme
 * key as the CRM (migrating the legacy `admin-theme` value on first read).
 * A user's dark-mode choice now survives switching between consoles.
 *
 * `density` stays off here until the Admin console adopts the shared density
 * tokens in Phase 2 — setting the attribute before anything consumes it would
 * be a no-op.
 */
const themeBootScript = createThemeBootScript({
  lightBg: ADMIN_CANVAS_LIGHT,
  darkBg: ADMIN_CANVAS_DARK,
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
          <LeadGenQuotePinGate />
          {children}
          <ConfirmDialogHost />
          <PromptDialogHost />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
