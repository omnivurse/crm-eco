'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, Trash2, Loader2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@crm-eco/ui/components/alert-dialog';

interface TrashRecord {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  deleted_at: string | null;
  deleted_origin: string | null;
}

const RETENTION_DAYS = 30;

function purgeDate(deletedAt: string | null): string {
  if (!deletedAt) return '—';
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + RETENTION_DAYS);
  return d.toLocaleDateString();
}

export function TrashClient() {
  const [records, setRecords] = useState<TrashRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/records/trash?page_size=100', {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error('Failed to load Trash');
        setRecords([]);
        return;
      }
      const body = (await res.json()) as { records?: TrashRecord[] };
      setRecords(body.records ?? []);
    } catch {
      toast.error('Failed to load Trash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/crm/records/${id}/restore`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error('Could not restore record');
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('Record restored');
    } finally {
      setBusyId(null);
    }
  }, []);

  const purge = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/crm/records/${id}/purge`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error('Could not permanently delete record');
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('Record permanently deleted');
    } finally {
      setBusyId(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Trash…
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Inbox className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium text-slate-500 dark:text-slate-300">Trash is empty</p>
        <p className="text-sm">Deleted records appear here for {RETENTION_DAYS} days before permanent deletion.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="w-40">Deleted</TableHead>
            <TableHead className="w-40">Auto-deletes</TableHead>
            <TableHead className="w-28 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium text-slate-900 dark:text-white">
                {r.title || 'Untitled'}
              </TableCell>
              <TableCell className="hidden md:table-cell text-slate-500">{r.email || '—'}</TableCell>
              <TableCell className="text-sm text-slate-500" suppressHydrationWarning>
                {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—'}
              </TableCell>
              <TableCell className="text-sm text-slate-500" suppressHydrationWarning>
                {purgeDate(r.deleted_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => void restore(r.id)}
                    title="Restore"
                  >
                    {busyId === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={busyId === r.id} title="Delete permanently">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &ldquo;{r.title || 'Untitled'}&rdquo; and all of its
                          notes, tasks, activities, and attachments. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void purge(r.id)}>
                          Delete permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="p-3 text-right">
        <Link href="/crm" className="text-sm text-teal-600 hover:underline dark:text-teal-400">
          Back to CRM
        </Link>
      </div>
    </div>
  );
}
