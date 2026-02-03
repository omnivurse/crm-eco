'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CrmTopBar } from './CrmTopBar';
import { ZohoContextualSidebar } from './ZohoContextualSidebar';
import { Footer } from './Footer';
import { ModuleProvider } from '@/contexts/ModuleContext';
import { TerminalProvider, useTerminal } from '@/components/terminal';
import { VoiceProvider } from '@/components/voice';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

const CommandPalette = dynamic(() => import('./CommandPalette').then((mod) => mod.CommandPalette), {
  ssr: false,
});
const TerminalWindow = dynamic(() => import('@/components/terminal').then((mod) => mod.TerminalWindow), {
  ssr: false,
});
const VoiceCommandCenter = dynamic(() => import('@/components/voice').then((mod) => mod.VoiceCommandCenter), {
  ssr: false,
});

interface CrmShellProps {
  children: React.ReactNode;
  modules: CrmModule[];
  profile: CrmProfile;
  organizationName?: string;
}

// Inner shell component that can access terminal context
function CrmShellInner({
  children,
  modules,
  profile,
  organizationName,
  navigate,
}: CrmShellProps & { navigate: (path: string) => void }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const terminal = useTerminal();
  const pathname = usePathname();

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
    <VoiceProvider
      navigate={navigate}
      profile={{
        id: profile.id,
        organization_id: profile.organization_id,
      }}
      openTerminal={terminal.open}
    >
      <ModuleProvider>
        <div className="relative flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-transparent">
          {/* Animated Gradient Mesh Background */}
          <div className="fixed inset-0 gradient-mesh" />

          {/* Static background orbs for depth - subtle in light mode */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            {/* Teal orb - top left */}
            <div
              className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10 dark:opacity-20"
              style={{
                background: 'radial-gradient(circle, rgba(4, 116, 116, 0.4) 0%, transparent 70%)',
              }}
            />
            {/* Emerald orb - bottom right */}
            <div
              className="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full opacity-8 dark:opacity-15"
              style={{
                background: 'radial-gradient(circle, rgba(2, 115, 67, 0.4) 0%, transparent 70%)',
              }}
            />
            {/* Navy orb - center */}
            <div
              className="absolute top-1/3 left-1/2 w-[600px] h-[600px] rounded-full opacity-5 dark:opacity-10"
              style={{
                background: 'radial-gradient(circle, rgba(0, 53, 96, 0.5) 0%, transparent 70%)',
              }}
            />
          </div>

          {/* Content Container */}
          <div className="relative z-10 flex flex-col w-full h-full">
            {/* Top Bar - Primary Navigation with Zoho-style module tabs */}
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
              {/* Zoho-style Contextual Sidebar - changes based on active module */}
              <ZohoContextualSidebar
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                mobileMenuOpen={mobileMenuOpen}
                onMobileClose={() => setMobileMenuOpen(false)}
              />

              {/* Page Content */}
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

          {/* Command Palette */}
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            modules={modules}
          />

          {/* Starship Command Center Terminal */}
          <TerminalWindow />

          {/* Voice Command Center */}
          <VoiceCommandCenter />
        </div>
      </ModuleProvider>
    </VoiceProvider>
  );
}

export function CrmShell({ children, modules, profile, organizationName }: CrmShellProps) {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <TerminalProvider
      navigate={handleNavigate}
      profile={{
        id: profile.id,
        organization_id: profile.organization_id,
        role: profile.crm_role ?? undefined,
        full_name: profile.full_name,
      }}
    >
      <CrmShellInner
        modules={modules}
        profile={profile}
        organizationName={organizationName}
        navigate={handleNavigate}
      >
        {children}
      </CrmShellInner>
    </TerminalProvider>
  );
}
