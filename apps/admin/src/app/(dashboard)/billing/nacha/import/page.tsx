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
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface NachaFileRow {
  id: string;
  file_name: string;
  status: string | null;
  transaction_count: number | null;
  return_count: number | null;
  created_at: string | null;
  error_message?: string | null;
}

interface PreviewRow {
  kind: 'return' | 'noc';
  code: string;
  reason: string;
  amountCents: number;
  accountLast4: string | null;
  transactionId: string;
  alreadyPosted: boolean;
}

interface UnmatchedRow {
  originalTrace: string;
  kind: 'return' | 'noc';
  code: string;
  amountCents: number;
  accountLast4: string | null;
}

interface Preview {
  fileDate: string;
  returnCount: number;
  nocCount: number;
  matched: PreviewRow[];
  unmatched: UnmatchedRow[];
  nocBlocked: Array<{ originalTrace: string; code: string; reason: string }>;
}

export default function NachaImportPage() {
  const [files, setFiles] = useState<NachaFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState('');
  const [contents, setContents] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/nacha/import');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load return files');
      setFiles(data.files ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load return files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function readFile(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setContents(text);
    setPreview(null);
  }

  async function run(previewOnly: boolean) {
    if (!contents.trim()) {
      toast.error('Choose a return / NOC file first');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/billing/nacha/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, contents, preview: previewOnly }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.preview) setPreview(data.preview);
        else if (data.unmatched) {
          setPreview({
            fileDate: '',
            returnCount: 0,
            nocCount: 0,
            matched: [],
            unmatched: data.unmatched,
            nocBlocked: [],
          });
        }
        throw new Error(data.error || 'Return file was refused');
      }
      setPreview(data.preview);
      if (previewOnly) {
        toast.success('Preview ready. Nothing was posted.');
      } else {
        toast.success(`Posted ${data.posted} return/NOC row(s). Raw file was not stored.`);
        await load();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Return file was refused');
    } finally {
      setBusy(false);
    }
  }

  const blocked = Boolean(preview && (preview.unmatched.length || preview.nocBlocked.length));

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/billing/nacha"
        backLabel="NACHA / ACH"
        title="ACH returns"
        description="Manual return and NOC posting against originated traces. Files stay local."
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
              Upload a bank return/NOC file here. The original 15-digit trace must already exist
              on an originated export. Unmatched traces refuse the whole post.
            </p>
            <p>
              Returns mark the matched charge/refund failed. NOCs update the encrypted vault when
              the corrected account is complete — last4 is not enough. Items not in the file stay
              processing; a missing return is not treated as success. Automated SFTP is not live.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Post a return file</CardTitle>
          <CardDescription>
            Preview first. Applying writes billing status and job history, not the raw file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nacha-return-file">NACHA return / NOC file</Label>
            <Input
              id="nacha-return-file"
              type="file"
              accept=".txt,.ach,.dat,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
            {fileName ? (
              <p className="text-xs text-muted-foreground">{fileName} loaded in the browser only.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !contents} onClick={() => void run(true)}>
              Preview
            </Button>
            <Button disabled={busy || !contents || blocked} onClick={() => void run(false)}>
              Apply returns
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {preview.fileDate ? `File date ${preview.fileDate}. ` : ''}
              {preview.returnCount} return(s), {preview.nocCount} NOC(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.unmatched.length ? (
              <p className="text-sm text-amber-800">
                {preview.unmatched.length} unmatched original trace(s). Apply stays disabled.
              </p>
            ) : null}
            {preview.nocBlocked.length ? (
              <p className="text-sm text-amber-800">
                {preview.nocBlocked.map((row) => `${row.code}: ${row.reason}`).join(' ')}
              </p>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Last4</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.matched.map((row) => (
                  <TableRow key={`${row.transactionId}-${row.code}`}>
                    <TableCell>{row.kind}</TableCell>
                    <TableCell className="font-mono">{row.code}</TableCell>
                    <TableCell>${(row.amountCents / 100).toFixed(2)}</TableCell>
                    <TableCell>{row.accountLast4 ?? '—'}</TableCell>
                    <TableCell>{row.alreadyPosted ? 'Already posted' : 'Matched'}</TableCell>
                  </TableRow>
                ))}
                {preview.unmatched.map((row) => (
                  <TableRow key={`u-${row.originalTrace}-${row.code}`}>
                    <TableCell>{row.kind}</TableCell>
                    <TableCell className="font-mono">{row.code}</TableCell>
                    <TableCell>${(row.amountCents / 100).toFixed(2)}</TableCell>
                    <TableCell>{row.accountLast4 ?? '—'}</TableCell>
                    <TableCell>Unmatched {row.originalTrace.slice(-7)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Imported return files</CardTitle>
              <CardDescription>
                Metadata only. Raw bank file contents are never stored.
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
