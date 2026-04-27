'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { IconMenu, IconClose, IconArrowOut } from '@/components/icons';
import { HelixMark } from '@/components/brand/HelixMark';

const productLinks = [
  {
    name: 'Admin',
    href: '/admin',
    description: 'Member management & enrollment platform',
    color: 'cyan' as const,
  },
  {
    name: 'CRM',
    href: '/crm',
    description: 'Sales, advisor, & enrollment automation',
    color: 'violet' as const,
  },
];

const navLinks = [
  { name: 'Platform', href: '/#platform' },
  { name: 'Security', href: '/#security' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Customers', href: '/#customers' },
];

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile menu on route change. This is the canonical
  // "derive state from props" pattern (https://react.dev/learn/you-might-not-need-an-effect)
  // so it stays compatible with the new `react-hooks/set-state-in-effect` rule.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        {/* Wordmark */}
        <Link href="/" className="group flex items-center gap-2.5">
          <HelixMark className="h-7 w-7" />
          <span className="font-display text-[17px] font-semibold tracking-tight text-white">
            Double Helix
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          <ProductMenu />
          {navLinks.map((l) => (
            <Link
              key={l.name}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-helix-mist transition-colors hover:text-white"
            >
              {l.name}
            </Link>
          ))}
        </nav>

        {/* Right: CTAs */}
        <div className="hidden items-center gap-2 lg:flex">
          <a
            href="https://admin.doublehelix.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-3 py-2 text-sm text-helix-mist transition-colors hover:text-white"
          >
            Sign in
          </a>
          <Link
            href="/contact?intent=demo"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink-950 transition-all hover:bg-helix-cyan-200"
          >
            Book a demo
            <IconArrowOut size={14} weight="bold" className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/5 lg:hidden"
        >
          {mobileOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
      </div>

      {/* Mobile sheet */}
      <div
        className={cn(
          'overflow-hidden border-t border-white/[0.06] bg-ink-950 transition-[max-height,opacity] duration-300 lg:hidden',
          mobileOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="mx-auto max-w-7xl space-y-4 px-5 py-6 sm:px-8">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-helix-fog">
              Products
            </p>
            {productLinks.map((p) => (
              <Link
                key={p.name}
                href={p.href}
                className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className={cn(
                    'mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md',
                    p.color === 'cyan'
                      ? 'bg-helix-cyan-500/20 text-helix-cyan-200'
                      : 'bg-helix-violet-500/20 text-helix-violet-200',
                  )}
                >
                  <HelixMark className="h-4 w-4" tone={p.color} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{p.name}</span>
                  <span className="block text-xs text-helix-mist">{p.description}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-helix-fog">
              Company
            </p>
            {navLinks.map((l) => (
              <Link
                key={l.name}
                href={l.href}
                className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                {l.name}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <a
              href="https://admin.doublehelix.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/10 px-4 py-2.5 text-center text-sm text-white"
            >
              Sign in
            </a>
            <Link
              href="/contact?intent=demo"
              className="rounded-md bg-white px-4 py-2.5 text-center text-sm font-medium text-ink-950"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Product mega-menu (hover/focus on desktop)                         */
/* ------------------------------------------------------------------ */
function ProductMenu() {
  return (
    <div className="group relative">
      <button
        type="button"
        className="rounded-md px-3 py-2 text-sm text-helix-mist transition-colors hover:text-white"
        aria-haspopup="true"
      >
        Products
      </button>
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-[420px] rounded-2xl border border-white/[0.08] bg-ink-900/95 p-2 shadow-glow-soft backdrop-blur-xl">
          {productLinks.map((p) => (
            <Link
              key={p.name}
              href={p.href}
              className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.04]"
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg',
                  p.color === 'cyan'
                    ? 'bg-helix-cyan-500/15 text-helix-cyan-200 ring-1 ring-helix-cyan-500/30'
                    : 'bg-helix-violet-500/15 text-helix-violet-200 ring-1 ring-helix-violet-500/30',
                )}
              >
                <HelixMark className="h-4 w-4" tone={p.color} />
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  {p.name}
                  <span className="num-pill">/{p.name.toLowerCase()}</span>
                </span>
                <span className="mt-0.5 block text-xs text-helix-mist">
                  {p.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
