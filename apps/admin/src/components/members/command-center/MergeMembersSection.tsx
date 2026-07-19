'use client';

import { CircleNotch, GitMerge, MagnifyingGlass, Warning } from '@phosphor-icons/react';
/**
 * MergeMembersSection — staff merge of a duplicate member INTO the current
 * member (the keeper). MagnifyingGlass → pick the duplicate → confirm. The actual merge
 * runs server-side via the atomic merge_members_tx RPC (adminMergeMembers):
 * repoints all child tables, terminates the duplicate's active plan/billing
 * (keeper authoritative, no double-bill), soft-merges, and recalcs the keeper.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';
import {
  searchMembersForMerge,
  adminMergeMembers,
  type MergeCandidate,
} from '@/app/(dashboard)/members/[id]/command-actions';

interface MergeMembersSectionProps {
  organizationId: string;
  profileId: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    member_number: string | null;
  };
}

function label(c: MergeCandidate) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email || c.member_number || c.id.slice(0, 8);
}

export function MergeMembersSection({ member }: MergeMembersSectionProps) {
  const router = useRouter();
  const keeperName =
    [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || member.email;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MergeCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchMembersForMerge(q, member.id);
      setResults(res.success ? res.results : []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, member.id]);

  function reset() {
    setOpen(false);
    setQuery('');
    setResults([]);
    setSelected(null);
  }

  async function confirmMerge() {
    if (!selected) return;
    setMerging(true);
    try {
      const res = await adminMergeMembers({ keeper_id: member.id, secondary_id: selected.id });
      if (!res.success) {
        toast.error(res.error ?? 'GitMerge failed');
        return;
      }
      toast.success(`Merged ${label(selected)} into ${keeperName}`);
      if (res.billingError) {
        toast.warning(`Merged, but billing may be briefly out of date: ${res.billingError}`);
      }
      reset();
      router.refresh();
    } finally {
      setMerging(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <GitMerge weight="light" className="h-4 w-4" />
        GitMerge duplicate members
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>GitMerge a duplicate into {keeperName}</DialogTitle>
            <DialogDescription>
              Find the duplicate member to absorb. Their dependents, documents, invoices and history
              move to <strong>{keeperName}</strong>; their active plan &amp; billing are terminated
              (this member&apos;s plan is kept). This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {!selected ? (
            <div className="space-y-3 py-2">
              <div className="relative">
                <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  autoFocus
                  className="pl-9"
                  placeholder="MagnifyingGlass by name, email, or member #"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {searching ? (
                  <p className="py-4 text-center text-sm text-slate-400">
                    <CircleNotch weight="light" className="mr-2 inline h-4 w-4 animate-spin" />
                    Searching…
                  </p>
                ) : query.trim().length < 2 ? (
                  <p className="py-4 text-center text-sm text-slate-400">Type at least 2 characters.</p>
                ) : results.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">No matching members.</p>
                ) : (
                  results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-slate-50"
                    >
                      <span>
                        <span className="font-medium">{label(c)}</span>
                        {c.email && <span className="text-slate-500"> · {c.email}</span>}
                      </span>
                      {c.member_number && (
                        <span className="text-xs text-slate-400">#{c.member_number}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <Warning weight="light" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-900">
                  GitMerge <strong>{label(selected)}</strong>
                  {selected.member_number ? ` (#${selected.member_number})` : ''} into{' '}
                  <strong>{keeperName}</strong>? Their records move to {keeperName} and their active
                  plan/billing is terminated. This cannot be undone.
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {selected ? (
              <>
                <Button variant="outline" onClick={() => setSelected(null)} disabled={merging}>
                  Back
                </Button>
                <Button variant="destructive" onClick={confirmMerge} disabled={merging}>
                  {merging && <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" />}
                  GitMerge into {keeperName}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
