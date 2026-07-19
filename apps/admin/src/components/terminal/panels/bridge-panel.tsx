'use client';

import { Buildings, ChartBar, ClipboardText, Clock, CreditCard, EnvelopeSimple, GearSix, Handshake, Hash, Info, MagnifyingGlass, Package, Rocket, Users } from '@phosphor-icons/react';
import React from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Badge } from '@crm-eco/ui/components/badge';
import { useTerminal } from '../terminal-provider';

const quickActions = [
  { label: 'MagnifyingGlass', icon: MagnifyingGlass, command: 'search' },
  { label: 'Members', icon: Users, command: 'member' },
  { label: 'Agents', icon: Handshake, command: 'agent' },
  { label: 'Products', icon: Package, command: 'product' },
  { label: 'Enrollments', icon: ClipboardText, command: 'enrollment' },
  { label: 'Vendors', icon: Buildings, command: 'vendor' },
  { label: 'Billing', icon: CreditCard, command: 'billing' },
  { label: 'Emails', icon: EnvelopeSimple, command: 'email' },
  { label: 'Reports', icon: ChartBar, command: 'reports' },
  { label: 'GearSix', icon: GearSix, command: 'settings' },
  { label: 'Counts', icon: Hash, command: 'count' },
  { label: 'Activity', icon: Clock, command: 'recent' },
];

const tips = [
  { text: 'search [query]', desc: 'to search everything' },
  { text: 'member [name]', desc: 'to find a member' },
  { text: 'count', desc: 'to see record totals' },
  { text: 'whoami', desc: 'to see your profile' },
];

export function BridgePanel() {
  const { execute } = useTerminal();

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <Rocket weight="light" className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold tracking-wide font-heading flex-1">
          Command Bridge
        </span>
        <Badge variant="success" className="text-[10px] px-2 py-0">
          Online
        </Badge>
      </div>

      <div className="p-4 space-y-5">
        {/* Quick commands / tips */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Quick Commands
          </h4>
          <div className="space-y-1.5">
            {tips.map((tip) => (
              <div
                key={tip.text}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-muted/40 border-l-2 border-primary/40"
              >
                <Info weight="light" className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Type{' '}
                  <code className="bg-muted rounded px-1 py-0.5 font-mono text-foreground text-[11px]">
                    {tip.text}
                  </code>{' '}
                  {tip.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions grid */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Quick Actions
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.command}
                  onClick={() => execute(action.command)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium',
                    'border bg-background hover:bg-muted/50 transition-colors',
                    'text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
        {new Date().toISOString().split('T')[0]}
      </div>
    </div>
  );
}
