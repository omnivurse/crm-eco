'use client';

import { useState } from 'react';
import { CrmTopBar } from './CrmTopBar';
import { ZohoContextualSidebar } from './ZohoContextualSidebar';
import { CommandPalette } from './CommandPalette';
import { ModuleProvider } from '@/contexts/ModuleContext';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

interface CrmShellProps {
  children: React.ReactNode;
  modules: CrmModule[];
  profile: CrmProfile;
  organizationName?: string;
}

export function CrmShell({ children, modules, profile, organizationName }: CrmShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default to open

  return (
    <ModuleProvider>
      <div className="relative flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-transparent">
        {/* Animated Gradient Mesh Background */}
        <div className="fixed inset-0 gradient-mesh" />

        {/* Animated Orbs for depth - more subtle in light mode */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {/* Teal orb - top left */}
          <div
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10 dark:opacity-20 animate-float"
            style={{
              background: 'radial-gradient(circle, rgba(4, 116, 116, 0.4) 0%, transparent 70%)',
              animationDelay: '0s',
              animationDuration: '15s',
            }}
          />
          {/* Emerald orb - bottom right */}
          <div
            className="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full opacity-8 dark:opacity-15 animate-float"
            style={{
              background: 'radial-gradient(circle, rgba(2, 115, 67, 0.4) 0%, transparent 70%)',
              animationDelay: '5s',
              animationDuration: '20s',
            }}
          />
          {/* Navy orb - center */}
          <div
            className="absolute top-1/3 left-1/2 w-[600px] h-[600px] rounded-full opacity-5 dark:opacity-10 animate-float"
            style={{
              background: 'radial-gradient(circle, rgba(0, 53, 96, 0.5) 0%, transparent 70%)',
              animationDelay: '2s',
              animationDuration: '25s',
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
          />

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0">
            {/* Zoho-style Contextual Sidebar - changes based on active module */}
            <ZohoContextualSidebar
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
            />

            {/* Page Content */}
            <main className="flex-1 overflow-auto p-6 scrollbar-thin">
              <div className="animate-fade-in-up max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          modules={modules}
        />
      </div>
    </ModuleProvider>
  );
}
