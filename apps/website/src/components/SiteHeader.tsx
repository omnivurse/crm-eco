'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@crm-eco/ui';
import { Menu, X, Phone } from 'lucide-react';

const navigation = [
  { name: 'About', href: '/about' },
  { name: 'Plans', href: '/plans' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'FAQ', href: '/faq' },
  { name: 'Contact', href: '/contact' },
];

const utilityLinks = [
  { name: 'For Members', href: '/for-members' },
  { name: 'For Advisors', href: '/for-advisors' },
  { name: 'For Employers', href: '/for-employers' },
];

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL ||
  'https://members.doublehelixhub.com';

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* ─── Utility Bar ─── */}
      <div
        className={`bg-[#002B5C] transition-all duration-300 overflow-hidden ${
          scrolled ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex h-10 items-center justify-between">
            {/* Left: audience links */}
            <nav className="hidden sm:flex items-center gap-1" aria-label="Audience navigation">
              {utilityLinks.map((link, idx) => (
                <span key={link.name} className="flex items-center">
                  <Link
                    href={link.href}
                    className="text-xs font-medium text-white/70 hover:text-white transition-colors px-2 py-1 rounded"
                  >
                    {link.name}
                  </Link>
                  {idx < utilityLinks.length - 1 && (
                    <span className="text-white/30 text-xs select-none" aria-hidden="true">|</span>
                  )}
                </span>
              ))}
            </nav>

            {/* Right: sign-in + phone */}
            <div className="flex items-center gap-4 ml-auto">
              <a
                href={`${PORTAL_URL}/signin`}
                className="text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Member Sign In
              </a>
              <span className="hidden sm:inline text-white/30 text-xs select-none" aria-hidden="true">|</span>
              <a
                href="tel:18005551234"
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                <Phone className="w-3 h-3" />
                1-800-555-1234
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Navigation Bar ─── */}
      <div
        className={`transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm'
            : 'bg-white border-b border-slate-100'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0 flex items-center">
              <Image
                src="/logo.png"
                alt="Double Helix Hub"
                width={180}
                height={48}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="relative px-3 py-2 text-sm font-medium text-slate-700 hover:text-teal-700 rounded-md transition-colors group"
                >
                  {item.name}
                  <span className="absolute inset-x-3 -bottom-px h-0.5 bg-teal-700 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </Link>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-3">
              <Link href="/enroll">
                <Button
                  className="bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-sm px-5"
                  size="sm"
                >
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="lg:hidden relative p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen ? 'true' : 'false'}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-controls="mobile-menu"
            >
              <span className="sr-only">{mobileMenuOpen ? 'Close' : 'Open'} main menu</span>
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mobile Menu ─── */}
      <div
        id="mobile-menu"
        className={`lg:hidden fixed inset-x-0 bg-white shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${
          mobileMenuOpen ? 'max-h-[calc(100vh-4rem)] opacity-100' : 'max-h-0 opacity-0'
        } ${scrolled ? 'top-16' : 'top-[6.5rem]'}`}
      >
        <div className="container mx-auto px-4 py-4 space-y-1">
          {/* Audience links (visible on mobile only inside menu) */}
          <div className="flex items-center gap-3 px-3 pb-3 mb-3 border-b border-slate-100">
            {utilityLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-xs font-medium text-slate-500 hover:text-teal-700 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Main nav links */}
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="block px-3 py-2.5 text-base font-medium text-slate-700 hover:text-teal-700 hover:bg-slate-50 rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}

          {/* Actions */}
          <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
            <a
              href={`${PORTAL_URL}/signin`}
              className="block px-3 py-2.5 text-base font-medium text-slate-600 hover:text-teal-700 hover:bg-slate-50 rounded-md transition-colors"
            >
              Member Sign In
            </a>
            <a
              href="tel:18005551234"
              className="flex items-center gap-2 px-3 py-2.5 text-base font-medium text-slate-600 hover:text-teal-700 hover:bg-slate-50 rounded-md transition-colors"
            >
              <Phone className="w-4 h-4" />
              1-800-555-1234
            </a>
            <Link href="/enroll" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-lg mt-1">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Backdrop overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[-1]"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
