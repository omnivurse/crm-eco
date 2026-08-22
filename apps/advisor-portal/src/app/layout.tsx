import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { PIN_LOCK_PAGE_METADATA, PIN_LOCK_ROBOTS_METADATA } from '@crm-eco/ui/lib/pin-lock';
import { isPinLockRequest } from '@crm-eco/ui/lib/pin-lock-server';
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

const APP_METADATA: Metadata = {
  title: 'Advisor Portal | Double Helix Hub',
  description: 'Manage your leads, team, and presentations',
  robots: PIN_LOCK_ROBOTS_METADATA,
};

export async function generateMetadata(): Promise<Metadata> {
  if (await isPinLockRequest()) return { ...PIN_LOCK_PAGE_METADATA };
  return APP_METADATA;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLock = await isPinLockRequest();
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${plusJakartaHeading.variable} ${fraunces.variable} font-sans`}
      >
        {children}
        {isLock ? null : <Toaster position="top-right" richColors />}
      </body>
    </html>
  );
}
