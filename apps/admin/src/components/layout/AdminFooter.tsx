'use client';

import * as React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@crm-eco/ui';
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
    <footer className="relative z-10 border-t border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 py-3">
        {/* Main Row */}
        <div className="flex items-center justify-between">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" title="Go to Dashboard" className="flex items-center gap-2 flex-shrink-0">
              <BrandLogo variant="full" size="md" />
            </Link>
            <span className="hidden md:inline text-slate-400 dark:text-slate-600">|</span>
            <span className="hidden md:inline text-sm text-slate-500 dark:text-slate-400">
              Admin Portal
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4 lg:gap-6">
            <Link
              href="/features"
              title="Features — View platform capabilities and updates"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Features</span>
            </Link>
            <Link
              href="/learn"
              title="Learn — Guides, tutorials, and documentation"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Learn</span>
            </Link>
            <Link
              href="/learn/getting-started"
              title="Help — Getting started and FAQ"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </Link>
            <a
              href="mailto:support@doublehelixhub.com"
              title="Support — Contact the support team via email"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Support</span>
            </a>
          </nav>

          {/* Admin Portal Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="w-2 h-2 rounded-full bg-[#0891b2]" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Admin Portal v1.0</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            &copy; {currentYear} Double Helix Hub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
