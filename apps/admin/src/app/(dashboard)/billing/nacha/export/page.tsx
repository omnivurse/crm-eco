'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowClockwise,
  Buildings,
  DownloadSimple,
  Eye,
  Warning,
} from '@phosphor-icons/react';
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
import { format } from 'date-fns';
import { toast } from 'sonner';

interface QueueRow {
  id: string;
  amount: number;
  transactionType: string;
  accountLast4: string | null;
  accountType: string | null;
  vaultReady: boolean;
  member: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

interface UnavailableRow {
  transactionId: string;
  memberName: string;
  accountLast4: string | null;
  reason: string;
}

export default function NachaExportPage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [originatorComplete, setOriginatorComplete] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportDate, setExportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/nacha/export');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load ACH export queue');
      setRows(data.transactions ?? []);
      setOriginatorComplete(Boolean(data.originatorComplete));
      setMissing(Array.isArray(data.missing) ? data.missing : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load export queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRows = rows.filter((row) => selected.has(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);
  const selectedVaultReady = selectedRows.length > 0 && selectedRows.every((row) => row.vaultReady);

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((row) => row.id)));
  };

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const submit = async (preview: boolean) => {
    if (selected.size === 0) {
      toast.error('Select at least one pending ACH transaction');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/billing/nacha/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selected),
          effectiveDate: exportDate,
          preview,
        }),
      });

      if (res.status === 409) {
        const data = (await res.json()) as {
          error?: string;
          code?: string;
          missing?: string[];
          unavailable?: UnavailableRow[];
        };
        if (data.code === 'ORIGINATOR_INCOMPLETE') {
          toast.error(data.error || 'Originator settings are incomplete');
          return;
        }
        const first = data.unavailable?.[0];
        toast.error(
          first
            ? `${data.error} ${first.memberName} ****${first.accountLast4 ?? '????'}.`
            : data.error || 'Export blocked',
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(data.error || 'Export failed');
      }

      if (preview) {
        const data = await res.json();
        toast.success(
          `Preview ready for ${data.transactionCount} entries (${formatMoney((data.debitCents ?? 0) / 100)} debit / ${formatMoney((data.creditCents ?? 0) / 100)} credit). Full file is not shown.`,
        );
        return;
      }

      const blob = await res.blob();
      const fileName = res.headers.get('X-Nacha-File-Name') || 'NACHA.txt';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${fileName}`);
      setSelected(new Set());
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/billing/nacha"
        backLabel="NACHA / ACH"
        title="NACHA export"
        description="Pending bank-account charges and refunds. Generation is server-side and fail-closed."
        icon={<DownloadSimple weight="light" className="w-6 h-6" />}
        gradient="from-amber-500 to-orange-400"
        actions={
          <Link href="/billing/nacha">
            <Button variant="outline" size="sm">Originator settings</Button>
          </Link>
        }
      />

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 flex gap-3">
          <Warning weight="light" className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-950 space-y-1">
            <p>
              {originatorComplete
                ? 'Originator settings are complete.'
                : `Originator settings are incomplete${missing.length ? `: ${missing.join(', ')}` : '.'}`}
            </p>
            <p>
              Export hydrates routing and account from the encrypted ACH vault and balances the file
              with a settlement offset. Rows without a vault still refuse. Do not send a generated
              file to the bank until you have verified it.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1">
            <Label htmlFor="effectiveDate">Effective date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground md:text-right">
            {selected.size} selected · {formatMoney(selectedTotal)}
          </div>
          <Button variant="outline" onClick={() => void submit(true)} disabled={busy || selected.size === 0 || !selectedVaultReady}>
            <Eye weight="light" className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={() => void submit(false)} disabled={busy || selected.size === 0 || !originatorComplete || !selectedVaultReady}>
            <DownloadSimple weight="light" className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending ACH</CardTitle>
              <CardDescription>
                Bank-account profiles only, status pending. A charge becomes a debit; a refund becomes a credit.
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
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <Buildings weight="light" className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500">No pending bank-account charges or refunds</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length && rows.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Vault</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={selected.has(row.id) ? 'bg-teal-50' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          setSelected(next);
                        }}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {row.member.firstName} {row.member.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{row.member.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.transactionType === 'charge' ? 'default' : 'secondary'}>
                        {row.transactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      ****{row.accountLast4 || '????'}
                      {row.accountType ? ` · ${row.accountType}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.vaultReady ? 'default' : 'secondary'}>
                        {row.vaultReady ? 'Ready' : 'Missing'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(row.amount)}</TableCell>
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
