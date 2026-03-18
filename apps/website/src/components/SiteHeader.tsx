'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@crm-eco/ui';
import { Menu, X } from 'lucide-react';

const navigation = [
  { name: 'About', href: '/about' },
  { name: 'Plans', href: '/plans' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'FAQ', href: '/faq' },
  { name: 'Blog', href: '/blog' },
  { name: 'Contact', href: '/contact' },
  { name: 'For Advisors', href: '/for-advisors' },
];

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://members.payitforwardhealth.com';

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <Image
              src="/logo.png"
              alt="Pay It Forward Health"
              width={180}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href={`${PORTAL_URL}/signin`}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md transition-colors"
            >
              Member Sign In
            </a>
            <Link href="/enroll">
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="lg:hidden bg-white border-t shadow-lg">
          <div className="container mx-auto px-4 py-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-3 py-2.5 text-base font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t space-y-3">
              <a
                href={`${PORTAL_URL}/signin`}
                className="block px-3 py-2.5 text-base font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
              >
                Member Sign In
              </a>
              <Link href="/enroll" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
