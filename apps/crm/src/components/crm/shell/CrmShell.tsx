'use client';

import { useState } from 'react';
import { CrmSidebar } from './CrmSidebar';
import { CrmHeader } from './CrmHeader';
import { CommandPalette } from './CommandPalette';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';

interface CrmShellProps {
  children: React.ReactNode;
  modules: CrmModule[];
  profile: CrmProfile;
  organizationName?: string;
}

export function CrmShell({ children, modules, profile, organizationName }: CrmShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Animated Gradient Mesh Background */}
      <div className="fixed inset-0 gradient-mesh" />
      
      {/* Animated Orbs for depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Teal orb - top left */}
        <div 
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 animate-float"
          style={{ 
            background: 'radial-gradient(circle, rgba(4, 116, 116, 0.4) 0%, transparent 70%)',
            animationDelay: '0s',
            animationDuration: '15s',
          }} 
        />
        {/* Emerald orb - bottom right */}
        <div 
          className="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full opacity-15 animate-float"
          style={{ 
            background: 'radial-gradient(circle, rgba(2, 115, 67, 0.4) 0%, transparent 70%)',
            animationDelay: '5s',
            animationDuration: '20s',
          }} 
        />
        {/* Navy orb - center */}
        <div 
          className="absolute top-1/3 left-1/2 w-[600px] h-[600px] rounded-full opacity-10 animate-float"
          style={{ 
            background: 'radial-gradient(circle, rgba(0, 53, 96, 0.5) 0%, transparent 70%)',
            animationDelay: '2s',
            animationDuration: '25s',
          }} 
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex w-full h-full">
        {/* Sidebar */}
        <CrmSidebar modules={modules} organizationName={organizationName} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <CrmHeader
            profile={profile}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-6 scrollbar-thin">
            <div className="animate-fade-in-up">
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
  );
}
