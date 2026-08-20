'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  FileSpreadsheet,
  Users,
  Building2,
  Package,
  DollarSign,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
  Download,
  Loader2,
  ArrowLeft,
  FileText,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import {
  CREATE_IMPORT_BATCH_SIZE,
  isCsvUploadName,
  isExcelUploadName,
  mappingsFromCsvHeaders,
} from '@/lib/imports/csv-create-mappings';
import { MAX_CSV_BYTES, MAX_CSV_ROWS, parseCsv } from '@/lib/imports/csv-update';

interface ImportModule {
  key: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  templateUrl?: string;
}

interface ImportJob {
  id: string;
  /** Derived from `stats.module_key` (no DB column). */
  module_key: string;
  file_name: string;
  /**
   * `completed_with_errors` means the run finished but some rows failed to
   * write — see error_count. Previously such runs reported plain `completed`.
   */
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'cancelled';
  /** 'csv_update' rows came from the governed update path and are undoable. */
  source_type?: string;
  /** True only when per-row before-images were recorded for this job. */
  can_rollback?: boolean;
  rolled_back_at?: string | null;
  total_rows: number;
  processed_rows: number;
  /** Combined inserted_count + updated_count (the DB has no success_count). */
  success_count: number;
  error_count: number;
  created_at: string;
  completed_at?: string;
  error_log?: string[];
}

const IMPORT_MODULES: ImportModule[] = [
  {
    key: 'contacts',
    name: 'Contacts',
    icon: <Users className="w-5 h-5" />,
    description: 'Import contact records with names, emails, phones, and custom fields',
  },
  {
    key: 'leads',
    name: 'Leads',
    icon: <ClipboardList className="w-5 h-5" />,
    description: 'Import lead records for sales pipeline tracking',
  },
  {
    key: 'accounts',
    name: 'Accounts',
    icon: <Building2 className="w-5 h-5" />,
    description: 'Import company/organization records',
  },
  {
    key: 'deals',
    name: 'Deals',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'Import deal/opportunity records with stages and values',
  },
  {
    key: 'products',
    name: 'Products',
    icon: <Package className="w-5 h-5" />,
    description: 'Import product catalog with pricing and SKUs',
  },
];

export default function ImportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <ImportsPageContent />
    </Suspense>
  );
}

function ImportsPageContent() {
  const searchParams = useSearchParams();
  const preselectedModule = searchParams.get('module');
  const { user: authUser, profile: authProfile, loading: authLoading } = useClientAuth();

  const [selectedModule, setSelectedModule] = useState(preselectedModule || '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [undoingJobId, setUndoingJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const canCreateImport = ['crm_admin', 'crm_manager'].includes(
    authProfile?.crm_role || '',
  );

  const loadImportJobs = useCallback(async () => {
    if (!authProfile) return;

    try {
      const { data: jobs } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('org_id', authProfile.organization_id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Adapt live DB rows to the UI shape: derive module_key from stats
      // and success_count from inserted+updated counters.
      const adapted = (jobs ?? []).map((j: Record<string, unknown>) => {
        const stats = (j.stats as { module_key?: string } | null) ?? null;
        return {
          ...j,
          module_key: stats?.module_key ?? '',
          success_count:
            ((j.inserted_count as number | null) ?? 0) +
            ((j.updated_count as number | null) ?? 0),
        } as ImportJob;
      });
      setImportJobs(adapted);
    } catch (error) {
      console.error('Failed to load import jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [authProfile]);

  useEffect(() => {
    if (!authLoading && authProfile) {
      loadImportJobs();
    } else if (!authLoading && !authProfile) {
      setLoading(false);
    }
  }, [authLoading, authProfile, loadImportJobs]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (isExcelUploadName(droppedFile.name)) {
        toast.error(
          'Excel is not imported here. Save as CSV, or use the Import wizard for column mapping.',
        );
        return;
      }
      if (!isCsvUploadName(droppedFile.name) && droppedFile.type !== 'text/csv') {
        toast.error('Please upload a CSV file');
        return;
      }
      setFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0];
    if (!next) return;
    if (isExcelUploadName(next.name)) {
      toast.error(
        'Excel is not imported here. Save as CSV, or use the Import wizard for column mapping.',
      );
      e.target.value = '';
      return;
    }
    if (!isCsvUploadName(next.name) && next.type !== 'text/csv') {
      toast.error('Please upload a CSV file');
      e.target.value = '';
      return;
    }
    setFile(next);
  };

  const handleImport = async () => {
    if (!file || !selectedModule) {
      toast.error('Please select a module and upload a file');
      return;
    }

    if (!authUser || !authProfile) {
      toast.error('Please sign in');
      return;
    }

    if (!canCreateImport) {
      toast.error('Only admins and managers can create records from a CSV');
      return;
    }

    if (isExcelUploadName(file.name) || !isCsvUploadName(file.name)) {
      toast.error('This create path accepts CSV only. Monthly roster updates use Update existing.');
      return;
    }

    if (file.size > MAX_CSV_BYTES) {
      toast.error(`File is too large (max ${Math.round(MAX_CSV_BYTES / (1024 * 1024))} MB)`);
      return;
    }

    setUploading(true);
    setUploadProgress('Reading CSV…');

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.rows.length > MAX_CSV_ROWS) {
        toast.error(`This file has ${parsed.rows.length.toLocaleString()} rows (max ${MAX_CSV_ROWS.toLocaleString()})`);
        return;
      }

      const mappings = mappingsFromCsvHeaders(parsed.headers);
      if (mappings.length === 0) {
        toast.error('No usable column headers in this CSV');
        return;
      }

      const { data: moduleRow, error: moduleErr } = await supabase
        .from('crm_modules')
        .select('id')
        .eq('org_id', authProfile.organization_id)
        .eq('key', selectedModule)
        .maybeSingle();

      if (moduleErr || !moduleRow) {
        toast.error('Selected module is unavailable');
        return;
      }

      const data = parsed.rows.map((row) => row.raw);
      const batches = Math.ceil(data.length / CREATE_IMPORT_BATCH_SIZE);
      let totalSuccess = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (let i = 0; i < batches; i++) {
        const start = i * CREATE_IMPORT_BATCH_SIZE;
        const end = Math.min(start + CREATE_IMPORT_BATCH_SIZE, data.length);
        setUploadProgress(
          batches > 1
            ? `Creating records… batch ${i + 1}/${batches}`
            : 'Creating records…',
        );

        const res = await fetch('/api/crm/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleId: moduleRow.id,
            organizationId: authProfile.organization_id,
            mappings,
            data: data.slice(start, end),
            fileName:
              batches > 1 ? `${file.name} (batch ${i + 1}/${batches})` : file.name,
            skipDuplicates: true,
            onDuplicate: 'skip',
          }),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const reason =
            typeof body.error === 'string' ? body.error : `Batch ${i + 1} failed`;
          if (totalSuccess > 0 || totalSkipped > 0) {
            toast.error(
              `Stopped after batch ${i + 1}: ${reason}. ${totalSuccess} created, ${totalSkipped} skipped so far.`,
            );
          } else {
            toast.error(reason);
          }
          await loadImportJobs();
          return;
        }

        totalSuccess += typeof body.success === 'number' ? body.success : 0;
        totalSkipped += typeof body.skipped === 'number' ? body.skipped : 0;
        totalErrors += typeof body.errors === 'number' ? body.errors : 0;
      }

      const parts = [
        `${totalSuccess} created`,
        totalSkipped > 0 ? `${totalSkipped} skipped (already exist)` : null,
        totalErrors > 0 ? `${totalErrors} errors` : null,
      ].filter(Boolean);
      toast.success(parts.join(' · '));

      setFile(null);
      await loadImportJobs();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to import CSV',
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const undoUpdate = useCallback(
    async (job: ImportJob) => {
      const confirmed = await confirmDialog({
        title: `Undo the update from "${job.file_name}"?`,
        description:
          'Each field this file changed is put back to what it was — but ONLY where the ' +
          'value is still what the file wrote. Anything you or your team edited afterwards ' +
          'is left exactly as it is. Notes are never affected.',
        confirmLabel: 'Undo this update',
        cancelLabel: 'Keep it',
        destructive: true,
      });
      if (!confirmed) return;

      setUndoingJobId(job.id);
      try {
        const res = await fetch(`/api/crm/imports/${job.id}/rollback`, {
          method: 'POST',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(
            typeof body.error === 'string' ? body.error : 'Could not undo this update',
          );
          return;
        }
        const kept = body.skippedChangedKeys ?? 0;
        toast.success(
          `Restored ${body.restoredRecords} record${body.restoredRecords === 1 ? '' : 's'}` +
            (kept > 0
              ? ` — ${kept} field${kept === 1 ? '' : 's'} edited since the import were left alone`
              : ''),
        );
        await loadImportJobs();
      } catch (err) {
        console.error('Undo failed:', err);
        toast.error('Network error — please retry');
      } finally {
        setUndoingJobId(null);
      }
    },
    [loadImportJobs],
  );

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'completed_with_errors':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: ImportJob['status']) => {
    const styles: Partial<Record<ImportJob['status'], string>> & {
      [k: string]: string;
    } = {
      completed: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
      completed_with_errors:
        'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
      processing: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
      failed: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
      pending: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
      cancelled: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300',
    };
    const labels: Partial<Record<ImportJob['status'], string>> & {
      [k: string]: string;
    } = {
      completed: 'Completed',
      completed_with_errors: 'Completed with errors',
      processing: 'Processing',
      failed: 'Failed',
      pending: 'Pending',
      cancelled: 'Undone',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const selectedModuleInfo = IMPORT_MODULES.find((m) => m.key === selectedModule);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/crm" prefetch={false}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl">
            <Upload className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Import Data
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Create new records from a CSV, or update existing ones from a monthly roster
            </p>
          </div>
        </div>
      </div>

      {/* Trickle-update CTA: lives at the top of the Imports page so the
          most common Zoho-migration workflow is one click away. */}
      <Link
        href="/crm/imports/update"
        prefetch={false}
        className="block group rounded-xl border border-amber-200 dark:border-amber-500/30 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 hover:border-amber-300 dark:hover:border-amber-500/50 transition-colors p-5"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-xl flex-shrink-0">
            <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white">
              Update existing records from a Zoho CSV
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Drop an export — we&apos;ll match by Zoho&nbsp;ID, email, or phone and only touch the
              records in the file. Records not in the CSV stay exactly as they are.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Import Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Select Module */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center">
                1
              </span>
              Select Module
            </h3>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose what to import..." />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_MODULES.map((module) => (
                  <SelectItem key={module.key} value={module.key}>
                    <div className="flex items-center gap-2">
                      {module.icon}
                      <span>{module.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModuleInfo && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                {selectedModuleInfo.description}
              </p>
            )}
          </div>

          {/* Step 2: Upload File */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center">
                2
              </span>
              Upload File
            </h3>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              <input
                type="file"
                onChange={handleFileChange}
                accept=".csv,text/csv"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-sm text-slate-500">CSV only (.csv)</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
              Need to review column mapping first?{' '}
              <Link
                href="/crm/import"
                prefetch={false}
                className="text-teal-600 dark:text-teal-400 underline"
              >
                Open the import wizard
              </Link>
            </p>
          </div>

          {!canCreateImport && authProfile ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Creating records from a CSV is limited to admins and managers. You can still
              review import history below.
            </p>
          ) : null}

          {/* Import Button */}
          <Button
            onClick={() => void handleImport()}
            disabled={!file || !selectedModule || uploading || !canCreateImport}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {uploadProgress || 'Creating records…'}
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Create records
              </>
            )}
          </Button>
        </div>

        {/* Quick Links */}
        <div className="space-y-4">
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
              Download Templates
            </h3>
            <div className="space-y-2">
              {IMPORT_MODULES.map((module) => (
                <button
                  key={module.key}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {module.icon}
                  </div>
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                    {module.name} Template
                  </span>
                  <Download className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              Import Tips
            </h3>
            <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                This form creates new records and skips existing email / phone / name+DOB
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                Monthly roster files belong on Update existing — they must not create duplicates
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                First row must be column headers
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                Maximum {MAX_CSV_ROWS.toLocaleString()} rows per import
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Import History */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Import History
          </h3>
          <Button variant="ghost" size="sm" onClick={loadImportJobs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : importJobs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">No imports yet</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Your import history will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {importJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                {getStatusIcon(job.status)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    {job.file_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {IMPORT_MODULES.find((m) => m.key === job.module_key)?.name ||
                      job.module_key}{' '}
                    &bull; {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {getStatusBadge(job.status)}
                  {(job.status === 'completed' || job.status === 'completed_with_errors') && (
                    <p className="text-xs text-slate-500 mt-1">
                      {job.success_count} imported
                      {job.error_count > 0 && `, ${job.error_count} errors`}
                    </p>
                  )}
                  {job.rolled_back_at && (
                    <p className="text-xs text-slate-500 mt-1">
                      Undone {new Date(job.rolled_back_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {job.source_type === 'csv_update' &&
                  job.can_rollback &&
                  !job.rolled_back_at &&
                  // 'processing' is included on purpose: a resumable apply
                  // pauses there, and an abandoned one never leaves. Those
                  // half-applied runs are precisely the ones that need an
                  // undo. The API refuses while a run could still be live.
                  (job.status === 'completed' ||
                    job.status === 'completed_with_errors' ||
                    job.status === 'processing') && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void undoUpdate(job)}
                      disabled={undoingJobId === job.id}
                      title="Put each changed field back, except where it was edited since"
                    >
                      {undoingJobId === job.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Undoing…
                        </>
                      ) : (
                        <>
                          <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                          Undo
                        </>
                      )}
                    </Button>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
