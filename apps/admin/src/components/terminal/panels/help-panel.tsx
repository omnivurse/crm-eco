'use client';

import React from 'react';
import { BookOpen, Compass, Zap, BarChart3, Settings } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { getAllCommands } from '../command-registry';
import { useTerminal } from '../terminal-provider';

const categoryMeta: Record<string, { icon: React.ElementType; title: string }> = {
  navigation: { icon: Compass, title: 'Navigation' },
  actions: { icon: Zap, title: 'Actions' },
  data: { icon: BarChart3, title: 'Data Display' },
  system: { icon: Settings, title: 'System' },
};

export function HelpPanel() {
  const { execute } = useTerminal();
  const commands = getAllCommands();

  const categories = {
    navigation: commands.filter(c => c.category === 'navigation'),
    actions: commands.filter(c => c.category === 'actions'),
    data: commands.filter(c => c.category === 'data'),
    system: commands.filter(c => c.category === 'system'),
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <BookOpen className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold tracking-wide font-heading flex-1">
          Command Reference
        </span>
        <span className="text-xs text-muted-foreground">{commands.length} commands</span>
      </div>

      <div className="p-4 space-y-5">
        {Object.entries(categories).map(([category, cmds]) => {
          if (cmds.length === 0) return null;
          const meta = categoryMeta[category];
          const Icon = meta?.icon ?? Zap;
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {meta?.title ?? category}
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cmds.map(cmd => (
                  <button
                    key={cmd.name}
                    onClick={() => execute(cmd.name)}
                    title={cmd.usage || cmd.description}
                    className={cn(
                      'flex flex-col gap-0.5 px-3 py-2.5 rounded-md text-left transition-colors',
                      'bg-muted/40 hover:bg-muted/70 border border-transparent hover:border-border'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono text-foreground">
                        {cmd.name}
                      </span>
                      {cmd.aliases && cmd.aliases.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ({cmd.aliases.slice(0, 2).join(', ')})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-snug">
                      {cmd.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Keyboard shortcuts */}
        <div className="pt-4 border-t">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Keyboard Shortcuts
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { keys: ['Ctrl', 'K'], label: 'Toggle Terminal' },
              { keys: ['↑', '↓'], label: 'Navigate History' },
              { keys: ['Tab'], label: 'Autocomplete' },
              { keys: ['Esc'], label: 'Close Terminal' },
            ].map((shortcut) => (
              <div key={shortcut.label} className="flex items-center gap-2 text-xs">
                <span className="flex gap-0.5">
                  {shortcut.keys.map((k) => (
                    <kbd
                      key={k}
                      className="rounded bg-muted border px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className="text-muted-foreground">{shortcut.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
        Click a command to execute it
      </div>
    </div>
  );
}
