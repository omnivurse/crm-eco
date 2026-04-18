'use client';

/**
 * LayoutV2Toggle
 *
 * User-facing opt-in switch for the new Zoho-style 3-column record layout.
 * Persists to `profiles.ui_preferences.crm_layout_v2` via
 * `PATCH /api/crm/ui-preferences`. The user can flip this back at any time
 * to revert to the classic shell — no admin involvement needed.
 */

import { useEffect, useState, useCallback } from 'react';
import { Loader2, LayoutDashboard, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';

export interface LayoutV2ToggleProps {
  className?: string;
  /** Render as a compact inline row instead of a card. */
  compact?: boolean;
}

export function LayoutV2Toggle({ className, compact = false }: LayoutV2ToggleProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/crm/ui-preferences', { cache: 'no-store' });
        if (!res.ok) {
          setEnabled(false);
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        setEnabled(body?.preferences?.crm_layout_v2 === true);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    async (next: boolean) => {
      setSaving(true);
      const previous = enabled;
      setEnabled(next);
      try {
        const res = await fetch('/api/crm/ui-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crm_layout_v2: next }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Failed to save preference');
        }
        toast.success(
          next ? 'New record layout enabled' : 'Reverted to classic layout',
          {
            description: next
              ? 'Open any record to try the new 3-column view.'
              : 'You can opt back in any time from your profile.',
          },
        );
        // Next navigation picks up the new preference automatically because the
        // server reads it on every request.
      } catch (err) {
        setEnabled(previous);
        toast.error(err instanceof Error ? err.message : 'Failed to save preference');
      } finally {
        setSaving(false);
      }
    },
    [enabled],
  );

  const isLoading = enabled === null;

  if (compact) {
    return (
      <label
        className={cn(
          'flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer',
          className,
        )}
      >
        <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-teal-500" />
          New record layout
        </span>
        <ToggleSwitch
          checked={!!enabled}
          disabled={isLoading || saving}
          onChange={handleToggle}
        />
      </label>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-teal-50/40 to-emerald-50/20 dark:from-teal-500/5 dark:to-emerald-500/5 p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
          <LayoutDashboard className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              New record layout
            </h4>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
              <Sparkles className="w-2.5 h-2.5" />
              Preview
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Enable the Zoho-style 3-column view with a left related-list rail and a right insights panel.
            You can switch back to the classic layout any time.
          </p>
        </div>
        <div className="flex items-center shrink-0 pl-2">
          {isLoading || saving ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <ToggleSwitch
              checked={!!enabled}
              disabled={isLoading || saving}
              onChange={handleToggle}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900',
        checked ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
