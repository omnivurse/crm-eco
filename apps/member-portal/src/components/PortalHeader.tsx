'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  User,
  SignOut,
  List,
  X,
  CaretDown,
  ArrowUpRight,
  FileText,
  Users,
  Gear,
} from '@phosphor-icons/react';
import { Button, cn } from '@crm-eco/ui';
import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

// MANAGE-ONLY PORTAL: enrollment is NOT self-serve here — prospects enroll via the
// public enrollment software on the website. "Enroll Now" points off-site to that
// URL (env-configurable, external absolute), so it uses a plain <a> not next/link.
const ENROLLMENT_URL =
  process.env.NEXT_PUBLIC_ENROLLMENT_URL || 'https://www.doublehelixhub.com/enroll';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Coverage', href: '/coverage' },
  { label: 'Services', href: '/services' },
  { label: 'Billing', href: '/billing' },
  { label: 'Needs', href: '/needs' },
  { label: 'Support', href: '/support' },
];

const AUTH_ROUTE_PREFIXES = [
  '/signin',
  '/signup',
  '/login',
  '/reset-password',
  '/update-password',
  '/access-denied',
];

export function PortalHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [memberName, setMemberName] = useState<string>('');
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isAuthRoute = AUTH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('member_id')
          .eq('user_id', user.id)
          .single() as { data: { member_id: string } | null };

        if (profile?.member_id) {
          const { data: member } = await supabase
            .from('members')
            .select('first_name, last_name')
            .eq('id', profile.member_id)
            .single() as { data: { first_name: string; last_name: string } | null };

          if (member) {
            setMemberName(`${member.first_name} ${member.last_name}`);
          }
        }
      }
    };

    queueMicrotask(() => fetchUser());
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign('/signin');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isAuthRoute) {
    return null;
  }

  return (
    <>
      <header className="pointer-events-none sticky top-0 z-40 w-full pt-3 sm:pt-4">
        <div className="mx-auto flex w-full max-w-[72rem] justify-center px-3 sm:px-4">
          <div
            className={cn(
              'pointer-events-auto mp-island',
              scrolled && 'mp-island-scrolled',
            )}
          >
            <Link href="/" className="mr-1 flex shrink-0 items-center gap-2 pl-0.5">
              <Image
                src="/logo.png"
                alt="Double Helix Hub"
                width={140}
                height={36}
                className="h-7 w-auto object-contain sm:h-8"
                priority
              />
              <span className="hidden text-[0.65rem] font-semibold uppercase tracking-[0.04em] text-[var(--mp-teal)] sm:inline">
                Member
              </span>
            </Link>

            <nav
              className="ml-1 hidden flex-1 items-center justify-center gap-0.5 md:flex"
              aria-label="Primary"
            >
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-full px-2.5 py-1.5 text-[0.75rem] font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:px-3',
                      isActive
                        ? 'bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]'
                        : 'text-slate-500 hover:bg-[rgba(11,109,133,0.06)] hover:text-[var(--mp-teal)]',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="gap-2 rounded-full px-1.5 py-1 hover:bg-[rgba(11,109,133,0.06)]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--mp-teal-soft)] to-[var(--mp-teal)] text-xs font-semibold text-white shadow-[0_2px_8px_rgba(11,109,133,0.25)]">
                        {memberName ? getInitials(memberName) : (
                          <User weight="light" className="h-4 w-4" aria-hidden />
                        )}
                      </div>
                      <CaretDown weight="light" className="mr-1 h-3.5 w-3.5 text-slate-400" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 rounded-2xl border-[rgba(11,109,133,0.08)] shadow-[var(--mp-shadow-soft)]"
                  >
                    <DropdownMenuLabel className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--mp-ink)]">{memberName}</span>
                        <span className="text-xs text-slate-500">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => router.push('/profile')}
                      className="cursor-pointer px-4 py-2.5"
                    >
                      <User weight="light" className="mr-3 h-4 w-4 text-primary" aria-hidden />
                      <span className="font-medium">My Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push('/dependents')}
                      className="cursor-pointer px-4 py-2.5"
                    >
                      <Users weight="light" className="mr-3 h-4 w-4 text-primary" aria-hidden />
                      <span className="font-medium">Dependents</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push('/documents')}
                      className="cursor-pointer px-4 py-2.5"
                    >
                      <FileText weight="light" className="mr-3 h-4 w-4 text-primary" aria-hidden />
                      <span className="font-medium">Documents</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push('/settings')}
                      className="cursor-pointer px-4 py-2.5"
                    >
                      <Gear weight="light" className="mr-3 h-4 w-4 text-primary" aria-hidden />
                      <span className="font-medium">Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer px-4 py-2.5 text-red-600 focus:bg-red-50 focus:text-red-600"
                    >
                      <SignOut weight="light" className="mr-3 h-4 w-4" aria-hidden />
                      <span className="font-medium">Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2 pr-1">
                  <Link
                    href="/signin"
                    className="rounded-full px-3 py-1.5 text-[0.75rem] font-medium text-slate-500 hover:text-[var(--mp-ink)]"
                  >
                    Sign In
                  </Link>
                  <a href={ENROLLMENT_URL} className="mp-btn-island text-[0.75rem]">
                    Enroll
                    <span className="mp-btn-ico" aria-hidden>
                      <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                    </span>
                  </a>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-10 w-10 rounded-full hover:bg-[rgba(11,109,133,0.06)] md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X weight="light" className="h-5 w-5" />
              ) : (
                <List weight="light" className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--mp-ink)]/20 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-3 top-[4.5rem] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[1.75rem] border border-[rgba(11,109,133,0.08)] bg-white/95 p-3 shadow-[var(--mp-shadow-soft)] backdrop-blur-xl">
            <nav className="flex flex-col gap-0.5" aria-label="Mobile">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm font-medium',
                      isActive
                        ? 'bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]'
                        : 'text-slate-600 hover:bg-[var(--mp-mist)]',
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <hr className="my-2 border-[rgba(11,109,133,0.08)]" />

              <Link
                href="/profile"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-[var(--mp-mist)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User weight="light" className="h-4 w-4 text-primary" aria-hidden />
                My Profile
              </Link>
              <Link
                href="/dependents"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-[var(--mp-mist)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Users weight="light" className="h-4 w-4 text-primary" aria-hidden />
                Dependents
              </Link>
              <Link
                href="/documents"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-[var(--mp-mist)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileText weight="light" className="h-4 w-4 text-primary" aria-hidden />
                Documents
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-[var(--mp-mist)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Gear weight="light" className="h-4 w-4 text-primary" aria-hidden />
                Settings
              </Link>

              <hr className="my-2 border-[rgba(11,109,133,0.08)]" />

              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <SignOut weight="light" className="h-4 w-4" aria-hidden />
                  Sign Out
                </button>
              ) : (
                <>
                  <Link
                    href="/signin"
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-[var(--mp-mist)]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <a
                    href={ENROLLMENT_URL}
                    className="rounded-2xl bg-[var(--mp-teal)] px-4 py-3 text-center text-sm font-medium text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Enroll Now
                  </a>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
