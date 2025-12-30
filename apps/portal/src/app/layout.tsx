import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PortalHeader } from '@/components/PortalHeader';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'Member Portal | WealthShare',
  description: 'Manage your healthshare membership, view benefits, and enroll in new plans.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="min-h-screen bg-slate-50">
          <PortalHeader />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t bg-white py-6 mt-auto">
            <div className="container mx-auto px-4 text-center text-sm text-slate-500">
              <p>&copy; {new Date().getFullYear()} WealthShare. All rights reserved.</p>
              <p className="mt-1">
                This is not insurance. Healthshare programs facilitate member-to-member sharing of medical expenses.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

