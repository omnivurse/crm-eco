'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BookOpen,
  HelpCircle,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

export function AdminFooter() {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  const currentYear = isMounted ? new Date().getFullYear() : 2026;

  return (
    <footer className="relative z-10 border-t border-slate-200/50 bg-white/50 backdrop-blur-sm mt-8">
      <div className="px-6 py-3">
        {/* Main Row */}
        <div className="flex items-center justify-between">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
              <Image
                src="/logo-pif-full.png"
                alt="Pay It Forward HealthShare"
                width={160}
                height={42}
                className="h-10 w-auto object-contain"
                loading="lazy"
                quality={80}
              />
            </Link>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden md:inline text-sm text-slate-500">
              Admin Portal
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4 lg:gap-6">
            <Link
              href="/features"
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#047474] transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Features</span>
            </Link>
            <Link
              href="/learn"
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#047474] transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Learn</span>
            </Link>
            <Link
              href="/learn/getting-started"
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#047474] transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </Link>
            <a
              href="mailto:support@payitforwardhealthshare.com"
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#047474] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Support</span>
            </a>
          </nav>

          {/* Admin Portal Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
            <div className="w-2 h-2 rounded-full bg-[#047474]" />
            <span className="text-xs font-medium text-slate-600">Admin Portal v1.0</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-3 pt-3 border-t border-slate-200/50">
          <p className="text-xs text-slate-400 text-center">
            &copy; {currentYear} Pay It Forward HealthShare. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
