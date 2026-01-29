'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Search,
  Check,
  X,
  Loader2,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import { toast } from 'sonner';

interface CrmRecord {
  id: string;
  title: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
  data: Record<string, unknown>;
}

interface CrmModule {
  id: string;
  key: string;
  name: string;
  name_plural: string | null;
}

export default function MassDeletePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const moduleKey = params.moduleKey as string;

  // Pre-selected record IDs from URL
  const preselectedIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const [module, setModule] = useState<CrmModule | null>(null);
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preselectedIds));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 50;

  // Fetch module and records
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch module info
      const moduleRes = await fetch(`/api/crm/modules`);
      if (!moduleRes.ok) throw new Error('Failed to fetch module');
      const moduleData = await moduleRes.json();

      // API returns array directly
      const modules = Array.isArray(moduleData) ? moduleData : moduleData.modules || [];
      if (modules.length === 0) {
        throw new Error('No modules found');
      }
      const foundModule = modules.find((m: CrmModule) => m.key === moduleKey);
      if (!foundModule) {
        throw new Error('Module not found');
      }
      setModule(foundModule);

      // Fetch records
      const recordsRes = await fetch(
        `/api/crm/records?module_key=${moduleKey}&page=${page}&page_size=${pageSize}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
      );
      if (!recordsRes.ok) throw new Error('Failed to fetch records');
      const recordsData = await recordsRes.json();

      setRecords(recordsData.records || []);
      setTotalRecords(recordsData.total || 0);
      setTotalPages(Math.ceil((recordsData.total || 0) / pageSize));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, page, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle single record selection
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select/deselect all visible records
  const toggleSelectAll = () => {
    if (records.every(r => selectedIds.has(r.id))) {
      // Deselect all visible
      const newSelected = new Set(selectedIds);
      records.forEach(r => newSelected.delete(r.id));
      setSelectedIds(newSelected);
    } else {
      // Select all visible
      const newSelected = new Set(selectedIds);
      records.forEach(r => newSelected.add(r.id));
      setSelectedIds(newSelected);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      setDeleting(true);
      setError(null);

      const response = await fetch('/api/crm/records/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete records');
      }

      const data = await response.json();
      const successMessage = `Successfully deleted ${data.deleted_count} record${data.deleted_count !== 1 ? 's' : ''}`;
      setSuccess(successMessage);
      toast.success(successMessage);
      setSelectedIds(new Set());
      setShowConfirm(false);

      // Refresh the list
      await fetchData();

      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/crm/modules/${moduleKey}`);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete records';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const getRecordTitle = (record: CrmRecord) => {
    return record.title ||
      record.data?.name as string ||
      record.data?.full_name as string ||
      record.email ||
      'Untitled';
  };

  if (loading && !module) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/crm/modules/${moduleKey}`}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-500" />
            Mass Delete {module?.name_plural || module?.name || 'Records'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Select records to permanently delete. This action cannot be undone.
          </p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-red-800 dark:text-red-300">Warning: Permanent Deletion</p>
          <p className="text-red-700 dark:text-red-400 mt-1">
            Deleted records cannot be recovered. All associated notes, tasks, and attachments will also be deleted.
          </p>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">{success}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
          <X className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Search and selection info */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {selectedIds.size} of {totalRecords} selected
          </span>
          <Button
            variant="destructive"
            onClick={() => setShowConfirm(true)}
            disabled={selectedIds.size === 0 || deleting}
            className="gap-2"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Records table */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="w-12 px-4 py-3 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    {records.length > 0 && records.every(r => selectedIds.has(r.id)) ? (
                      <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => toggleSelect(record.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedIds.has(record.id)
                        ? 'bg-red-50 dark:bg-red-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {selectedIds.has(record.id) ? (
                        <CheckSquare className="w-5 h-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {getRecordTitle(record)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {record.email || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {record.status ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {record.status}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-sm" suppressHydrationWarning>
                      {new Date(record.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <Link
          href={`/crm/modules/${moduleKey}`}
          className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg transition-colors"
        >
          Cancel
        </Link>
        <Button
          variant="destructive"
          onClick={() => setShowConfirm(true)}
          disabled={selectedIds.size === 0 || deleting}
          className="gap-2"
        >
          {deleting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Delete {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Confirm Permanent Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete <strong>{selectedIds.size}</strong> record{selectedIds.size !== 1 ? 's' : ''}.
              This action cannot be undone. All associated data including notes, tasks, and attachments will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
