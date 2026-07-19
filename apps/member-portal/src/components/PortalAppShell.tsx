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
    <div className="mp-atmosphere flex min-h-screen flex-col">
      <div className="mp-grain" aria-hidden="true" />
      <PortalHeader />
      <main className="w-full min-w-0 flex-1 px-3 pb-28 pt-4 sm:px-4 md:pb-8 lg:px-6 lg:pt-6 xl:px-8 2xl:px-10">
        <div className="mx-auto w-full max-w-[72rem]">{children}</div>
      </main>
      <footer className="mt-auto border-t border-[rgba(11,109,133,0.06)] bg-white/70 py-6 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[72rem] px-3 text-center text-sm text-slate-500 sm:px-4 lg:px-6 xl:px-8 2xl:px-10">
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
