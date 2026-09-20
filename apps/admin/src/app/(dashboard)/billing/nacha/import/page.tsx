'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowClockwise, FileText, UploadSimple, Warning } from '@phosphor-icons/react';
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
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface NachaFileRow {
  id: string;
  file_name: string;
  status: string | null;
  transaction_count: number | null;
  return_count: number | null;
  created_at: string | null;
}

export default function NachaImportPage() {
  const [files, setFiles] = useState<NachaFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nacha_files')
        .select('id, file_name, status, transaction_count, return_count, created_at')
        .eq('file_type', 'import')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setFiles((data ?? []) as NachaFileRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load return files');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/billing/nacha"
        backLabel="NACHA / ACH"
        title="ACH returns"
        description="Bank return and NOC posting. This is not a working uploader."
        icon={<UploadSimple weight="light" className="w-6 h-6" />}
        gradient="from-amber-500 to-orange-400"
        actions={
          <Link href="/billing/nacha/export">
            <Button variant="outline" size="sm">Go to export</Button>
          </Link>
        }
      />

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 flex gap-3">
          <Warning weight="light" className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-950 space-y-1">
            <p>
              Return / NOC import is Phase 4. Uploading a bank file here would not update
              billing_transactions, enrollments, or job_runs.
            </p>
            <p>
              Until that ships, keep return files at the bank and do not mark ACH charges
              success or failed by hand from this page.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Imported return files</CardTitle>
              <CardDescription>
                Rows from nacha_files where file_type is import. Raw file contents are never stored.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <ArrowClockwise weight="light" className="h-4 w-4 mr-2" />
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
              <p className="text-slate-500">No return files posted yet</p>
              <p className="text-sm text-slate-400 mt-1">Phase 4 will post R01–R29 codes here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Returns</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-mono text-sm">{file.file_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{file.status ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>{file.transaction_count ?? 0}</TableCell>
                    <TableCell>{file.return_count ?? 0}</TableCell>
                    <TableCell>
                      {file.created_at
                        ? formatDistanceToNow(new Date(file.created_at), { addSuffix: true })
                        : '—'}
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
