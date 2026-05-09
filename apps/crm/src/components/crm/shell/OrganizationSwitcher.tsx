'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { ChevronDown, Check, Building2, Loader2 } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { switchTenant } from '@/app/actions/switch-tenant';

export type SwitcherTenant = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  subdomain: string | null;
  role: string;
  isDefault: boolean;
  plan: string;
};

interface OrganizationSwitcherProps {
  tenants: SwitcherTenant[];
  activeTenantId: string;
  compact?: boolean;
}

/**
 * CRM-side OrganizationSwitcher. Mirrors the admin app's switcher with the
 * CRM brand palette (cyan→emerald gradient) and routing into the CRM
 * server action.
 */
export function OrganizationSwitcher({
  tenants,
  activeTenantId,
  compact = false,
}: OrganizationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (!tenants || tenants.length < 2) return null;

  const active = tenants.find((t) => t.organizationId === activeTenantId) ?? tenants[0];

  const handleSelect = (orgId: string) => {
    if (orgId === activeTenantId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchTenant(orgId);
      setOpen(false);
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'group inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted',
          compact ? 'h-8' : 'h-9',
        )}
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-emerald-600 text-[10px] font-semibold text-white"
          aria-hidden="true"
        >
          {active.organizationName.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="truncate text-[13px] font-medium text-foreground">
            {active.organizationName}
          </span>
          <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {active.role.replace('_', ' ')} · {active.plan}
          </span>
        </span>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Organizations"
          className="absolute right-0 z-[60] mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-border bg-popover shadow-2xl ring-1 ring-black/5"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Switch organization
            </p>
          </div>

          <ul className="max-h-80 overflow-y-auto py-1">
            {tenants.map((t) => {
              const selected = t.organizationId === active.organizationId;
              return (
                <li key={t.organizationId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleSelect(t.organizationId)}
                    disabled={pending}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'bg-primary/10 text-foreground'
                        : 'hover:bg-muted',
                      pending && 'cursor-wait opacity-60',
                    )}
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-emerald-600 text-xs font-semibold text-white"
                      aria-hidden="true"
                    >
                      {t.organizationName.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {t.organizationName}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {t.organizationSlug} · {t.role.replace('_', ' ')}
                      </span>
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>{tenants.length} organizations</span>
            <span className="font-mono uppercase tracking-wider">DH/TENANT</span>
          </div>
        </div>
      )}
    </div>
  );
}
