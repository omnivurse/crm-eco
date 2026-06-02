'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ServiceWorkerRegistration } from '@/components/pwa';
export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeProvider defaultTheme="light">
        <ServiceWorkerRegistration />
        {children}
      </ThemeProvider>
    </>
  );
}
