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
    <div className="flex h-screen bg-slate-50">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <AdminSidebar
        mobileMenuOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopNav
          profile={profile}
          userId={userId}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Breadcrumbs />
          {children}
          {/* Footer - hidden on mobile */}
          <div className="hidden lg:block">
            <AdminFooter />
          </div>
        </main>
      </div>
    </div>
  );
}
