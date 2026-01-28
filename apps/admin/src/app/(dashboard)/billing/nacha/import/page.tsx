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
  Progress,
} from '@crm-eco/ui';
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  FileWarning,
  Eye,
  Download,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface ImportJob {
  id: string;
  job_name: string;
  status: string;
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  result: {
    return_codes: Record<string, number>;
    affected_transactions: string[];
  };
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ParsedReturn {
  transactionId: string;
  returnCode: string;
  returnReason: string;
  amount: number;
  memberName: string;
}

const RETURN_CODES: Record<string, { description: string; category: string }> = {
  R01: { description: 'Insufficient Funds', category: 'nsf' },
  R02: { description: 'Account Closed', category: 'closed' },
  R03: { description: 'No Account/Unable to Locate', category: 'invalid' },
  R04: { description: 'Invalid Account Number', category: 'invalid' },
  R05: { description: 'Unauthorized Debit', category: 'unauthorized' },
  R06: { description: 'Returned per ODFI Request', category: 'other' },
  R07: { description: 'Authorization Revoked', category: 'unauthorized' },
  R08: { description: 'Payment Stopped', category: 'stopped' },
  R09: { description: 'Uncollected Funds', category: 'nsf' },
  R10: { description: 'Customer Advises Not Authorized', category: 'unauthorized' },
  R20: { description: 'Non-Transaction Account', category: 'invalid' },
  R29: { description: 'Corporate Customer Advises Not Authorized', category: 'unauthorized' },
};

export default function NachaImportPage() {
  const [importHistory, setImportHistory] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [parsedReturns, setParsedReturns] = useState<ParsedReturn[]>([]);
  const [showPreview, setShowPreview] = useState(false);

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
        .single();

      if (profile) {
        setOrganizationId(profile.organization_id);
        setProfileId(profile.id);
      }
    }

    getOrgId();
  }, [supabase]);

  // Fetch import history
  const fetchImportHistory = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('job_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('job_type', 'nacha_import')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code !== '42P01') throw error;

      setImportHistory((data || []) as ImportJob[]);
    } catch (error) {
      console.error('Error fetching import history:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchImportHistory();
    }
  }, [organizationId, fetchImportHistory]);

  // Parse NACHA return file
  const parseReturnFile = async (file: File): Promise<ParsedReturn[]> => {
    const content = await file.text();
    const lines = content.split('\n').filter((l) => l.trim());
    const returns: ParsedReturn[] = [];

    for (const line of lines) {
      // Parse entry detail records (type 6) with addenda (type 7)
      if (line.startsWith('6')) {
        const transactionCode = line.substring(1, 3);
        // Return codes are typically in the 20s for returns
        if (transactionCode.startsWith('2')) {
          const amount = parseInt(line.substring(29, 39)) / 100;
          const memberName = line.substring(54, 76).trim();
          const traceNumber = line.substring(79, 94);

          returns.push({
            transactionId: traceNumber,
            returnCode: 'R01', // Would be parsed from addenda in real implementation
            returnReason: RETURN_CODES['R01']?.description || 'Unknown',
            amount,
            memberName,
          });
        }
      }

      // Parse addenda records (type 7) for return reason codes
      if (line.startsWith('7')) {
        const returnCode = line.substring(3, 6);
        if (returns.length > 0 && RETURN_CODES[returnCode]) {
          returns[returns.length - 1].returnCode = returnCode;
          returns[returns.length - 1].returnReason = RETURN_CODES[returnCode].description;
        }
      }
    }

    return returns;
  };

  // Handle file selection and preview
  const handleFileSelect = async (file: File | null) => {
    setImportFile(file);
    if (file) {
      try {
        const parsed = await parseReturnFile(file);
        setParsedReturns(parsed);
        setShowPreview(true);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Failed to parse file');
      }
    } else {
      setParsedReturns([]);
      setShowPreview(false);
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
      // Create job record
      const { data: job, error: jobError } = await supabase
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

      // Process returns
      let successCount = 0;
      let errorCount = 0;
      const returnCodeCounts: Record<string, number> = {};
      const affectedTransactions: string[] = [];

      for (let i = 0; i < parsedReturns.length; i++) {
        const ret = parsedReturns[i];
        setImportProgress(Math.round(((i + 1) / parsedReturns.length) * 100));

        // Track return codes
        returnCodeCounts[ret.returnCode] = (returnCodeCounts[ret.returnCode] || 0) + 1;

        try {
          // In a real implementation, you would:
          // 1. Find the original transaction by trace number
          // 2. Update its status to 'returned'
          // 3. Create a billing failure record
          // 4. Potentially trigger member notification

          // Simulate processing
          await new Promise((resolve) => setTimeout(resolve, 50));

          affectedTransactions.push(ret.transactionId);
          successCount++;
        } catch {
          errorCount++;
        }
      }

      // Update job status
      await supabase
        .from('job_runs')
        .update({
          status: 'completed',
          records_processed: parsedReturns.length,
          records_succeeded: successCount,
          records_failed: errorCount,
          completed_at: new Date().toISOString(),
          result: {
            return_codes: returnCodeCounts,
            affected_transactions: affectedTransactions,
          },
        })
        .eq('id', job.id);

      // Log to audit
      await supabase.from('billing_audit_log').insert({
        action: 'nacha_import',
        entity_type: 'nacha_file',
        entity_id: job.id,
        details: {
          file_name: importFile.name,
          records_processed: parsedReturns.length,
          return_codes: returnCodeCounts,
        },
      });

      toast.success(`Processed ${parsedReturns.length} returns`);
      setShowImportModal(false);
      setImportFile(null);
      setParsedReturns([]);
      setShowPreview(false);
      fetchImportHistory();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Import failed');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const viewJobDetails = (job: ImportJob) => {
    setSelectedJob(job);
    setShowDetailsModal(true);
  };

  const getReturnCodeColor = (code: string) => {
    const category = RETURN_CODES[code]?.category;
    switch (category) {
      case 'nsf':
        return 'bg-amber-100 text-amber-700';
      case 'unauthorized':
        return 'bg-red-100 text-red-700';
      case 'invalid':
        return 'bg-orange-100 text-orange-700';
      case 'closed':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  const totalReturns = importHistory.reduce((sum, job) => sum + (job.records_processed || 0), 0);
  const todayReturns = importHistory
    .filter((job) => new Date(job.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, job) => sum + (job.records_processed || 0), 0);

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
            <h1 className="text-2xl font-bold text-slate-900">NACHA Import</h1>
            <p className="text-slate-500">Process ACH return files from your bank</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/billing/nacha/export">
            <Button variant="outline">Go to Export</Button>
          </Link>
          <Button onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Return File
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Imports</p>
                <p className="text-xl font-bold">{importHistory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <FileWarning className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Returns</p>
                <p className="text-xl font-bold">{totalReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Returns Today</p>
                <p className="text-xl font-bold">{todayReturns}</p>
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
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-xl font-bold">
                  {importHistory.length > 0
                    ? (
                        (importHistory.reduce((sum, j) => sum + (j.records_succeeded || 0), 0) /
                          Math.max(totalReturns, 1)) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Return Code Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Common Return Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(RETURN_CODES)
              .slice(0, 8)
              .map(([code, info]) => (
                <div key={code} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <Badge className={getReturnCodeColor(code)}>{code}</Badge>
                  <span className="text-sm truncate">{info.description}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Import History</CardTitle>
              <CardDescription>Previously processed return files</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchImportHistory}>
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
          ) : importHistory.length === 0 ? (
            <div className="text-center py-12">
              <Upload className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-500">No imports yet</p>
              <p className="text-sm text-slate-400 mb-4">
                Upload a NACHA return file to process bank returns
              </p>
              <Button onClick={() => setShowImportModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import Return File
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Returns</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map((job) => (
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
                        {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {job.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                        {job.status === 'processing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{job.records_processed || 0}</TableCell>
                    <TableCell className="text-emerald-600">{job.records_succeeded || 0}</TableCell>
                    <TableCell className="text-red-600">{job.records_failed || 0}</TableCell>
                    <TableCell>
                      <span title={format(new Date(job.created_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => viewJobDetails(job)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import NACHA Return File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <input
                type="file"
                accept=".txt,.ach,.nacha"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
                id="nacha-import"
              />
              <label htmlFor="nacha-import" className="cursor-pointer">
                {importFile ? (
                  <div>
                    <FileText className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">{importFile.name}</p>
                    <p className="text-sm text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
                    <p className="text-sm text-slate-500">.txt, .ach, or .nacha files</p>
                  </div>
                )}
              </label>
            </div>

            {showPreview && parsedReturns.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b">
                  <p className="text-sm font-medium">
                    Preview: {parsedReturns.length} returns detected
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2">Return Code</th>
                        <th className="text-left px-4 py-2">Reason</th>
                        <th className="text-right px-4 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedReturns.slice(0, 10).map((ret, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">
                            <Badge className={getReturnCodeColor(ret.returnCode)}>
                              {ret.returnCode}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">{ret.returnReason}</td>
                          <td className="px-4 py-2 text-right font-mono">
                            ${ret.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedReturns.length > 10 && (
                    <p className="text-center text-sm text-slate-500 py-2">
                      And {parsedReturns.length - 10} more...
                    </p>
                  )}
                </div>
              </div>
            )}

            {importing && (
              <div>
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-slate-500 text-center mt-2">Processing... {importProgress}%</p>
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
                  Process Returns
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Details</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">File Name</p>
                  <p className="font-mono text-sm">{selectedJob.job_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    className={
                      selectedJob.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }
                  >
                    {selectedJob.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Returns</p>
                  <p className="font-semibold">{selectedJob.records_processed}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processed</p>
                  <p className="font-semibold text-emerald-600">{selectedJob.records_succeeded}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="font-semibold text-red-600">{selectedJob.records_failed}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Import Date</p>
                  <p className="text-sm">{format(new Date(selectedJob.created_at), 'PPpp')}</p>
                </div>
              </div>

              {selectedJob.result?.return_codes && (
                <div>
                  <p className="text-sm font-medium mb-2">Return Code Breakdown</p>
                  <div className="space-y-2">
                    {Object.entries(selectedJob.result.return_codes).map(([code, count]) => (
                      <div key={code} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getReturnCodeColor(code)}>{code}</Badge>
                          <span className="text-sm">
                            {RETURN_CODES[code]?.description || 'Unknown'}
                          </span>
                        </div>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedJob.error_message && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    {selectedJob.error_message}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
