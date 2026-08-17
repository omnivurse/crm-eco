'use client';

import { useEffect, useState } from 'react';
import { CrmCommandBar } from '@/components/crm/shell/CrmCommandBar';
import { SEARCH_PLACEHOLDER } from '@/lib/crm/search-copy';

interface DeskGreetingProps {
  fullName: string | null | undefined;
}

/**
 * Greeting + search-first command bar. The greeting/date are computed after
 * mount (same approach as the old DashboardHero) so the server-rendered
 * "Hello" never mismatches the browser's local hour on hydration.
 */
export function DeskGreeting({ fullName }: DeskGreetingProps) {
  const [dateInfo, setDateInfo] = useState({ greeting: 'Hello', formattedDate: '' });

  useEffect(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const formattedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    queueMicrotask(() => setDateInfo({ greeting, formattedDate }));
  }, []);

  const firstName = fullName?.trim().split(/\s+/)[0] || 'there';

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
          {dateInfo.greeting}, {firstName}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
          {dateInfo.formattedDate || ' '}
        </p>
      </div>
      <CrmCommandBar
        size="hero"
        placeholder={SEARCH_PLACEHOLDER}
        className="crm-motion-safe md:max-w-xl md:flex-1"
      />
    </div>
  );
}
