'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { CrmTopBar } from './CrmTopBar';
import { CrmModuleTabBar } from './CrmModuleTabBar';
import { ZohoContextualSidebar } from './ZohoContextualSidebar';
import { BottomBar } from './bottom-bar';
import { CommandPalette } from './CommandPalette';
import { OfflineBanner } from '@/components/crm/offline/OfflineBanner';
import { SyncToastNotifier } from '@/components/crm/offline/SyncToastNotifier';
import { OfflineAnalyticsBoot } from '@/components/crm/offline/OfflineAnalyticsBoot';
import { HabitSignalsBoot } from '@/components/crm/habits/HabitSignalsBoot';
import { NewMailNotifier } from '@/components/crm/inbox/NewMailNotifier';
import { ModuleProvider, ModulePathSync } from '@/contexts/ModuleContext';
import { GizmoProvider } from '@/components/crm/gizmo';
import dynamic from 'next/dynamic';

const GizmoWidget = dynamic(
  () => import('@/components/crm/gizmo/GizmoWidget').then((m) => m.GizmoWidget),
  { ssr: false }
);
import type { CrmModule, CrmProfile } from '@/lib/crm/types';
import { CRM_OPEN_COMMAND_PALETTE_EVENT } from '@/lib/crm/command-palette-bus';

interface CrmShellProps {
  children: React.ReactNode;
  modules: CrmModule[];
  profile: CrmProfile;
}

export function CrmShell({
  children,
  modules,
  profile,
}: CrmShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    queueMicrotask(() => setMobileMenuOpen(false));
  }, [pathname]);

  // Dashboard hero / top bar can open the command palette via event bus.
  useEffect(() => {
    const openPalette = () => setCommandPaletteOpen(true);
    window.addEventListener(CRM_OPEN_COMMAND_PALETTE_EVENT, openPalette);
    return () => window.removeEventListener(CRM_OPEN_COMMAND_PALETTE_EVENT, openPalette);
  }, []);

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

  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
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
      <ModulePathSync />
      <GizmoProvider profileId={profile.id}>
        {/* Canvas binds to the shared --background token instead of raw
            slate-50/slate-950, so both consoles sit on one ground. */}
        <div className="relative flex flex-col h-screen overflow-hidden bg-background [scrollbar-gutter:stable]">
          {/* Content Container */}
          <div className="relative flex flex-col w-full h-full min-h-0">
            {/* Offline banner — sits above the topbar so the user
                notices it immediately when connectivity drops. Returns
                null when navigator.onLine is true, so there's zero
                visual cost on a healthy connection. */}
            <OfflineBanner />

            {/* Sync toast bridge — silently listens to the mutation
                queue and emits consolidated "Synced N changes" /
                "Back online" / "Couldn't sync" toasts. */}
            <SyncToastNotifier />
            <OfflineAnalyticsBoot />
            <HabitSignalsBoot />

            {/* Announces inbound email from anywhere in the CRM, not just the
                inbox page — the agent who needs telling is the one who isn't
                looking at the inbox. */}
            <NewMailNotifier organizationId={profile.organization_id} />

            {/* Top Bar */}
            <CrmTopBar
              modules={modules}
              profile={profile}
              onOpenCommandPalette={handleOpenCommandPalette}
              mobileMenuOpen={mobileMenuOpen}
              onMobileMenuToggle={handleMobileMenuToggle}
            />

            <CrmModuleTabBar />

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

              <main className="flex-1 min-w-0 min-h-0 overflow-auto [scrollbar-gutter:stable] px-2 py-1.5 sm:px-3 sm:py-1.5 lg:px-5 lg:py-2 scrollbar-thin">
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

          {/* Global Command Palette (⌘K / Ctrl+K) */}
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            modules={modules}
          />
        </div>
      </GizmoProvider>
    </ModuleProvider>
  );
}
