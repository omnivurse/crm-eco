import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { LeadGenQuotePinGate } from '@crm-eco/ui/components/pin-lock-overlay';
import './globals.css';
import { Toaster } from 'sonner';
const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false });

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
            <body className={inter.className}>
                <LeadGenQuotePinGate />
                {children}
                <Toaster position="top-right" richColors />
            </body>
        </html>
    );
}
