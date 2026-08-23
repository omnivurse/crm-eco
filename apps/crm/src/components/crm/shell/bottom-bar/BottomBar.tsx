'use client';

import { useState, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Radio,
  Contact,
  Blocks,
  StickyNote,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@crm-eco/ui/components/popover';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';
import { SmartChatInput } from './SmartChatInput';
import { ChatPanel } from './ChatPanel';
import { ChannelsPanel } from './ChannelsPanel';
import { ContactsPanel } from './ContactsPanel';
import { CommandsPopup } from './CommandsPopup';
import { StickyNotesPanel } from './StickyNotesPanel';

type PanelId = 'chat' | 'channels' | 'contacts' | 'commands' | 'notes' | null;

const tooltipClass =
  'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[10px] font-medium text-white bg-slate-800 dark:bg-slate-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50';

interface BottomBarProps {
  modules: CrmModule[];
  profile: CrmProfile;
}

export const BottomBar = memo(function BottomBar({ modules, profile }: BottomBarProps) {
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const router = useRouter();

  const togglePanel = useCallback((panel: PanelId) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  // NV-8 (D10): desktop chrome. On a phone the bar stole a whole row of the
  // viewport from the record/list content it sits under, so it is lg+ only.
  return (
    <div
      data-testid="crm-bottom-bar"
      className="relative z-40 hidden lg:block border-t border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center h-10 px-2 lg:px-4 gap-1">
        {/* Left Section: Chat, Channels, Contacts */}
        <div className="flex items-center gap-0.5">
          <Popover open={activePanel === 'chat'} onOpenChange={(o) => setActivePanel(o ? 'chat' : null)}>
            <div className="group relative">
              <PopoverTrigger asChild>
                <button
                  aria-label="Chats"
                  onClick={() => togglePanel('chat')}
                  className={cn(
                    'relative flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                    'text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                    activePanel === 'chat' && 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10'
                  )}
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <span className={tooltipClass}>Chats</span>
            </div>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-80 lg:w-96 p-0 max-h-[480px] overflow-hidden"
            >
              <ChatPanel onClose={closePanel} />
            </PopoverContent>
          </Popover>

          <Popover open={activePanel === 'channels'} onOpenChange={(o) => setActivePanel(o ? 'channels' : null)}>
            <div className="group relative">
              <PopoverTrigger asChild>
                <button
                  aria-label="Channels"
                  onClick={() => togglePanel('channels')}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                    'text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                    activePanel === 'channels' && 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10'
                  )}
                >
                  <Radio className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <span className={tooltipClass}>Channels</span>
            </div>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-72 p-0 max-h-[420px] overflow-hidden"
            >
              <ChannelsPanel onClose={closePanel} />
            </PopoverContent>
          </Popover>

          <Popover open={activePanel === 'contacts'} onOpenChange={(o) => setActivePanel(o ? 'contacts' : null)}>
            <div className="group relative">
              <PopoverTrigger asChild>
                <button
                  aria-label="Contacts"
                  onClick={() => togglePanel('contacts')}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                    'text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                    activePanel === 'contacts' && 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10'
                  )}
                >
                  <Contact className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <span className={tooltipClass}>Contacts</span>
            </div>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-80 lg:w-96 p-0 max-h-[480px] overflow-hidden"
            >
              <ContactsPanel onClose={closePanel} />
            </PopoverContent>
          </Popover>
        </div>

        {/* Center Section: Smart Chat Input */}
        <div className="flex-1 mx-2 lg:mx-4">
          <SmartChatInput modules={modules} />
        </div>

        {/* Right Section: Commands, Sticky Notes, Help */}
        <div className="flex items-center gap-0.5">
          <Popover open={activePanel === 'commands'} onOpenChange={(o) => setActivePanel(o ? 'commands' : null)}>
            <div className="group relative">
              <PopoverTrigger asChild>
                <button
                  aria-label="Quick Actions"
                  onClick={() => togglePanel('commands')}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                    'text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                    activePanel === 'commands' && 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10'
                  )}
                >
                  <Blocks className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <span className={tooltipClass}>Quick Actions</span>
            </div>
            <PopoverContent
              side="top"
              align="end"
              sideOffset={8}
              className="w-72 lg:w-80 p-0 overflow-hidden"
            >
              <CommandsPopup modules={modules} onClose={closePanel} />
            </PopoverContent>
          </Popover>

          <Popover open={activePanel === 'notes'} onOpenChange={(o) => setActivePanel(o ? 'notes' : null)}>
            <div className="group relative">
              <PopoverTrigger asChild>
                <button
                  aria-label="Sticky Notes"
                  onClick={() => togglePanel('notes')}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                    'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                    activePanel === 'notes' && 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10'
                  )}
                >
                  <StickyNote className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <span className={tooltipClass}>Sticky Notes</span>
            </div>
            <PopoverContent
              side="top"
              align="end"
              sideOffset={8}
              className="w-80 lg:w-[420px] p-0 max-h-[520px] overflow-hidden"
            >
              <StickyNotesPanel profile={profile} onClose={closePanel} />
            </PopoverContent>
          </Popover>

          <div className="group relative">
            <button
              aria-label="Help"
              onClick={() => router.push('/crm/learn/getting-started')}
              className="flex items-center justify-center w-8 h-8 rounded-md transition-colors text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <span className={tooltipClass}>Help</span>
          </div>
        </div>
      </div>
    </div>
  );
});
