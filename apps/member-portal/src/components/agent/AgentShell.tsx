'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AgentSidebar } from './AgentSidebar';
import { AgentTopNav } from './AgentTopNav';

interface AgentShellProps {
  children: React.ReactNode;
  agent: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    enrollment_code?: string | null;
    company_name?: string | null;
    logo_url?: string | null;
    primary_color?: string;
  };
}

/**
 * Client-side shell component that manages mobile navigation state for the Agent Portal.
 * Wraps the sidebar, top nav, and main content area.
 */
export function AgentShell({ children, agent }: AgentShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    queueMicrotask(() => setMobileMenuOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="mp-atmosphere flex min-h-screen">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(11,18,32,0.28)] backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <AgentSidebar
        agent={agent}
        mobileMenuOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AgentTopNav
          agent={agent}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 xl:p-8 2xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
