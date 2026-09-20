'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Buildings, DownloadSimple, FileText, HardDrives, UploadSimple, Warning } from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AchOriginatorSettings } from '@/components/billing/AchOriginatorSettings';

interface NachaFileRow {
  id: string;
  file_name: string;
  file_type: string;
  status: string | null;
  transaction_count: number | null;
  total_debit_amount: number | null;
  total_credit_amount: number | null;
  effective_date: string;
  created_at: string | null;
}

interface JobRow {
  id: string;
  job_type: string;
  job_name: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function NachaPage() {
  const [files, setFiles] = useState<NachaFileRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [originatorComplete, setOriginatorComplete] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const [filesResult, jobsResult, queueRes] = await Promise.all([
        supabase
          .from('nacha_files')
          .select(
            'id, file_name, file_type, status, transaction_count, total_debit_amount, total_credit_amount, effective_date, created_at',
          )
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('job_runs')
          .select('id, job_type, job_name, status, error_message, created_at')
          .in('job_type', ['nacha_export', 'nacha_import'])
          .order('created_at', { ascending: false })
          .limit(8),
        fetch('/api/billing/nacha/export'),
      ]);

      if (filesResult.error) throw filesResult.error;
      setFiles((filesResult.data ?? []) as NachaFileRow[]);
      if (!jobsResult.error) setJobs((jobsResult.data ?? []) as JobRow[]);

      if (queueRes.ok) {
        const queue = await queueRes.json();
        setPendingCount(Array.isArray(queue.transactions) ? queue.transactions.length : 0);
        setOriginatorComplete(Boolean(queue.originatorComplete));
        setMissing(Array.isArray(queue.missing) ? queue.missing : []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load NACHA files');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const formatMoney = (value: number | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/billing"
        backLabel="Back to billing"
        title="NACHA / ACH"
        description="Bank of Colorado ACH origination for enrollment billing. Files are generated server-side only."
        icon={<Buildings weight="light" className="w-6 h-6" />}
        gradient="from-amber-500 to-orange-400"
        actions={
          <>
            <Link href="/ops/jobs?type=nacha_export">
              <Button variant="outline" size="sm">Ops jobs</Button>
            </Link>
            <Link href="/billing/nacha/import">
              <Button variant="outline" size="sm">
                <UploadSimple weight="light" className="w-4 h-4 mr-2" />
                Returns
              </Button>
            </Link>
            <Link href="/billing/nacha/export">
              <Button size="sm">
                <DownloadSimple weight="light" className="w-4 h-4 mr-2" />
                Export
              </Button>
            </Link>
          </>
        }
      />

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 flex gap-3">
          <Warning weight="light" className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-950 space-y-1">
            <p>
              Export can build a balanced file when every selected row has an encrypted ACH vault
              and settlement settings are complete. Do not send that file to Bank of Colorado until
              you have verified it. Automated SFTP is not live.
            </p>
            <p>
              Cards stay on NMI. First-month and recurring ACH queue here instead of charging
              the card processor. Returns and NOCs post from the Returns page against originated
              traces only. A return on the settlement offset matches the stored export trace;
              older exports without that trace still refuse. A missing return is not treated as
              success.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Originator</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {originatorComplete ? 'Ready' : 'Incomplete'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {originatorComplete
                ? 'Bank header identity is saved.'
                : missing.length
                  ? `Missing: ${missing.join(', ')}`
                  : 'Save settings from values the bank gives you.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending ACH</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{pendingCount}</p>
            <p className="text-xs text-slate-500 mt-1">
              Pending bank-account charges and refunds waiting for a file.
            </p>
            <Link href="/billing/nacha/export" className="text-xs text-amber-800 underline mt-2 inline-block">
              Open export queue
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">File transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2">
              <HardDrives weight="light" className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xl font-semibold">Manual</p>
                <p className="text-xs text-slate-500 mt-1">
                  Download from Export. Automated Bank of Colorado SFTP is Phase 5 — Vercel IPs are
                  not static.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AchOriginatorSettings />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ops job history</CardTitle>
              <CardDescription>
                nacha_export / nacha_import rows in job_runs. Scheduler Run opens this hub instead of
                faking a completed job.
              </CardDescription>
            </div>
            <Link href="/ops/jobs?type=nacha_export" className="text-sm text-amber-800 underline">
              View in Ops
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No NACHA job runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <p className="font-medium">{job.job_name}</p>
                      <p className="text-xs text-slate-500">{job.job_type}</p>
                      {job.error_message ? (
                        <p className="text-xs text-red-600 mt-1">{job.error_message}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>File history</CardTitle>
              <CardDescription>Rows from nacha_files. Raw file contents are never stored.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchFiles()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <FileText weight="light" className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500">No NACHA files yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-mono text-sm">{file.file_name}</TableCell>
                    <TableCell>
                      <Badge variant={file.file_type === 'export' ? 'default' : 'secondary'}>
                        {file.file_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{file.status ?? '—'}</TableCell>
                    <TableCell>{file.transaction_count ?? 0}</TableCell>
                    <TableCell>{formatMoney(file.total_debit_amount)}</TableCell>
                    <TableCell>{formatMoney(file.total_credit_amount)}</TableCell>
                    <TableCell>{file.effective_date}</TableCell>
                    <TableCell>
                      {file.created_at
                        ? formatDistanceToNow(new Date(file.created_at), { addSuffix: true })
                        : '—'}
                      {file.created_at ? (
                        <span className="sr-only">{format(new Date(file.created_at), 'PPpp')}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
