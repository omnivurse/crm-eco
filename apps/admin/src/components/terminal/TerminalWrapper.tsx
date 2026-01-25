'use client';

// Terminal Wrapper for Admin App
import { useRouter } from 'next/navigation';
import { TerminalProvider, TerminalWindow } from './index';

interface TerminalWrapperProps {
  children: React.ReactNode;
  profile?: {
    id?: string;
    role?: string;
    full_name?: string;
  };
}

export function TerminalWrapper({ children, profile }: TerminalWrapperProps) {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <TerminalProvider
      navigate={handleNavigate}
      profile={profile}
    >
      {children}
      <TerminalWindow />
    </TerminalProvider>
  );
}
