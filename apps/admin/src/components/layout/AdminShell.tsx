'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopNav } from './AdminTopNav';
import { AdminFooter } from './AdminFooter';
import { Breadcrumbs } from './Breadcrumbs';
import type { SwitcherTenant } from './OrganizationSwitcher';

interface AdminShellProps {
  children: React.ReactNode;
  profile: {
    fullName: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
    organizationId: string;
  };
  userId: string;
  tenants?: SwitcherTenant[];
  activeTenantId?: string;
}

/**
 * Ethereal Glass shell — floating rail + command island.
 * Light mode is default; dark OLED via ThemeToggle.
 */
export function AdminShell({
  children,
  profile,
  userId,
  tenants,
  activeTenantId,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('admin-sidebar-main-collapsed');
    if (stored === 'true') {
      queueMicrotask(() => setSidebarCollapsed(true));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('admin-sidebar-main-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
    <div className="adm-atmosphere relative flex h-[100dvh] flex-col overflow-hidden">
      <div className="adm-grain" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[92rem] flex-col gap-3 px-3 pb-3 pt-3 sm:px-4 lg:px-6">
        <AdminTopNav
          profile={profile}
          userId={userId}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          tenants={tenants}
          activeTenantId={activeTenantId}
        />

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-[rgba(11,18,32,0.35)] backdrop-blur-sm lg:hidden dark:bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="flex min-h-0 flex-1 gap-4">
          <AdminSidebar
            mobileMenuOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          <main className="min-w-0 flex-1 overflow-auto scrollbar-thin [scrollbar-gutter:stable]">
            <div className="mx-auto w-full max-w-[1920px] pb-16">
              <Breadcrumbs />
              {children}
            </div>
          </main>
        </div>

        <div className="hidden lg:block">
          <AdminFooter />
        </div>
      </div>
    </div>
  );
}
