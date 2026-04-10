'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { CrmTopBar } from './CrmTopBar';
import { ZohoContextualSidebar } from './ZohoContextualSidebar';
import { BottomBar } from './bottom-bar';
import { ModuleProvider } from '@/contexts/ModuleContext';
import { GizmoProvider } from '@/components/crm/gizmo';
import dynamic from 'next/dynamic';

const GizmoWidget = dynamic(
  () => import('@/components/crm/gizmo/GizmoWidget').then((m) => m.GizmoWidget),
  { ssr: false }
);
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

interface CrmShellProps {
  children: React.ReactNode;
  modules: CrmModule[];
  profile: CrmProfile;
  organizationName?: string;
}

export function CrmShell({ children, modules, profile, organizationName }: CrmShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Stable callbacks for memoized children
  const handleOpenCommandPalette = useCallback(() => {
    // Smart Chat input in BottomBar handles Ctrl+K now
  }, []);
  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);
  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <ModuleProvider>
      <GizmoProvider profileId={profile.id}>
        <div className="relative flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
          {/* Content Container */}
          <div className="relative flex flex-col w-full h-full">
            {/* Top Bar */}
            <CrmTopBar
              modules={modules}
              profile={profile}
              organizationName={organizationName}
              onOpenCommandPalette={handleOpenCommandPalette}
              mobileMenuOpen={mobileMenuOpen}
              onMobileMenuToggle={handleMobileMenuToggle}
            />

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                onClick={handleMobileClose}
                aria-hidden="true"
              />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex min-h-0">
              <ZohoContextualSidebar
                isOpen={sidebarOpen}
                onToggle={handleSidebarToggle}
                mobileMenuOpen={mobileMenuOpen}
                onMobileClose={handleMobileClose}
              />

              <main className="flex-1 min-w-0 overflow-auto px-2 py-1.5 sm:px-3 sm:py-1.5 lg:px-5 lg:py-2 scrollbar-thin">
                <div className="w-full max-w-[1920px] mx-auto pb-10">
                  {children}
                </div>
              </main>
            </div>

            {/* Gizmo Tutorial Widget */}
            <GizmoWidget />

            {/* Bottom Action Bar - Zoho-style */}
            <BottomBar modules={modules} profile={profile} />
          </div>
        </div>
      </GizmoProvider>
    </ModuleProvider>
  );
}
