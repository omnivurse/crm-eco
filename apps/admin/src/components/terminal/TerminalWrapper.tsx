'use client';

// Terminal Wrapper for Admin App
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { TerminalProvider, TerminalWindow } from './index';

interface TerminalWrapperProps {
  children: React.ReactNode;
  profile?: {
    id?: string;
    role?: string;
    full_name?: string;
    organization_id?: string;
  };
}

export function TerminalWrapper({ children, profile }: TerminalWrapperProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <TerminalProvider
      navigate={handleNavigate}
      supabase={supabase}
      profile={profile}
    >
      {children}
      <TerminalWindow />
    </TerminalProvider>
  );
}
