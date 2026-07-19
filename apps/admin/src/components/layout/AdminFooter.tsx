'use client';

import * as React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@crm-eco/ui';
import {
  BookOpen,
  Question,
  ChatCircle,
  Sparkle,
} from '@phosphor-icons/react';

export function AdminFooter() {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  const currentYear = isMounted ? new Date().getFullYear() : 2026;

  return (
    <footer className="relative z-10 rounded-2xl border border-[var(--adm-hairline)] bg-[var(--adm-glass)] px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" title="Go to Dashboard" className="flex flex-shrink-0 items-center gap-2">
            <BrandLogo variant="full" size="md" />
          </Link>
          <span className="hidden text-[var(--adm-muted)] md:inline">|</span>
          <span className="hidden truncate text-sm text-[var(--adm-muted)] md:inline">
            MMS — Benefits Enrollment & Member Management
          </span>
        </div>

        <nav className="flex items-center gap-4 lg:gap-6">
          <Link
            href="/features"
            title="Features"
            className="flex items-center gap-1.5 text-sm text-[var(--adm-muted)] transition-colors hover:text-[var(--adm-cyan)]"
          >
            <Sparkle weight="light" className="h-4 w-4" />
            <span className="hidden sm:inline">Features</span>
          </Link>
          <Link
            href="/learn"
            title="Learn"
            className="flex items-center gap-1.5 text-sm text-[var(--adm-muted)] transition-colors hover:text-[var(--adm-cyan)]"
          >
            <BookOpen weight="light" className="h-4 w-4" />
            <span className="hidden sm:inline">Learn</span>
          </Link>
          <Link
            href="/learn/getting-started"
            title="Help"
            className="flex items-center gap-1.5 text-sm text-[var(--adm-muted)] transition-colors hover:text-[var(--adm-cyan)]"
          >
            <Question weight="light" className="h-4 w-4" />
            <span className="hidden sm:inline">Help</span>
          </Link>
          <a
            href="mailto:support@doublehelixhub.com"
            title="Support"
            className="flex items-center gap-1.5 text-sm text-[var(--adm-muted)] transition-colors hover:text-[var(--adm-cyan)]"
          >
            <ChatCircle weight="light" className="h-4 w-4" />
            <span className="hidden sm:inline">Support</span>
          </a>
        </nav>

        <div className="hidden items-center gap-2 rounded-full border border-[var(--adm-hairline)] bg-[rgba(11,109,133,0.05)] px-3 py-1.5 lg:flex">
          <div className="h-2 w-2 rounded-full bg-[var(--adm-cyan)]" />
          <span className="text-xs font-medium text-[var(--adm-muted)]">MMS v1.0</span>
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--adm-hairline)] pt-3">
        <p className="text-center text-xs text-[var(--adm-muted)]">
          &copy; {currentYear} Double Helix Hub. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
