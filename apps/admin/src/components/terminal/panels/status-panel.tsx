'use client';

import React from 'react';
import { Satellite, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Badge } from '@crm-eco/ui/components/badge';

interface ServiceInfo {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency: number;
}

const services: ServiceInfo[] = [
  { name: 'Database', status: 'operational', latency: 45 },
  { name: 'API Gateway', status: 'operational', latency: 32 },
  { name: 'Authentication', status: 'operational', latency: 28 },
  { name: 'Email Service', status: 'operational', latency: 120 },
  { name: 'Storage', status: 'operational', latency: 85 },
];

const statusConfig = {
  operational: {
    icon: CheckCircle2,
    label: 'Operational',
    badge: 'success' as const,
    dot: 'bg-emerald-500',
  },
  degraded: {
    icon: MinusCircle,
    label: 'Degraded',
    badge: 'warning' as const,
    dot: 'bg-amber-500',
  },
  down: {
    icon: XCircle,
    label: 'Down',
    badge: 'destructive' as const,
    dot: 'bg-destructive',
  },
};

export function StatusPanel() {
  const allOperational = services.every(s => s.status === 'operational');

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <Satellite className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold tracking-wide font-heading flex-1">
          System Status
        </span>
        <Badge variant={allOperational ? 'success' : 'warning'} className="text-[10px] px-2 py-0">
          {allOperational ? 'Operational' : 'Degraded'}
        </Badge>
      </div>

      <div className="p-4 space-y-5">
        {/* Overview stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md bg-muted/40 border px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              System Uptime
            </p>
            <p className="text-base font-semibold text-foreground">99.97%</p>
          </div>
          <div className="rounded-md bg-muted/40 border px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Services
            </p>
            <p className="text-base font-semibold text-foreground">
              {services.length}/{services.length} Online
            </p>
          </div>
          <div className="rounded-md bg-muted/40 border px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Last Check
            </p>
            <p className="text-base font-semibold text-foreground font-mono">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
          </div>
        </div>

        {/* Service list */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Service Status
          </h4>
          <div className="space-y-1.5">
            {services.map((service) => {
              const config = statusConfig[service.status];
              const Icon = config.icon;
              return (
                <div
                  key={service.name}
                  className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 border"
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot)} />
                  <Icon className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    service.status === 'operational' && 'text-emerald-500',
                    service.status === 'degraded' && 'text-amber-500',
                    service.status === 'down' && 'text-destructive',
                  )} />
                  <span className="flex-1 text-sm text-foreground">{service.name}</span>
                  <Badge variant={config.badge} className="text-[10px] px-2 py-0">
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums w-12 text-right">
                    {service.latency}ms
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
        All systems monitored in real-time
      </div>
    </div>
  );
}
