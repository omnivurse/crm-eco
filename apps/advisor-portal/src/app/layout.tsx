import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { LeadGenQuotePinGate } from '@crm-eco/ui/components/pin-lock-overlay';
import './globals.css';
import { Toaster } from 'sonner';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
});

const plusJakartaHeading = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700'],
  display: 'swap',
  preload: false,
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Advisor Portal | Double Helix Hub',
  description: 'Manage your leads, team, and presentations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${plusJakartaHeading.variable} ${fraunces.variable} font-sans`}
      >
        <LeadGenQuotePinGate />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
