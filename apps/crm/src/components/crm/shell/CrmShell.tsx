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
    <div className="flex h-screen bg-gray-50">
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
        <main className="flex-1 overflow-auto">
          {children}
        </main>
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
