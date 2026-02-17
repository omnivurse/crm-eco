'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CrmTopBar } from './CrmTopBar';
import { ZohoContextualSidebar } from './ZohoContextualSidebar';
import { Footer } from './Footer';
import { ModuleProvider } from '@/contexts/ModuleContext';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

// Lazy load command palette - only loaded when user interacts
const CommandPalette = dynamic(() => import('./CommandPalette').then((mod) => mod.CommandPalette), {
  ssr: false,
});

interface CrmShellProps {
  children: React.ReactNode;
  modules: CrmModule[];
  profile: CrmProfile;
  organizationName?: string;
}

export function CrmShell({ children, modules, profile, organizationName }: CrmShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
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
    <ModuleProvider>
      <div className="relative flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Content Container */}
        <div className="relative flex flex-col w-full h-full">
          {/* Top Bar */}
          <CrmTopBar
            modules={modules}
            profile={profile}
            organizationName={organizationName}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            mobileMenuOpen={mobileMenuOpen}
            onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          />

          {/* Mobile Menu Overlay */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0">
            <ZohoContextualSidebar
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              mobileMenuOpen={mobileMenuOpen}
              onMobileClose={() => setMobileMenuOpen(false)}
            />

            <main className="flex-1 overflow-auto p-4 lg:p-6 scrollbar-thin">
              <div className="max-w-7xl mx-auto pb-16">
                {children}
              </div>
            </main>
          </div>

          {/* Footer - hidden on mobile */}
          <div className="hidden lg:block">
            <Footer />
          </div>
        </div>

        {/* Command Palette - lazy loaded */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          modules={modules}
        />
      </div>
    </ModuleProvider>
  );
}
