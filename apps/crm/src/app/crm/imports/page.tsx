'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';

interface ImportModule {
  key: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  templateUrl?: string;
}

interface ImportJob {
  id: string;
  module_key: string;
  file_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  processed_rows: number;
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
  const searchParams = useSearchParams();
  const preselectedModule = searchParams.get('module');

  const [selectedModule, setSelectedModule] = useState(preselectedModule || '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadImportJobs = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data: jobs } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(20);

      setImportJobs(jobs || []);
    } catch (error) {
      console.error('Failed to load import jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadImportJobs();
  }, [loadImportJobs]);

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
      if (
        droppedFile.type === 'text/csv' ||
        droppedFile.type === 'application/vnd.ms-excel' ||
        droppedFile.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        setFile(droppedFile);
      } else {
        toast.error('Please upload a CSV or Excel file');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedModule) {
      toast.error('Please select a module and upload a file');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        toast.error('Profile not found');
        return;
      }

      // Create import job record
      const { data: job, error: jobError } = await supabase
        .from('crm_import_jobs')
        .insert({
          org_id: profile.organization_id,
          module_key: selectedModule,
          file_name: file.name,
          status: 'pending',
          total_rows: 0,
          processed_rows: 0,
          success_count: 0,
          error_count: 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Upload file to storage
      const filePath = `${profile.organization_id}/imports/${job.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('crm-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update job with file path
      await supabase
        .from('crm_import_jobs')
        .update({ file_path: filePath, status: 'processing' })
        .eq('id', job.id);

      toast.success('Import started! Processing will continue in the background.');

      // Reset form
      setFile(null);
      setSelectedModule('');

      // Refresh job list
      loadImportJobs();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to start import');
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: ImportJob['status']) => {
    const styles = {
      completed: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
      processing: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
      failed: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
      pending: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const selectedModuleInfo = IMPORT_MODULES.find((m) => m.key === selectedModule);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl">
            <Upload className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Import Data
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Upload CSV or Excel files to import records into your CRM
            </p>
          </div>
        </div>
      </div>

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
                accept=".csv,.xlsx,.xls"
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
                    <p className="text-sm text-slate-500">
                      CSV or Excel files (.csv, .xlsx, .xls)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!file || !selectedModule || uploading}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Starting Import...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Start Import
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
                Use our templates for best results
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                First row should contain column headers
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                Email field is used for duplicate detection
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                Maximum 10,000 rows per import
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
                  {job.status === 'completed' && (
                    <p className="text-xs text-slate-500 mt-1">
                      {job.success_count} imported
                      {job.error_count > 0 && `, ${job.error_count} errors`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
