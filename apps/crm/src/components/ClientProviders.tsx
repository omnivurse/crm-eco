'use client';

import { SecurityProvider } from '@/providers/SecurityProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';

interface ClientProvidersProps {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
}

export function ClientProviders({ children, userName = '', userEmail = '' }: ClientProvidersProps) {
  return (
    <SecurityProvider userName={userName} userEmail={userEmail}>
      <QueryProvider>
        {children}
        <Toaster />
      </QueryProvider>
    </SecurityProvider>
  );
}
