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

  // Close mobile menu on route change
  useEffect(() => {
    queueMicrotask(() => setMobileMenuOpen(false));
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
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
    <div className="flex min-h-screen bg-slate-100">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <AgentSidebar
        agent={agent}
        mobileMenuOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AgentTopNav
          agent={agent}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
