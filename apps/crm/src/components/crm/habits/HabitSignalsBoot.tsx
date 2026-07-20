'use client';

/**
 * Boots habit signal capture for the CRM shell.
 * Tracks module_visit on route changes (0 tokens).
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  emitHabitSignal,
  moduleKeyFromPathname,
} from '@/lib/crm/habits/beacon';

export function HabitSignalsBoot() {
  const pathname = usePathname();
  const lastModule = useRef<string | null>(null);

  useEffect(() => {
    const moduleKey = moduleKeyFromPathname(pathname);
    if (!moduleKey) return;
    if (lastModule.current === moduleKey) return;
    lastModule.current = moduleKey;
    emitHabitSignal('module_visit', { module_key: moduleKey });
  }, [pathname]);

  return null;
}
