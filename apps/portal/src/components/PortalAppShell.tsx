'use client';

import { usePathname } from 'next/navigation';
import { PortalHeader } from '@/components/PortalHeader';
import { BottomNav } from '@/components/BottomNav';

const MINIMAL_CHROME_PREFIXES = [
  '/signin',
  '/signup',
  '/login',
  '/reset-password',
  '/update-password',
  '/access-denied',
  '/agent',
  '/enroll',
];

function shouldHideMemberChrome(pathname: string): boolean {
  return MINIMAL_CHROME_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function PortalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const minimalChrome = shouldHideMemberChrome(pathname);

  if (minimalChrome) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PortalHeader />
      <main className="flex-1 w-full min-w-0 px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 py-6 lg:py-8 pb-20 md:pb-6">
        {children}
      </main>
      <footer className="border-t bg-white py-6 mt-auto">
        <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Double Helix Hub. All rights reserved.</p>
          <p className="mt-1">
            This is not insurance. Health sharing programs facilitate member-to-member sharing of medical expenses.
          </p>
        </div>
      </footer>
      <BottomNav />
    </div>
  );
}
