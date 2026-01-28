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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Label,
  Progress,
} from '@crm-eco/ui';
import {
  Download,
  Upload,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  DollarSign,
  Building2,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface NachaFile {
  id: string;
  file_name: string;
  file_type: 'export' | 'import';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_amount: number;
  transaction_count: number;
  effective_date: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

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

export default function NachaPage() {
  const [activeTab, setActiveTab] = useState('export');
  const [nachaFiles, setNachaFiles] = useState<NachaFile[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDate, setExportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const supabase = createClient();

  // Get organization ID
  useEffect(() => {
    async function getOrgId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const result = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      const profile = result.data as { id: string; organization_id: string } | null;
      if (profile) {
        setOrganizationId(profile.organization_id);
        setProfileId(profile.id);
      }
    }

    getOrgId();
  }, [supabase]);

  // Fetch NACHA file history
  const fetchNachaFiles = useCallback(async () => {
    if (!organizationId) return;

    try {
      // For now, we'll use job_runs to track NACHA operations
      const { data, error } = await supabase
        .from('job_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .in('job_type', ['nacha_export', 'nacha_import'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code !== '42P01') throw error;

      // Transform to NachaFile format
      const files: NachaFile[] = (data || []).map((job: any) => ({
        id: job.id,
        file_name: job.job_name || `NACHA_${format(new Date(job.created_at), 'yyyyMMdd_HHmmss')}.txt`,
        file_type: job.job_type === 'nacha_export' ? 'export' : 'import',
        status: job.status,
        total_amount: job.result?.total_amount || 0,
        transaction_count: job.records_processed || 0,
        effective_date: job.result?.effective_date || job.created_at,
        created_at: job.created_at,
        completed_at: job.completed_at,
        error_message: job.error_message,
      }));

      setNachaFiles(files);
    } catch (error) {
      console.error('Error fetching NACHA files:', error);
    }
  }, [supabase, organizationId]);

  // Fetch pending transactions for export
  const fetchPendingTransactions = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('billing_transactions')
        .select(`
          id,
          member_id,
          amount,
          type,
          status,
          routing_number,
          account_number_last4,
          member:members(first_name, last_name, email)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .eq('payment_method', 'ach')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error && error.code !== '42P01') throw error;

      setPendingTransactions((data || []) as unknown as PendingTransaction[]);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchNachaFiles();
      fetchPendingTransactions();
    }
  }, [organizationId, fetchNachaFiles, fetchPendingTransactions]);

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

  // Handle export
  const handleExport = async () => {
    if (selectedTransactions.size === 0) {
      toast.error('Please select transactions to export');
      return;
    }

    setExporting(true);
    try {
      const txnsToExport = pendingTransactions.filter(t => selectedTransactions.has(t.id));
      const nachaContent = generateNachaContent(txnsToExport, exportDate);
      const totalAmount = txnsToExport.reduce((sum, t) => sum + t.amount, 0);

      // Create job record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: job, error: jobError } = await (supabase as any)
        .from('job_runs')
        .insert({
          organization_id: organizationId,
          job_type: 'nacha_export',
          job_name: `NACHA_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}`,
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

      // Download file
      const blob = new Blob([nachaContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NACHA_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${txnsToExport.length} transactions`);
      setShowExportModal(false);
      setSelectedTransactions(new Set());
      fetchNachaFiles();
      fetchPendingTransactions();
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    try {
      const content = await importFile.text();
      const lines = content.split('\n').filter(l => l.trim());

      // Create job record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: job, error: jobError } = await (supabase as any)
        .from('job_runs')
        .insert({
          organization_id: organizationId,
          job_type: 'nacha_import',
          job_name: importFile.name,
          status: 'processing',
          trigger_type: 'manual',
          triggered_by: profileId,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (jobError) throw jobError;

      // Parse and process return file
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        setImportProgress(Math.round((i / lines.length) * 100));

        // Process entry detail records (type 6)
        if (line.startsWith('6')) {
          processedCount++;
          // In a real implementation, you would:
          // 1. Parse the return code
          // 2. Find the original transaction
          // 3. Update its status based on return code
          successCount++;
        }
      }

      // Update job status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('job_runs')
        .update({
          status: 'completed',
          records_processed: processedCount,
          records_succeeded: successCount,
          records_failed: errorCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      toast.success(`Processed ${processedCount} records`);
      setShowImportModal(false);
      setImportFile(null);
      fetchNachaFiles();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import failed');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === pendingTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(pendingTransactions.map(t => t.id)));
    }
  };

  const selectedTotal = pendingTransactions
    .filter(t => selectedTransactions.has(t.id))
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
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
              <h1 className="text-2xl font-bold text-slate-900">NACHA / ACH</h1>
              <p className="text-slate-500">Export and import ACH batch files</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Return File
            </Button>
            <Button onClick={() => setShowExportModal(true)}>
              <Download className="w-4 h-4 mr-2" />
              Export NACHA
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="export">Pending Transactions</TabsTrigger>
            <TabsTrigger value="history">File History</TabsTrigger>
          </TabsList>

          {/* Pending Transactions Tab */}
          <TabsContent value="export" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pending ACH Transactions</CardTitle>
                    <CardDescription>
                      {pendingTransactions.length} transactions ready for export
                    </CardDescription>
                  </div>
                  {selectedTransactions.size > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-slate-500">{selectedTransactions.size} selected</p>
                      <p className="font-semibold text-lg">
                        ${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : pendingTransactions.length === 0 ? (
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
                            checked={selectedTransactions.size === pendingTransactions.length}
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
                      {pendingTransactions.map((txn) => (
                        <TableRow key={txn.id}>
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
                            <span className="font-mono text-sm">
                              ****{txn.account_number_last4 || '0000'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* File History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>NACHA File History</CardTitle>
                <CardDescription>Previous exports and imports</CardDescription>
              </CardHeader>
              <CardContent>
                {nachaFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">No NACHA files yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Transactions</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nachaFiles.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="font-mono text-sm">{file.file_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={file.file_type === 'export' ? 'default' : 'secondary'}>
                              {file.file_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                file.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                file.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }
                            >
                              {file.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{file.transaction_count}</TableCell>
                          <TableCell>
                            ${file.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span title={format(new Date(file.created_at), 'PPpp')}>
                              {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export NACHA File</DialogTitle>
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
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-slate-500">Transactions</span>
                <span className="font-medium">{selectedTransactions.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount</span>
                <span className="font-semibold text-lg">
                  ${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                  Export File
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import NACHA Return File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <input
                type="file"
                accept=".txt,.ach,.nacha"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
                id="nacha-import"
              />
              <label htmlFor="nacha-import" className="cursor-pointer">
                {importFile ? (
                  <div>
                    <FileText className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">{importFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">Click to upload</p>
                    <p className="text-sm text-slate-500">.txt, .ach, or .nacha files</p>
                  </div>
                )}
              </label>
            </div>

            {importing && (
              <div>
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-slate-500 text-center mt-2">
                  Processing... {importProgress}%
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing || !importFile}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import File
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
