'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CaretDown } from '@phosphor-icons/react';
import { ThemeToggle } from '@/components/theme-toggle';

const NAV = [
  { name: 'CRM Core', href: '/products/crm' },
  { name: 'Admin', href: '/products/admin' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="pointer-events-none sticky top-0 z-40 w-full pt-4 sm:pt-5">
        <div className="mx-auto flex w-full max-w-6xl justify-center px-4">
          <div
            className={`pointer-events-auto dh-island flex w-full max-w-4xl items-center gap-2 rounded-full px-3 py-2 transition-shadow duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] sm:px-4 ${
              scrolled ? 'shadow-[0_16px_48px_rgba(15,23,42,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]' : ''
            }`}
          >
            <Link href="/" className="flex flex-shrink-0 items-center pl-1" aria-label="Double Helix home">
              <img
                src="/logo.svg"
                alt="Double Helix"
                width={120}
                height={28}
                className="dh-logo"
              />
            </Link>

            <nav className="ml-1 hidden flex-1 items-center justify-center gap-0.5 md:flex" aria-label="Main">
              {NAV.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="rounded-full px-3 py-2 text-[0.78rem] font-medium text-foreground/55 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="ml-auto hidden items-center gap-1.5 md:flex">
              <ThemeToggle />
              <Link
                href="https://crm.doublehelixhub.com"
                className="rounded-full px-3 py-2 text-[0.78rem] font-medium text-foreground/45 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-foreground"
              >
                Sign in
              </Link>
              <Link href="/#request-access" className="group dh-btn-island dh-btn-primary text-[0.78rem] !py-1.5 !pl-3.5 !pr-1.5">
                Access
                <span className="dh-btn-ico !h-7 !w-7">
                  <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-1 md:hidden">
              <ThemeToggle />
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.06]"
                onClick={() => setMobileOpen((o) => !o)}
                aria-expanded={mobileOpen}
                aria-controls="dh-mobile-menu"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                <span className="relative block h-3.5 w-5">
                  <span
                    className={`absolute left-0 top-0 block h-[1.5px] w-full origin-center rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      mobileOpen ? 'translate-y-[6px] rotate-45' : ''
                    }`}
                  />
                  <span
                    className={`absolute left-0 top-[6px] block h-[1.5px] w-full rounded-full bg-current transition-opacity duration-300 ${
                      mobileOpen ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  <span
                    className={`absolute left-0 top-[12px] block h-[1.5px] w-full origin-center rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      mobileOpen ? '-translate-y-[6px] -rotate-45' : ''
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        id="dh-mobile-menu"
        className={`fixed inset-0 z-[45] md:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-background/90 backdrop-blur-3xl transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-black/80 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`relative flex h-full flex-col px-6 pb-10 pt-24 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <nav className="flex-1 space-y-1" aria-label="Mobile">
            {NAV.map((item, i) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between border-b border-border py-4 font-heading text-2xl font-semibold text-foreground transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                }`}
                style={{ transitionDelay: mobileOpen ? `${100 + i * 50}ms` : '0ms' }}
                onClick={() => setMobileOpen(false)}
              >
                {item.name}
                <CaretDown weight="light" className="h-5 w-5 -rotate-90 text-foreground/40" />
              </Link>
            ))}
          </nav>
          <Link
            href="/#request-access"
            onClick={() => setMobileOpen(false)}
            className="group mt-6 flex w-full items-center justify-between rounded-full bg-foreground px-6 py-3.5 font-semibold text-background"
          >
            Request access
            <span className="grid h-8 w-8 place-items-center rounded-full bg-background/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
              <ArrowUpRight weight="light" className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
