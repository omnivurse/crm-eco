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
  /** All organizations the user has active membership in. */
  tenants: SwitcherTenant[];
  /** The currently active tenant id. */
  activeTenantId: string;
  /** Tighten the visual size when rendered inside a dense top nav. */
  compact?: boolean;
}

/**
 * OrganizationSwitcher
 * --------------------------------------------------------------
 * Lets a user swap their active tenant when they belong to more
 * than one organization. Hidden entirely if the user has just one
 * membership — no need to add chrome that does nothing.
 *
 * Switching is a server action that:
 *   1. Re-validates membership in the database.
 *   2. Persists the choice in the `dh_active_org` cookie.
 *   3. Updates `last_active_at` for sort order.
 *   4. Triggers a layout-level revalidation so server components
 *      re-resolve to the new tenant.
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

  // Hide chrome entirely when there is only one tenant
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
          'group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
          compact ? 'h-8' : 'h-9',
        )}
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 text-[10px] font-semibold text-white"
          aria-hidden="true"
        >
          {active.organizationName.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
            {active.organizationName}
          </span>
          <span className="truncate text-[10px] uppercase tracking-wider text-slate-500">
            {active.role.replace('_', ' ')} · {active.plan}
          </span>
        </span>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-slate-400 transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Organizations"
          className="absolute right-0 z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/5"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
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
                        ? 'bg-teal-50 text-teal-900 dark:bg-teal-500/10 dark:text-teal-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                      pending && 'cursor-wait opacity-60',
                    )}
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 text-xs font-semibold text-white"
                      aria-hidden="true"
                    >
                      {t.organizationName.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {t.organizationName}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {t.subdomain
                          ? `${t.subdomain}.admin.doublehelix.com`
                          : t.organizationSlug}{' '}
                        · {t.role.replace('_', ' ')}
                      </span>
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800">
            <span>{tenants.length} organizations</span>
            <span className="font-mono uppercase tracking-wider">DH/TENANT</span>
          </div>
        </div>
      )}
    </div>
  );
}
