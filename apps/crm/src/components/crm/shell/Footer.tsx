'use client';

import Link from 'next/link';
import {
  BookOpen,
  HelpCircle,
  MessageCircle,
  ExternalLink,
  Heart,
  Zap,
} from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Company */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                CRM<span className="text-teal-500">Eco</span>
              </span>
            </div>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Empowering your business relationships
            </span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <Link
              href="/crm/learn"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Learning Center</span>
            </Link>
            <Link
              href="/crm/learn/getting-started"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Help</span>
            </Link>
            <a
              href="mailto:support@crmeco.com"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Support</span>
            </a>
          </nav>

          {/* Copyright */}
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
            <span>&copy; {currentYear} CRM Eco. All rights reserved.</span>
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-500 fill-current" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
