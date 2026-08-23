'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { CrmTopBar } from './CrmTopBar';
import { CrmModuleTabBar } from './CrmModuleTabBar';
import { ZohoContextualSidebar } from './ZohoContextualSidebar';
import { BottomBar } from './bottom-bar';
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
const CommandPalette = dynamic(
  () => import('./CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);
import type { CrmModule, CrmProfile } from '@/lib/crm/types';
import type { NavModule, NavProfile } from '@/lib/crm/nav-profile';
import { CRM_OPEN_COMMAND_PALETTE_EVENT } from '@/lib/crm/command-palette-bus';

interface CrmShellProps {
  children: React.ReactNode;
  modules: CrmModule[];
  profile: CrmProfile;
  /** Tenant nav profile resolved server-side from `crm.nav.simple`. */
  navProfile?: NavProfile;
  /** Enabled org modules (+ field counts) that drive module-based nav links. */
  navModules?: NavModule[];
}

export function CrmShell({
  children,
  modules,
  profile,
  navProfile = 'full',
  navModules,
}: CrmShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteMounted, setCommandPaletteMounted] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    queueMicrotask(() => setMobileMenuOpen(false));
  }, [pathname]);

  // Dashboard hero / top bar can open the command palette via event bus.
  useEffect(() => {
    const openPalette = () => {
      setCommandPaletteMounted(true);
      setCommandPaletteOpen(true);
    };
    window.addEventListener(CRM_OPEN_COMMAND_PALETTE_EVENT, openPalette);
    return () => window.removeEventListener(CRM_OPEN_COMMAND_PALETTE_EVENT, openPalette);
  }, []);

  // Own ⌘K until the palette chunk is mounted — CommandPalette is the
  // keyboard owner after that, so this listener unregisters to avoid a
  // double-toggle.
  useEffect(() => {
    if (commandPaletteMounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteMounted(true);
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteMounted]);

  useEffect(() => {
    if (commandPaletteOpen) setCommandPaletteMounted(true);
  }, [commandPaletteOpen]);

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
    setCommandPaletteMounted(true);
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
            {/* A11Y-1: the first Tab stop of every CRM page. Without it a
                keyboard user walks the whole top bar, module tab bar and
                sidebar (18+ stops) before reaching the page itself; from here
                the next Tab is the page's own first control (on a record, its
                "Skip to record details" link). Invisible until focused. */}
            <a
              href="#crm-main-content"
              onClick={(e) => {
                const target = document.getElementById('crm-main-content');
                if (!target) return;
                e.preventDefault();
                target.focus({ preventScroll: false });
              }}
              className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-50 focus:rounded-md focus:bg-teal-600 focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
              data-testid="crm-skip-to-content"
            >
              Skip to content
            </a>
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

            <CrmModuleTabBar navProfile={navProfile} />

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
                navProfile={navProfile}
                navModules={navModules ?? modules}
              />

              <main
                id="crm-main-content"
                tabIndex={-1}
                className="flex-1 min-w-0 min-h-0 overflow-auto [scrollbar-gutter:stable] px-2 py-1.5 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2 scrollbar-thin focus:outline-none"
              >
                {/* Full-bleed within the shell — no ultrawide max-width cap.
                    Page-level max-w is reserved for reading/forms only. */}
                <div className="w-full pb-10">
                  {children}
                </div>
              </main>
            </div>

            {/* Gizmo Tutorial Widget */}
            <GizmoWidget />

            {/* Bottom Action Bar - Zoho-style */}
            <BottomBar modules={modules} profile={profile} />
          </div>

          {commandPaletteMounted && (
            <CommandPalette
              open={commandPaletteOpen}
              onOpenChange={setCommandPaletteOpen}
              modules={modules}
            />
          )}
        </div>
      </GizmoProvider>
    </ModuleProvider>
  );
}
