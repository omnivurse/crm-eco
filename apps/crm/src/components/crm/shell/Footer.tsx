'use client';

import Link from 'next/link';
import {
  BookOpen,
  HelpCircle,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { SecurityTrustBadge } from '@/components/security';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* Main Row - Logo, Links, Security Badge */}
        <div className="flex items-center justify-between">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <Link href="/crm" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Pay It Forward HealthShare"
                className="h-7 w-auto object-contain"
              />
            </Link>
            <span className="hidden md:inline text-slate-400 dark:text-slate-600">|</span>
            <span className="hidden md:inline text-sm text-slate-500 dark:text-slate-400">
              Empowering your business relationships
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4 lg:gap-6">
            <Link
              href="/crm/features"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Features</span>
            </Link>
            <Link
              href="/crm/learn"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Learn</span>
            </Link>
            <Link
              href="/crm/learn/getting-started"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </Link>
            <a
              href="mailto:support@payitforwardhealthshare.com"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Support</span>
            </a>
          </nav>

          {/* Security Badge */}
          <SecurityTrustBadge variant="compact" showPopover={true} />
        </div>

        {/* Copyright - Centered at Bottom */}
        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            &copy; {currentYear} Pay It Forward HealthShare. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
