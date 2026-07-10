import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { brandingToCssText } from '@crm-eco/ui/lib/branding';
import { LeadGenQuotePinGate } from '@crm-eco/ui/components/pin-lock-overlay';
import { ConfirmDialogHost } from '@crm-eco/ui/components/confirm-dialog';
import { PromptDialogHost } from '@crm-eco/ui/components/prompt-dialog';
import { getActiveTenant } from '@/lib/tenant';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
});

const jakarta = Plus_Jakarta_Sans({
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the active tenant's branding server-side and inject it as a
  // static <style> so the first paint already reflects the tenant palette.
  // Mutating CSS custom properties on the client would cause the documented
  // React #418/#423 hydration mismatch. getActiveTenant() is request-cached
  // (React cache) and returns null for unauthenticated requests, in which
  // case brandingToCssText('') falls through to the theme.css defaults.
  const tenant = await getActiveTenant();
  const tenantThemeCss = brandingToCssText(tenant?.branding);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Tenant branding tokens — server-rendered, overrides theme.css for
            the active org. Empty string when no custom branding (PIFH). */}
        {tenantThemeCss ? (
          <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: tenantThemeCss }} />
        ) : null}
      </head>
      <body className={`${inter.variable} ${jakarta.variable} font-sans antialiased`}>
        <LeadGenQuotePinGate />
        {children}
        <ConfirmDialogHost />
        <PromptDialogHost />
      </body>
    </html>
  );
}
// Deployment trigger: 2026-01-28T02:18:04Z
