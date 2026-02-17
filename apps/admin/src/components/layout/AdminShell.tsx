'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopNav } from './AdminTopNav';
import { AdminFooter } from './AdminFooter';
import { Breadcrumbs } from './Breadcrumbs';

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
}

/**
 * Client-side shell component that manages mobile navigation state.
 * Wraps the sidebar, top nav, and main content area.
 */
export function AdminShell({ children, profile, userId }: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  // Hydrate sidebar collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('admin-sidebar-main-collapsed');
    if (stored === 'true') {
      setSidebarCollapsed(true);
    }
  }, []);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('admin-sidebar-main-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
    <div className="relative flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-transparent">
      {/* Animated Gradient Mesh Background */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />

      {/* Static background orbs for depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10 dark:opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(4, 116, 116, 0.4) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full opacity-8 dark:opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(2, 115, 67, 0.4) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 w-[600px] h-[600px] rounded-full opacity-5 dark:opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(0, 53, 96, 0.5) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col w-full h-full">
        {/* Top Bar */}
        <AdminTopNav
          profile={profile}
          userId={userId}
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
          <AdminSidebar
            mobileMenuOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          <main className="flex-1 overflow-auto p-4 lg:p-6 scrollbar-thin">
            <div className="max-w-7xl mx-auto pb-16">
              <Breadcrumbs />
              {children}
            </div>
          </main>
        </div>

        {/* Footer - hidden on mobile */}
        <div className="hidden lg:block">
          <AdminFooter />
        </div>
      </div>
    </div>
  );
}
