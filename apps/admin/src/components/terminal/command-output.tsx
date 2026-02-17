'use client';

import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@crm-eco/ui/components/table';
import { ScrollArea } from '@crm-eco/ui/components/scroll-area';
import { useTerminal } from './terminal-provider';
import type { CommandResult, TableData } from './types';

import { BridgePanel } from './panels/bridge-panel';
import { StatusPanel } from './panels/status-panel';
import { HelpPanel } from './panels/help-panel';

const outputStyles: Record<string, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-destructive',
  info: 'text-foreground',
  warning: 'text-amber-600 dark:text-amber-400',
  panel: 'text-primary',
  table: 'text-foreground',
};

const outputIcons: Record<string, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
};

function OutputLine({ result }: { result: CommandResult }) {
  if (result.type === 'table' && result.data) {
    const tableData = result.data as TableData;
    return (
      <div className="py-1">
        {result.message && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
            {result.message}
          </p>
        )}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {tableData.headers.map((header, i) => (
                  <TableHead key={i} className="text-xs uppercase tracking-wider font-semibold h-9 px-3">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex} className="py-2 px-3 text-xs font-mono">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  const icon = outputIcons[result.type];

  return (
    <div className={cn('flex items-start gap-2 py-0.5 text-sm font-mono', outputStyles[result.type])}>
      {icon && <span className="shrink-0 w-4 text-center">{icon}</span>}
      <span className="whitespace-pre-wrap break-words min-w-0">{result.message}</span>
    </div>
  );
}

function PanelRenderer() {
  const { currentPanel } = useTerminal();
  switch (currentPanel) {
    case 'bridge':
      return <BridgePanel />;
    case 'status':
      return <StatusPanel />;
    case 'help':
      return <HelpPanel />;
    default:
      return null;
  }
}

export function CommandOutput() {
  const { output, currentPanel } = useTerminal();
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, currentPanel]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div ref={outputRef} className="p-4 space-y-1">
        {/* Welcome screen */}
        {output.length === 0 && !currentPanel && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
              <Terminal className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold font-heading text-foreground mb-1">
              Command Center
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Your admin command line for searching, navigating, and managing the platform.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md mb-6">
              <div className="rounded-lg bg-muted/50 border px-3 py-2.5 text-left">
                <p className="text-xs font-medium text-foreground mb-0.5">Search</p>
                <p className="text-[11px] text-muted-foreground">
                  <code className="bg-muted rounded px-1 py-0.5 font-mono">search [query]</code>
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 border px-3 py-2.5 text-left">
                <p className="text-xs font-medium text-foreground mb-0.5">Quick Actions</p>
                <p className="text-[11px] text-muted-foreground">
                  <code className="bg-muted rounded px-1 py-0.5 font-mono">bridge</code>
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 border px-3 py-2.5 text-left">
                <p className="text-xs font-medium text-foreground mb-0.5">Help</p>
                <p className="text-[11px] text-muted-foreground">
                  <code className="bg-muted rounded px-1 py-0.5 font-mono">help</code>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted border px-1.5 py-0.5 font-mono text-[10px]">Ctrl+K</kbd>
                Toggle
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted border px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
                History
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted border px-1.5 py-0.5 font-mono text-[10px]">Tab</kbd>
                Autocomplete
              </span>
            </div>
          </div>
        )}

        {/* Output history */}
        {output.map((result, index) => (
          <OutputLine key={`${result.timestamp}-${index}`} result={result} />
        ))}

        {/* Active panel */}
        {currentPanel && (
          <div className="mt-3">
            <PanelRenderer />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
