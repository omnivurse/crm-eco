import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import { LeadGenQuotePinGate } from '@crm-eco/ui/components/pin-lock-overlay';
import { ConfirmDialogHost } from '@crm-eco/ui/components/confirm-dialog';
import { PromptDialogHost } from '@crm-eco/ui/components/prompt-dialog';
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

const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('admin-theme');
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.remove('light','dark');
    root.classList.add(dark ? 'dark' : 'light');
  } catch (e) {}
})();
`;

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
        </ThemeProvider>
      </body>
    </html>
  );
}
