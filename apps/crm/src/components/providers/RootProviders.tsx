'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ServiceWorkerRegistration } from '@/components/pwa';
import { PinLockOverlay } from '@crm-eco/ui';

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <PinLockOverlay pin="012049" appName="Secure Access" />
      <ThemeProvider defaultTheme="light">
        <ServiceWorkerRegistration />
        {children}
      </ThemeProvider>
    </>
  );
}
