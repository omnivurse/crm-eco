'use client';

/**
 * EnrollContactsDialog — the "Enroll Contacts" flow the help docs describe.
 *
 * The enrollment API has been complete for a while, but nothing in the UI ever
 * called it, so an activated sequence had no way to take anyone in. Search is
 * the existing /api/crm/records endpoint rather than a bespoke one.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, UserPlus, Check, AlertCircle } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

interface RecordHit {
  id: string;
  title?: string | null;
  email?: string | null;
  data?: Record<string, unknown> | null;
}

interface EnrollContactsDialogProps {
  open: boolean;
  onClose: () => void;
  sequenceId: string;
  /** Enrollment is refused server-side unless the sequence is active. */
  sequenceStatus: string;
  onEnrolled: () => void;
}

/** Modules that carry an email address worth sequencing. */
const MODULES = [
  { key: 'Contacts', label: 'Contacts' },
  { key: 'Leads', label: 'Leads' },
];

function recordEmail(record: RecordHit): string | null {
  const fromColumn = record.email;
  if (typeof fromColumn === 'string' && fromColumn) return fromColumn;
  const fromData = (record.data as { email?: unknown } | null)?.email;
  return typeof fromData === 'string' && fromData ? fromData : null;
}

function recordLabel(record: RecordHit): string {
  const data = record.data as { first_name?: string; last_name?: string; name?: string } | null;
  const full = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
  return record.title || full || data?.name || recordEmail(record) || 'Untitled';
}

export function EnrollContactsDialog({
  open,
  onClose,
  sequenceId,
  sequenceStatus,
  onEnrolled,
}: EnrollContactsDialogProps) {
  const [moduleKey, setModuleKey] = useState('Contacts');
  const [results, setResults] = useState<RecordHit[]>([]);
  const [selected, setSelected] = useState<Map<string, RecordHit>>(new Map());
  const [searching, setSearching] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const { query, setQuery, debouncedQuery } = useDebouncedSearch({ delay: 250 });

  const runSearch = useCallback(async () => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/crm/records?search=${encodeURIComponent(debouncedQuery.trim())}` +
          `&module_key=${encodeURIComponent(moduleKey)}&page_size=20`,
      );
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();
      setResults((json.records || []) as RecordHit[]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [debouncedQuery, moduleKey]);

  useEffect(() => {
    if (!open) return;
    runSearch();
  }, [open, runSearch]);

  // Selections are per-module: a record id only means something alongside its
  // module_key, and the API takes one module per call.
  useEffect(() => {
    setSelected(new Map());
  }, [moduleKey]);

  function toggle(record: RecordHit) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(record.id)) next.delete(record.id);
      else next.set(record.id, record);
      return next;
    });
  }

  function handleClose() {
    setQuery('');
    setResults([]);
    setSelected(new Map());
    onClose();
  }

  async function handleEnroll() {
    if (selected.size === 0) return;
    setEnrolling(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_ids: Array.from(selected.keys()),
          module_key: moduleKey,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json.error || 'Failed to enroll');

      const enrolled = json.enrolled ?? 0;
      const failures = (json.errors ?? []) as Array<{ error: string }>;

      if (enrolled === 0) {
        // Every candidate was rejected — usually already enrolled or no email.
        const why = failures[0]?.error || 'No contacts were eligible';
        toast.error(toastCopy.failed('enroll those contacts', undefined, why));
      } else if (failures.length > 0) {
        const summary = toastCopy.partial(
          'Enrolled',
          { changed: enrolled, failed: failures.length },
          { unit: 'contact' },
        );
        toast[summary.tone](summary.title, { description: summary.description });
      } else {
        toast.success(toastCopy.counted('contact', enrolled, 'Enrolled'));
      }

      if (enrolled > 0) {
        onEnrolled();
        handleClose();
      }
    } catch (error) {
      toast.error(
        toastCopy.failed(
          'enroll those contacts',
          undefined,
          error instanceof Error ? error.message : undefined,
        ),
      );
    } finally {
      setEnrolling(false);
    }
  }

  const inactive = sequenceStatus !== 'active';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll contacts</DialogTitle>
          <DialogDescription>
            Each contact starts at step one and moves through the sequence on its own schedule.
          </DialogDescription>
        </DialogHeader>

        {inactive ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This sequence is <strong>{sequenceStatus}</strong>. Activate it before enrolling
              anyone — enrollments are refused while it is not active.
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={moduleKey} onValueChange={setModuleKey}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  autoFocus
                  placeholder="Search by name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  {query.trim().length < 2
                    ? 'Type at least two characters to search.'
                    : `No ${moduleKey.toLowerCase()} match that search.`}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.map((record) => {
                    const email = recordEmail(record);
                    const isSelected = selected.has(record.id);
                    return (
                      <li key={record.id}>
                        <button
                          type="button"
                          disabled={!email}
                          onClick={() => toggle(record)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            email
                              ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              : 'cursor-not-allowed opacity-50',
                            isSelected && 'bg-teal-50 dark:bg-teal-500/10',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              isSelected
                                ? 'border-teal-500 bg-teal-500 text-white'
                                : 'border-slate-300 dark:border-slate-600',
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                              {recordLabel(record)}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {email || 'No email address — cannot be enrolled'}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <span className="self-center text-sm text-slate-500">
            {selected.size > 0 ? `${selected.size} selected` : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={enrolling}>
              Cancel
            </Button>
            <Button onClick={handleEnroll} disabled={inactive || enrolling || selected.size === 0}>
              {enrolling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {enrolling ? 'Enrolling…' : 'Enroll'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
