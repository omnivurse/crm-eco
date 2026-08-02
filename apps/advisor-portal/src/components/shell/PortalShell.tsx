'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { cn } from '@crm-eco/ui';
import Image from 'next/image';
import {
  SquaresFour,
  Users,
  ChatCircle,
  BookOpen,
  UsersThree,
  MonitorPlay,
  CurrencyDollar,
  SignOut,
  List,
  X,
} from '@phosphor-icons/react';

import type { Profile as ProfileRow, Advisor } from '@crm-eco/lib/types';

/** Profile with joined advisor relation */
type ProfileWithAdvisor = Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'avatar_url' | 'advisor_role'> & {
  advisors?: Pick<Advisor, 'first_name' | 'last_name' | 'agency_name'> | null;
};

interface PortalShellProps {
  profile: ProfileWithAdvisor;
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: SquaresFour },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Pricing', href: '/pricing', icon: CurrencyDollar },
  { name: 'Engagement', href: '/engagement', icon: ChatCircle },
  { name: 'Training', href: '/training', icon: BookOpen },
  { name: 'Team', href: '/team', icon: UsersThree },
  { name: 'Presentations', href: '/presentations', icon: MonitorPlay },
];

export function PortalShell({ profile, children }: PortalShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const advisorName = profile.advisors
    ? `${profile.advisors.first_name} ${profile.advisors.last_name}`
    : profile.full_name || 'Advisor';

  const initials = advisorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => mobile && setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[0.8rem] font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
              mobile && 'whitespace-nowrap',
              isActive
                ? 'bg-[rgba(11,109,133,0.08)] text-[var(--adv-teal)]'
                : 'text-[var(--adv-slate)] hover:bg-[rgba(11,109,133,0.06)] hover:text-[var(--adv-teal)]',
            )}
          >
            <Icon weight="light" className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="adv-atmosphere">
      <div className="adv-grain" aria-hidden="true" />

      <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-0 px-3 pb-8 pt-3 sm:px-4 lg:grid-cols-[15.5rem_1fr] lg:gap-6 lg:px-6 lg:pt-5 xl:px-8">
        {/* Desktop floating rail */}
        <aside className="sticky top-5 z-40 hidden self-start lg:block">
          <nav className="adv-rail" aria-label="Primary">
            <div className="adv-rail-inner flex min-h-[calc(100dvh-3.5rem)] flex-col p-4">
              <div className="mb-3 border-b border-[rgba(28,25,23,0.06)] px-2 pb-4">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="Double Helix Hub"
                    width={120}
                    height={32}
                    className="h-7 w-auto object-contain"
                    priority
                  />
                </Link>
                <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--adv-teal)]">
                  Advisor
                </p>
                <p className="truncate text-xs text-[var(--adv-slate)]">
                  {profile.advisors?.agency_name || 'Agency'}
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-0.5">
                <NavLinks />
              </div>

              <div className="mt-auto border-t border-[rgba(28,25,23,0.06)] pt-4">
                <div className="mb-3 flex items-center gap-2.5 px-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.85rem] bg-gradient-to-br from-[var(--adv-teal-soft)] to-[var(--adv-teal)] text-xs font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[0.8rem] font-semibold text-[var(--adv-ink)]">
                      {advisorName}
                    </p>
                    <p className="truncate text-[0.7rem] capitalize text-[var(--adv-slate)]">
                      {profile.advisor_role}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-[0.8rem] font-medium text-[var(--adv-slate)] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <SignOut weight="light" className="h-4 w-4" aria-hidden />
                  Sign Out
                </button>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          {/* Mobile top island */}
          <header className="sticky top-3 z-40 mb-4 lg:hidden">
            <div className="adv-rail">
              <div className="adv-rail-inner flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="grid h-10 w-10 place-items-center rounded-full text-[var(--adv-ink)] hover:bg-[rgba(11,109,133,0.06)]"
                  aria-label="Open menu"
                >
                  <List weight="light" className="h-5 w-5" />
                </button>
                <Image
                  src="/logo.png"
                  alt="Double Helix Hub"
                  width={110}
                  height={28}
                  className="h-6 w-auto object-contain"
                  priority
                />
                <span className="ml-auto text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--adv-teal)]">
                  Advisor
                </span>
              </div>
            </div>
          </header>

          {/* Mobile horizontal nav strip */}
          <nav
            className="mb-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none lg:hidden"
            aria-label="Mobile"
          >
            <NavLinks mobile />
          </nav>

          <main className="min-w-0 pb-6 pt-1 lg:pt-2">{children}</main>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--adv-ink)]/25 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] p-3">
            <nav className="adv-rail h-full">
              <div className="adv-rail-inner flex h-full flex-col p-4">
                <div className="mb-3 flex items-center justify-between border-b border-[rgba(28,25,23,0.06)] pb-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--adv-ink)]">Double Helix</p>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--adv-teal)]">
                      Advisor
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--adv-sage-soft)]"
                    aria-label="Close"
                  >
                    <X weight="light" className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  <NavLinks mobile />
                </div>
                <div className="mt-auto border-t border-[rgba(28,25,23,0.06)] pt-4">
                  <div className="mb-3 flex items-center gap-2.5 px-2">
                    <div className="grid h-9 w-9 place-items-center rounded-[0.85rem] bg-gradient-to-br from-[var(--adv-teal-soft)] to-[var(--adv-teal)] text-xs font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{advisorName}</p>
                      <p className="truncate text-xs capitalize text-[var(--adv-slate)]">
                        {profile.advisor_role}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <SignOut weight="light" className="h-4 w-4" aria-hidden />
                    Sign Out
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
