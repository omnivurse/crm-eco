'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, CaretDown, ArrowUpRight } from '@phosphor-icons/react';
import { NAV, UTILITY_LINKS, PHONE, PORTAL_URL, BRAND } from '@/lib/site';

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
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
        <div className="mx-auto flex w-full max-w-7xl justify-center px-4 sm:px-6">
          <div
            className={`pointer-events-auto flex w-full max-w-5xl items-center gap-2 rounded-full px-3 py-2 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] sm:gap-3 sm:px-4 ${
              scrolled ? 'pif-island pif-island-scrolled' : 'pif-island'
            }`}
          >
            <Link
              href="/"
              className="flex flex-shrink-0 items-center pl-1"
              aria-label={`${BRAND.name} home`}
            >
              <Image
                src="/logo.png"
                alt={BRAND.name}
                width={160}
                height={40}
                className="h-7 w-auto object-contain sm:h-8"
                priority
              />
            </Link>

            {/* Desktop nav */}
            <nav className="ml-1 hidden flex-1 items-center justify-center gap-0.5 lg:flex" aria-label="Main">
              {NAV.map((item) =>
                item.children ? (
                  <div key={item.name} className="group relative">
                    <Link
                      href={item.href}
                      className="flex items-center gap-1 rounded-full px-3 py-2 text-[0.8125rem] font-medium text-pif-navy-800/80 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-pif-navy-800/[0.05] hover:text-pif-navy-800"
                    >
                      {item.name}
                      <CaretDown
                        weight="light"
                        className="h-3.5 w-3.5 text-slate-400 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:rotate-180"
                      />
                    </Link>
                    <div className="invisible absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <div className="pif-bezel">
                        <div className="pif-bezel-inner p-2">
                          {item.children.map((child) => (
                            <Link
                              key={child.name}
                              href={child.href}
                              className="block rounded-[calc(2rem-0.75rem)] px-4 py-3 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-pif-mist"
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
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="rounded-full px-3 py-2 text-[0.8125rem] font-medium text-pif-navy-800/80 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-pif-navy-800/[0.05] hover:text-pif-navy-800"
                  >
                    {item.name}
                  </Link>
                ),
              )}
            </nav>

            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <a
                href={PORTAL_URL}
                className="rounded-full px-3 py-2 text-[0.8125rem] font-medium text-slate-500 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-pif-navy-800"
              >
                Sign in
              </a>
              <Link
                href="/enroll"
                className="group pif-btn-island pif-btn-care text-[0.8125rem]"
              >
                Join
                <span className="pif-btn-ico">
                  <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>

            {/* Mobile hamburger — morphs to X */}
            <button
              type="button"
              className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-full text-pif-navy-800 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-pif-navy-800/[0.05] lg:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="sr-only">{mobileOpen ? 'Close' : 'Menu'}</span>
              <span className="relative block h-3.5 w-5">
                <span
                  className={`absolute left-0 top-0 block h-[1.5px] w-full origin-center rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    mobileOpen ? 'translate-y-[6px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`absolute left-0 top-[6px] block h-[1.5px] w-full rounded-full bg-current transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
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
      </header>

      {/* Mobile glass overlay */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-[45] lg:hidden ${
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-pif-navy-900/70 backdrop-blur-3xl transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`relative flex h-full flex-col px-6 pb-10 pt-24 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Mobile">
            {NAV.map((item, i) =>
              item.children ? (
                <div
                  key={item.name}
                  className={`border-b border-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                  }`}
                  style={{ transitionDelay: mobileOpen ? `${100 + i * 50}ms` : '0ms' }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between py-4 text-left text-2xl font-heading font-medium text-white"
                    onClick={() => setOpenGroup((g) => (g === item.name ? null : item.name))}
                    aria-expanded={openGroup === item.name}
                  >
                    {item.name}
                    <CaretDown
                      weight="light"
                      className={`h-5 w-5 text-white/50 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                        openGroup === item.name ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div className={`${openGroup === item.name ? 'block' : 'hidden'} pb-3`}>
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className="block py-2.5 pl-1 text-base text-white/70 transition-colors hover:text-white"
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
                  className={`block border-b border-white/10 py-4 font-heading text-2xl font-medium text-white transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                  }`}
                  style={{ transitionDelay: mobileOpen ? `${100 + i * 50}ms` : '0ms' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.name}
                </Link>
              ),
            )}
          </nav>

          <div
            className={`mt-6 space-y-4 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              mobileOpen ? 'translate-y-0 opacity-100 delay-300' : 'translate-y-12 opacity-0'
            }`}
          >
            <div className="flex flex-wrap gap-3 text-sm text-white/60">
              {UTILITY_LINKS.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
            </div>
            <a
              href={`tel:${PHONE.tel}`}
              className="flex items-center gap-2 text-white/80 hover:text-white"
            >
              <Phone weight="light" className="h-4 w-4" />
              {PHONE.display}
            </a>
            <Link
              href="/enroll"
              onClick={() => setMobileOpen(false)}
              className="group flex w-full items-center justify-between rounded-full bg-white px-6 py-3.5 font-semibold text-pif-navy-800"
            >
              Become a Member
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pif-navy-800/5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
                <ArrowUpRight weight="light" className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
