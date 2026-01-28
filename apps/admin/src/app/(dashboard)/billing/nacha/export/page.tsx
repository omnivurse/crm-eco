'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Label,
  Textarea,
} from '@crm-eco/ui';
import {
  Download,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  DollarSign,
  RefreshCw,
  ArrowLeft,
  Search,
  Filter,
  Eye,
  Building2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface PendingTransaction {
  id: string;
  member_id: string;
  amount: number;
  type: 'debit' | 'credit';
  status: string;
  routing_number: string | null;
  account_number_last4: string | null;
  member: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface ExportJob {
  id: string;
  job_name: string;
  status: string;
  records_processed: number;
  result: {
    total_amount: number;
    effective_date: string;
    transaction_ids: string[];
  };
  created_at: string;
  completed_at: string | null;
}

export default function NachaExportPage() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [exportDate, setExportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [nachaPreview, setNachaPreview] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');

  const supabase = createClient();

  // Get organization ID
  useEffect(() => {
    async function getOrgId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single() as { data: { id: string; organization_id: string } | null };

      if (profile) {
        setOrganizationId(profile.organization_id);
        setProfileId(profile.id);
      }
    }

    getOrgId();
  }, [supabase]);

  // Fetch pending transactions
  const fetchPendingTransactions = useCallback(async () => {
    if (!organizationId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('billing_transactions')
        .select(
          `
          id,
          member_id,
          amount,
          type,
          status,
          routing_number,
          account_number_last4,
          member:members(first_name, last_name, email)
        `
        )
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .eq('payment_method', 'ach')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error && error.code !== '42P01') throw error;

      setPendingTransactions((data || []) as unknown as PendingTransaction[]);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId]);

  // Fetch export history
  const fetchExportHistory = useCallback(async () => {
    if (!organizationId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('job_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('job_type', 'nacha_export')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error && error.code !== '42P01') throw error;

      setExportHistory((data || []) as ExportJob[]);
    } catch (error) {
      console.error('Error fetching export history:', error);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchPendingTransactions();
      fetchExportHistory();
    }
  }, [organizationId, fetchPendingTransactions, fetchExportHistory]);

  // Filter transactions
  const filteredTransactions = pendingTransactions.filter((txn) => {
    const matchesSearch =
      !searchQuery ||
      txn.member?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.member?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.member?.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || txn.type === typeFilter;

    return matchesSearch && matchesType;
  });

  // Generate NACHA file content
  const generateNachaContent = (transactions: PendingTransaction[], effectiveDate: string): string => {
    const lines: string[] = [];
    const fileDate = format(new Date(), 'yyMMdd');
    const fileTime = format(new Date(), 'HHmm');
    const effDate = format(new Date(effectiveDate), 'yyMMdd');

    // File Header Record (1)
    lines.push(
      '1' + // Record Type Code
        '01' + // Priority Code
        ' 123456789' + // Immediate Destination (bank routing)
        ' 987654321' + // Immediate Origin (company ID)
        fileDate + // File Creation Date
        fileTime + // File Creation Time
        'A' + // File ID Modifier
        '094' + // Record Size
        '10' + // Blocking Factor
        '1' + // Format Code
        'DEST BANK NAME'.padEnd(23) + // Immediate Destination Name
        'PAY IT FORWARD HS'.padEnd(23) + // Immediate Origin Name
        '        ' // Reference Code
    );

    // Batch Header Record (5)
    const batchNumber = '0000001';
    lines.push(
      '5' + // Record Type Code
        '225' + // Service Class Code (debits and credits)
        'PAY IT FORWARD HS'.padEnd(16) + // Company Name
        '                    ' + // Company Discretionary Data
        '1234567890'.padEnd(10) + // Company Identification
        'PPD' + // Standard Entry Class Code
        'PAYMENT'.padEnd(10) + // Company Entry Description
        fileDate + // Company Descriptive Date
        effDate + // Effective Entry Date
        '   ' + // Settlement Date
        '1' + // Originator Status Code
        '12345678' + // Originating DFI Identification
        batchNumber // Batch Number
    );

    // Entry Detail Records (6)
    let totalDebitAmount = 0;
    let totalCreditAmount = 0;
    let entryHash = 0;

    transactions.forEach((txn, index) => {
      const traceNumber = `12345678${String(index + 1).padStart(7, '0')}`;
      const routingNumber = txn.routing_number || '000000000';
      const amount = Math.round(txn.amount * 100); // Convert to cents

      if (txn.type === 'debit') {
        totalDebitAmount += amount;
      } else {
        totalCreditAmount += amount;
      }

      entryHash += parseInt(routingNumber.slice(0, 8));

      lines.push(
        '6' + // Record Type Code
          (txn.type === 'debit' ? '27' : '22') + // Transaction Code (27=debit, 22=credit)
          routingNumber.slice(0, 8) + // Receiving DFI Identification
          routingNumber.slice(8, 9) + // Check Digit
          (txn.account_number_last4 || '0000').padStart(17) + // DFI Account Number
          String(amount).padStart(10, '0') + // Amount
          txn.member_id.slice(0, 15).padEnd(15) + // Individual Identification Number
          `${txn.member?.first_name} ${txn.member?.last_name}`.slice(0, 22).padEnd(22) + // Individual Name
          '  ' + // Discretionary Data
          '0' + // Addenda Record Indicator
          traceNumber // Trace Number
      );
    });

    // Batch Control Record (8)
    lines.push(
      '8' + // Record Type Code
        '225' + // Service Class Code
        String(transactions.length).padStart(6, '0') + // Entry/Addenda Count
        String(entryHash % 10000000000).padStart(10, '0') + // Entry Hash
        String(totalDebitAmount).padStart(12, '0') + // Total Debit Entry Dollar Amount
        String(totalCreditAmount).padStart(12, '0') + // Total Credit Entry Dollar Amount
        '1234567890'.padEnd(10) + // Company Identification
        '                         ' + // Message Authentication Code
        '      ' + // Reserved
        '12345678' + // Originating DFI Identification
        batchNumber // Batch Number
    );

    // File Control Record (9)
    const blockCount = Math.ceil((lines.length + 1) / 10);
    lines.push(
      '9' + // Record Type Code
        '000001' + // Batch Count
        String(blockCount).padStart(6, '0') + // Block Count
        String(transactions.length).padStart(8, '0') + // Entry/Addenda Count
        String(entryHash % 10000000000).padStart(10, '0') + // Entry Hash
        String(totalDebitAmount).padStart(12, '0') + // Total Debit Entry Dollar Amount
        String(totalCreditAmount).padStart(12, '0') + // Total Credit Entry Dollar Amount
        '                                       ' // Reserved
    );

    // Pad to block of 10
    while (lines.length % 10 !== 0) {
      lines.push('9'.repeat(94));
    }

    return lines.join('\n');
  };

  // Preview NACHA file
  const handlePreview = () => {
    if (selectedTransactions.size === 0) {
      toast.error('Please select transactions to preview');
      return;
    }

    const txnsToExport = pendingTransactions.filter((t) => selectedTransactions.has(t.id));
    const preview = generateNachaContent(txnsToExport, exportDate);
    setNachaPreview(preview);
    setShowPreviewModal(true);
  };

  // Handle export
  const handleExport = async () => {
    if (selectedTransactions.size === 0) {
      toast.error('Please select transactions to export');
      return;
    }

    setExporting(true);
    try {
      const txnsToExport = pendingTransactions.filter((t) => selectedTransactions.has(t.id));
      const nachaContent = generateNachaContent(txnsToExport, exportDate);
      const totalAmount = txnsToExport.reduce((sum, t) => sum + t.amount, 0);
      const fileName = `NACHA_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`;

      // Create job record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: job, error: jobError } = await (supabase as any)
        .from('job_runs')
        .insert({
          organization_id: organizationId,
          job_type: 'nacha_export',
          job_name: fileName,
          status: 'completed',
          records_processed: txnsToExport.length,
          records_succeeded: txnsToExport.length,
          trigger_type: 'manual',
          triggered_by: profileId,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          result: {
            total_amount: totalAmount,
            effective_date: exportDate,
            transaction_ids: Array.from(selectedTransactions),
          },
        })
        .select('id')
        .single();

      if (jobError) throw jobError;

      // Update transactions as exported
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('billing_transactions')
        .update({ status: 'exported', nacha_job_id: job.id })
        .in('id', Array.from(selectedTransactions));

      // Log to audit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('billing_audit_log').insert({
        action: 'nacha_export',
        entity_type: 'nacha_file',
        entity_id: job.id,
        details: {
          file_name: fileName,
          transaction_count: txnsToExport.length,
          total_amount: totalAmount,
          effective_date: exportDate,
        },
      });

      // Download file
      const blob = new Blob([nachaContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${txnsToExport.length} transactions`);
      setShowExportModal(false);
      setSelectedTransactions(new Set());
      fetchPendingTransactions();
      fetchExportHistory();
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const selectedTotal = pendingTransactions
    .filter((t) => selectedTransactions.has(t.id))
    .reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">NACHA Export</h1>
            <p className="text-slate-500">Generate ACH batch files for bank submission</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/billing/nacha/import">
            <Button variant="outline">Go to Import</Button>
          </Link>
          <Button
            onClick={() => setShowExportModal(true)}
            disabled={selectedTransactions.size === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Create Export ({selectedTransactions.size})
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{pendingTransactions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selected</p>
                <p className="text-xl font-bold">{selectedTransactions.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selected Amount</p>
                <p className="text-xl font-bold">{formatCurrency(selectedTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exports Today</p>
                <p className="text-xl font-bold">
                  {
                    exportHistory.filter(
                      (e) =>
                        new Date(e.created_at).toDateString() === new Date().toDateString()
                    ).length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                className="border rounded px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'debit' | 'credit')}
              >
                <option value="all">All Types</option>
                <option value="debit">Debits Only</option>
                <option value="credit">Credits Only</option>
              </select>
            </div>
            <Button variant="outline" onClick={handlePreview} disabled={selectedTransactions.size === 0}>
              <Eye className="h-4 w-4 mr-2" />
              Preview File
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending ACH Transactions</CardTitle>
              <CardDescription>
                {filteredTransactions.length} transactions ready for export
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPendingTransactions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500">No pending ACH transactions</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedTransactions.size === filteredTransactions.length &&
                        filteredTransactions.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id} className={selectedTransactions.has(txn.id) ? 'bg-teal-50' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(txn.id)}
                        onChange={() => {
                          const newSet = new Set(selectedTransactions);
                          if (newSet.has(txn.id)) {
                            newSet.delete(txn.id);
                          } else {
                            newSet.add(txn.id);
                          }
                          setSelectedTransactions(newSet);
                        }}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {txn.member?.first_name} {txn.member?.last_name}
                      </p>
                      <p className="text-xs text-slate-500">{txn.member?.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={txn.type === 'debit' ? 'default' : 'secondary'}>
                        {txn.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-sm">****{txn.account_number_last4 || '0000'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(txn.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Exports</CardTitle>
          <CardDescription>Previously generated NACHA files</CardDescription>
        </CardHeader>
        <CardContent>
          {exportHistory.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No exports yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exportHistory.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-sm">{job.job_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          job.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : job.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{job.records_processed}</TableCell>
                    <TableCell>{formatCurrency(job.result?.total_amount || 0)}</TableCell>
                    <TableCell>
                      {job.result?.effective_date
                        ? format(new Date(job.result.effective_date), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <span title={format(new Date(job.created_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create NACHA Export</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                The date the transactions will be processed by the bank
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Transactions</span>
                <span className="font-medium">{selectedTransactions.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount</span>
                <span className="font-semibold text-lg">{formatCurrency(selectedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">File Name</span>
                <span className="font-mono text-sm">
                  NACHA_{format(new Date(), 'yyyyMMdd_HHmmss')}.txt
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting || selectedTransactions.size === 0}>
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export & Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>NACHA File Preview</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              readOnly
              value={nachaPreview}
              className="font-mono text-xs h-96"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowPreviewModal(false);
              setShowExportModal(true);
            }}>
              Proceed to Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
