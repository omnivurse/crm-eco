'use client';

/**
 * Dropdown lists — client half. Curates one field's pick list against
 * /api/crm/field-options (add · rename · hide/bring back · reorder — never
 * delete: records may already hold a value) and shows, per option, how many
 * records currently use it via /api/crm/records/field-values. Stored spellings
 * that are NOT on the menu yet get their own section with one-click "Add to
 * menu" — that drift is exactly what this screen exists to fix.
 *
 * Persona: the business owner. Plain words only — no field ids, no JSON.
 * Keyboard: every control is a real button/input; reordering is Move up /
 * Move down, never drag-only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import type { FieldOption } from '@/lib/crm/field-options';

// ============================================================================
// Types (wire shapes of the two endpoints this screen calls)
// ============================================================================

export interface ModuleChoice {
  id: string;
  key: string;
  name: string;
}

export interface FieldChoice {
  id: string;
  key: string;
  label: string;
  type: string;
}

interface DropdownListsClientProps {
  canManage: boolean;
  modules: ModuleChoice[];
  selectedModuleKey: string | null;
  /** Curatable fields of the selected module (server-filtered + ordered). */
  fields: FieldChoice[];
  selectedField: FieldChoice | null;
  /** The deep-link params didn't match a module/field — say so gently. */
  badParams: boolean;
}

type Phase = 'loading' | 'error' | 'ready';

const norm = (s: string) => s.trim().toLowerCase();

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const STALE_OPTION_REASON = "it isn't on this list any more, reload the page to see the latest";

/** Owner-safe reason from a failed write. Never surface a raw option UUID. */
export function ownerSafeReason(message: string): string {
  const msg = message.trim();
  if (/option not found/i.test(msg) || UUID_RE.test(msg)) return STALE_OPTION_REASON;
  return msg;
}

/** Pull the API's error message out of a failed response, if it sent one. */
async function responseReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return ownerSafeReason(body.error);
  } catch {
    // fall through
  }
  return `HTTP ${res.status}`;
}

function sortByOrder(opts: FieldOption[]): FieldOption[] {
  return [...opts].sort((a, b) => a.display_order - b.display_order);
}

// ============================================================================
// Component
// ============================================================================

export function DropdownListsClient({
  canManage,
  modules,
  selectedModuleKey,
  fields,
  selectedField,
  badParams,
}: DropdownListsClientProps) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [options, setOptions] = useState<FieldOption[]>([]);
  /** stored value → record count; null = counts unavailable (non-blocking). */
  const [usage, setUsage] = useState<Array<{ value: string; count: number }> | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  /** id of the option a hide/show/rename request is in flight for. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const loadAll = useCallback(async () => {
    if (!selectedField || !selectedModuleKey) return;
    setPhase('loading');
    try {
      const res = await fetch(
        `/api/crm/field-options?field_id=${encodeURIComponent(selectedField.id)}&active_only=false`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { options?: FieldOption[] };
      setOptions(sortByOrder(body.options ?? []));
      setPhase('ready');
    } catch (err) {
      console.error('[DropdownLists] load failed:', err);
      setPhase('error');
      return;
    }
    // Usage counts are best-effort — the list must work without them.
    try {
      const res = await fetch(
        `/api/crm/records/field-values?module_key=${encodeURIComponent(selectedModuleKey)}&key=${encodeURIComponent(selectedField.key)}&limit=100`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { values?: Array<{ value: string; count: number }> };
      setUsage(body.values ?? []);
    } catch {
      setUsage(null);
    }
  }, [selectedField, selectedModuleKey]);

  useEffect(() => {
    if (canManage && selectedField) void loadAll();
  }, [canManage, selectedField, loadAll]);

  const usageFor = useCallback(
    (value: string): number | null => {
      if (usage === null) return null;
      return usage
        .filter((v) => norm(v.value) === norm(value))
        .reduce((sum, v) => sum + v.count, 0);
    },
    [usage]
  );

  /** Stored spellings that are not on the menu (in any spelling) yet. */
  const unlisted = useMemo(() => {
    if (usage === null) return [];
    const onMenu = new Set(options.map((o) => norm(o.value)));
    return usage.filter((v) => !onMenu.has(norm(v.value)));
  }, [usage, options]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const addOption = useCallback(
    async (label: string) => {
      if (!selectedField) return;
      const trimmed = label.trim();
      if (!trimmed) return;
      setAdding(true);
      try {
        const res = await fetch('/api/crm/field-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field_id: selectedField.id,
            value: trimmed,
            label: trimmed,
            display_order: options.length,
          }),
        });
        if (res.status === 409) {
          toast.error(toastCopy.failed('add the option', "it's already on the menu"));
          return;
        }
        if (!res.ok) throw new Error(await responseReason(res));
        const body = (await res.json()) as { option: FieldOption };
        setOptions((prev) => sortByOrder([...prev, body.option]));
        setNewLabel('');
        toast.success(toastCopy.added('Option'));
      } catch (err) {
        toast.error(toastCopy.failed('add the option', err, 'Try again'));
      } finally {
        setAdding(false);
      }
    },
    [selectedField, options.length]
  );

  const patchOption = useCallback(
    async (
      option: FieldOption,
      patch: { label?: string; is_active?: boolean },
      action: string
    ): Promise<boolean> => {
      if (!selectedField) return false;
      setBusyId(option.id);
      try {
        const res = await fetch('/api/crm/field-options', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field_id: selectedField.id, id: option.id, ...patch }),
        });
        if (!res.ok) throw new Error(await responseReason(res));
        const body = (await res.json()) as { option: FieldOption };
        setOptions((prev) => sortByOrder(prev.map((o) => (o.id === option.id ? body.option : o))));
        toast.success(toastCopy.updated('Option'));
        return true;
      } catch (err) {
        toast.error(toastCopy.failed(action, err, 'Try again'));
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [selectedField]
  );

  const moveOption = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!selectedField) return;
      const target = index + direction;
      if (target < 0 || target >= options.length) return;
      const next = [...options];
      [next[index], next[target]] = [next[target], next[index]];
      const renumbered = next.map((o, i) => ({ ...o, display_order: i }));
      const previous = options;
      setOptions(renumbered);
      setReordering(true);
      try {
        const res = await fetch('/api/crm/field-options', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field_id: selectedField.id,
            updates: renumbered.map((o) => ({ id: o.id, display_order: o.display_order })),
          }),
        });
        if (!res.ok) throw new Error(await responseReason(res));
        const body = (await res.json()) as { options?: FieldOption[] };
        if (Array.isArray(body.options)) setOptions(sortByOrder(body.options));
        toast.success(toastCopy.saved('Order'));
      } catch (err) {
        setOptions(previous);
        toast.error(toastCopy.failed('reorder the list', err, 'Try again'));
      } finally {
        setReordering(false);
      }
    },
    [selectedField, options]
  );

  // --------------------------------------------------------------------------
  // Permission view — an agent/viewer who lands here gets a way out, not a wall
  // --------------------------------------------------------------------------

  if (!canManage) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeading title="Dropdown lists" subtitle="Choose what people can pick from menus across the CRM." />
        <div
          role="status"
          className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              This page is for admins and managers
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Editing dropdown lists changes what everyone in your organization is offered, so it&apos;s
            limited to admins and managers. If a list needs changing, ask an admin.
          </p>
          <Button asChild variant="outline">
            <Link href="/crm/settings">
              <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              Back to Settings
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Main view
  // --------------------------------------------------------------------------

  const moduleName = modules.find((m) => m.key === selectedModuleKey)?.name ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/crm/settings"
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          aria-label="Back to Settings"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <PageHeading
          title={selectedField ? selectedField.label : 'Dropdown lists'}
          subtitle={
            selectedField
              ? `The choices offered when someone fills in ${selectedField.label}${moduleName ? ` on ${moduleName}` : ''}. Changing this list never changes records that are already saved.`
              : 'Choose what people can pick from menus across the CRM.'
          }
        />
      </div>

      {badParams && (
        <p
          role="status"
          className="text-sm rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-4 py-3"
        >
          That link didn&apos;t match a list we know — pick the one you want below.
        </p>
      )}

      {/* Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="dl-module"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Where it&apos;s used
          </label>
          <select
            id="dl-module"
            value={selectedModuleKey ?? ''}
            onChange={(e) => {
              const key = e.target.value;
              router.push(key ? `/crm/settings/field-options?module=${encodeURIComponent(key)}` : '/crm/settings/field-options');
            }}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <option value="">Choose…</option>
            {modules.map((m) => (
              <option key={m.id} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="dl-field"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Which list
          </label>
          <select
            id="dl-field"
            value={selectedField?.key ?? ''}
            disabled={!selectedModuleKey}
            onChange={(e) => {
              const key = e.target.value;
              if (!selectedModuleKey) return;
              router.push(
                key
                  ? `/crm/settings/field-options?module=${encodeURIComponent(selectedModuleKey)}&field=${encodeURIComponent(key)}`
                  : `/crm/settings/field-options?module=${encodeURIComponent(selectedModuleKey)}`
              );
            }}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <option value="">Choose…</option>
            {fields.map((f) => (
              <option key={f.id} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedField ? (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
          <ListChecks className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-3" aria-hidden="true" />
          <p className="text-slate-500 dark:text-slate-400">
            Pick where the list is used, then which list, to see and change its choices.
          </p>
        </div>
      ) : phase === 'loading' ? (
        <div className="flex items-center justify-center py-12" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" aria-hidden="true" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Loading the list…</span>
        </div>
      ) : phase === 'error' ? (
        <div
          role="alert"
          className="glass-card border border-red-200 dark:border-red-900 rounded-xl p-6 space-y-3"
        >
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
            <p className="font-medium">Couldn&apos;t load this list.</p>
          </div>
          <Button variant="outline" onClick={() => void loadAll()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* Add */}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addOption(newLabel);
            }}
          >
            <div className="flex-1 min-w-[220px]">
              <label
                htmlFor="dl-new-option"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                New option
              </label>
              <Input
                id="dl-new-option"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Health Sharing"
                maxLength={255}
                disabled={adding}
              />
            </div>
            <Button type="submit" disabled={adding || !newLabel.trim()}>
              {adding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              )}
              Add
            </Button>
          </form>

          {/* The menu */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">On the menu</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Options are hidden, never deleted — records may already use them.
              </p>
            </div>
            {options.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nothing on this menu yet. Add the first option above
                {unlisted.length > 0 ? ', or pull one in from your records below' : ''}.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {options.map((option, index) => {
                  const count = usageFor(option.value);
                  const isBusy = busyId === option.id;
                  return (
                    <li
                      key={option.id}
                      className={`flex flex-wrap items-center gap-2 px-4 py-3 ${option.is_active ? '' : 'opacity-60'}`}
                    >
                      <div className="flex flex-col gap-0.5" aria-hidden={reordering}>
                        <button
                          type="button"
                          onClick={() => void moveOption(index, -1)}
                          disabled={index === 0 || reordering || isBusy}
                          aria-label={`Move ${option.label} up`}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <ChevronUp className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void moveOption(index, 1)}
                          disabled={index === options.length - 1 || reordering || isBusy}
                          aria-label={`Move ${option.label} down`}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>

                      {editingId === option.id ? (
                        <form
                          className="flex flex-1 min-w-[200px] items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const label = editLabel.trim();
                            if (!label) return;
                            void patchOption(option, { label }, 'rename the option').then((ok) => {
                              if (ok) setEditingId(null);
                            });
                          }}
                        >
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            maxLength={255}
                            autoFocus
                            aria-label={`New name for ${option.label}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <Button type="submit" size="sm" disabled={isBusy || !editLabel.trim()}>
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Save'}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <div className="flex-1 min-w-[200px]">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {option.label}
                          </span>
                          {!option.is_active && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              Hidden
                            </span>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {count === null
                              ? ' '
                              : count === 0
                                ? 'Not used on any record yet'
                                : `${count.toLocaleString()} record${count === 1 ? '' : 's'} already use this`}
                          </p>
                        </div>
                      )}

                      {editingId !== option.id && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(option.id);
                              setEditLabel(option.label);
                            }}
                            disabled={isBusy || reordering}
                            aria-label={`Rename ${option.label}`}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void patchOption(
                                option,
                                { is_active: !option.is_active },
                                option.is_active ? 'hide the option' : 'bring the option back'
                              )
                            }
                            disabled={isBusy || reordering}
                            aria-label={option.is_active ? `Hide ${option.label}` : `Bring back ${option.label}`}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : option.is_active ? (
                              <EyeOff className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Stored values that are not on the menu */}
          {unlisted.length > 0 && (
            <div className="glass-card border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  In your records, but not on the menu
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  These spellings are already saved on records. Add the ones people should be able to
                  pick — the rest stay on their records untouched.
                </p>
              </div>
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {unlisted.map((v) => (
                  <li key={v.value} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-[200px]">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{v.value}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {v.count.toLocaleString()} record{v.count === 1 ? '' : 's'} already use this
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={adding}
                      onClick={() => void addOption(v.value)}
                      aria-label={`Add ${v.value} to the menu`}
                    >
                      <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                      Add to menu
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{subtitle}</p>
    </div>
  );
}
