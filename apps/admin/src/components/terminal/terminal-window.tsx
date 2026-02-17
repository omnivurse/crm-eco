'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { VisuallyHidden } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui/lib/utils';
import { Terminal as TerminalIcon } from 'lucide-react';
import { useTerminal } from './terminal-provider';
import { CommandInput } from './command-input';
import { CommandOutput } from './command-output';

export function TerminalWindow() {
  const { isOpen, close, currentPanel } = useTerminal();
  const windowRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState<string>('--:--:--');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen && windowRef.current) {
      const firstInput = windowRef.current.querySelector('input');
      firstInput?.focus();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        ref={windowRef}
        hideCloseButton
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden',
          'w-[calc(100%-2rem)] sm:w-full sm:max-w-3xl',
          'max-h-[80vh] sm:max-h-[700px]',
        )}
        aria-label="Command Center Terminal"
      >
        <VisuallyHidden>
          <DialogTitle>Command Center</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
              <TerminalIcon className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-foreground font-heading">
              Command Center
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              currentPanel
                ? 'bg-primary/10 text-primary'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            )}>
              {currentPanel ? currentPanel.toUpperCase() : 'READY'}
            </span>
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <CommandOutput />
          <CommandInput />
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Systems Online</span>
          </div>
          <div className="hidden sm:block tracking-wide">
            {currentPanel ? `Module: ${currentPanel.toUpperCase()}` : 'Awaiting Input'}
          </div>
          <span className="font-mono tabular-nums">{currentTime}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
