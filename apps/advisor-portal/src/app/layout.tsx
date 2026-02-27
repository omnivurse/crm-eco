import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { PinLockOverlay } from '@crm-eco/ui';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Advisor Portal',
    description: 'Manage your leads, team, and presentations',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <PinLockOverlay pin="012049" appName="Secure Access" />
                {children}
                <Toaster position="top-right" richColors />
            </body>
        </html>
    );
}
