'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@crm-eco/ui';
import { Menu, X, Phone, ChevronDown, ArrowRight } from 'lucide-react';
import { NAV, UTILITY_LINKS, PHONE, PORTAL_URL, BRAND } from '@/lib/site';

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
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
    <header className="sticky top-0 z-50 w-full">
      {/* ── Utility bar ── */}
      <div
        className={`pif-grad-deep transition-all duration-300 overflow-hidden ${
          scrolled ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="flex h-10 items-center justify-between text-xs">
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Audience">
              {UTILITY_LINKS.map((link, i) => (
                <span key={link.name} className="flex items-center">
                  <Link
                    href={link.href}
                    className="rounded px-2 py-1 font-medium text-white/75 transition-colors hover:text-white"
                  >
                    {link.name}
                  </Link>
                  {i < UTILITY_LINKS.length - 1 && (
                    <span className="select-none text-white/25" aria-hidden>|</span>
                  )}
                </span>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-4">
              <a href={`${PORTAL_URL}`} className="font-medium text-white/75 transition-colors hover:text-white">
                Member Sign In
              </a>
              <span className="hidden select-none text-white/25 sm:inline" aria-hidden>|</span>
              <a
                href={`tel:${PHONE.tel}`}
                className="hidden items-center gap-1.5 font-medium text-white/75 transition-colors hover:text-white sm:flex"
              >
                <Phone className="h-3 w-3" />
                {PHONE.display}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main bar ── */}
      <div
        className={`transition-all duration-300 ${
          scrolled ? 'bg-white/95 shadow-sm backdrop-blur-md' : 'border-b border-pif-navy-100 bg-white'
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex flex-shrink-0 items-center" aria-label={`${BRAND.name} home`}>
              <Image
                src="/logo.png"
                alt={BRAND.name}
                width={200}
                height={48}
                className="h-9 w-auto object-contain sm:h-10"
                priority
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
              {NAV.map((item) =>
                item.children ? (
                  <div key={item.name} className="group relative">
                    <Link
                      href={item.href}
                      className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-pif-navy-800 transition-colors hover:text-pif-teal-700"
                    >
                      {item.name}
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:rotate-180" />
                    </Link>
                    {/* Dropdown — opens on hover and keyboard focus */}
                    <div className="invisible absolute left-0 top-full z-50 w-80 translate-y-1 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <div className="overflow-hidden rounded-2xl border border-pif-navy-100 bg-white p-2 shadow-xl shadow-pif-navy/10 ring-1 ring-pif-navy/5">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            className="block rounded-xl px-4 py-3 transition-colors hover:bg-pif-mist"
                          >
                            <span className="block text-sm font-semibold text-pif-navy-800">{child.name}</span>
                            {child.description && (
                              <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                                {child.description}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-pif-navy-800 transition-colors hover:text-pif-teal-700"
                  >
                    {item.name}
                  </Link>
                ),
              )}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <Link href="/enroll">
                <Button size="sm" className="hub-btn-gradient gap-1.5 rounded-lg px-5 font-semibold">
                  Join Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              type="button"
              className="rounded-md p-2 text-pif-navy-700 transition-colors hover:bg-pif-mist lg:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <div
        id="mobile-menu"
        className={`fixed inset-x-0 overflow-y-auto bg-white shadow-xl transition-all duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'max-h-[calc(100vh-4rem)] opacity-100' : 'max-h-0 opacity-0'
        } ${scrolled ? 'top-16' : 'top-[6.5rem]'}`}
      >
        <div className="mx-auto max-w-7xl space-y-1 px-5 py-4 sm:px-8">
          {NAV.map((item) =>
            item.children ? (
              <div key={item.name} className="border-b border-pif-navy-50 pb-1">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-3 py-3 text-base font-semibold text-pif-navy-800"
                  onClick={() => setOpenGroup((g) => (g === item.name ? null : item.name))}
                  aria-expanded={openGroup === item.name}
                >
                  {item.name}
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${openGroup === item.name ? 'rotate-180' : ''}`}
                  />
                </button>
                <div className={`${openGroup === item.name ? 'block' : 'hidden'} pb-2`}>
                  {item.children.map((child) => (
                    <Link
                      key={child.name}
                      href={child.href}
                      className="block rounded-md px-6 py-2.5 text-sm text-slate-600 transition-colors hover:bg-pif-mist hover:text-pif-teal-700"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.name}
                href={item.href}
                className="block rounded-md px-3 py-3 text-base font-semibold text-pif-navy-800 transition-colors hover:bg-pif-mist"
                onClick={() => setMobileOpen(false)}
              >
                {item.name}
              </Link>
            ),
          )}

          <div className="space-y-3 pt-4">
            <a href={`${PORTAL_URL}`} className="block rounded-md px-3 py-2.5 text-base font-medium text-slate-600 hover:bg-pif-mist">
              Member Sign In
            </a>
            <a href={`tel:${PHONE.tel}`} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium text-slate-600 hover:bg-pif-mist">
              <Phone className="h-4 w-4" />
              {PHONE.display}
            </a>
            <Link href="/enroll" onClick={() => setMobileOpen(false)}>
              <Button className="hub-btn-gradient mt-1 w-full rounded-lg font-semibold">Join Now</Button>
            </Link>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[-1] bg-pif-navy-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
    </header>
  );
}
