'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@crm-eco/ui';
import {
  FileText,
  Search,
  Download,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  Calendar,
  User,
  Users,
  History,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RetroInvoice {
  id: string;
  invoice_number: string;
  member_id: string | null;
  status: string;
  total: number;
  balance_due: number;
  due_date: string | null;
  retro_reason: string | null;
  generation_job_id: string | null;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface RetroJob {
  id: string;
  job_name: string;
  job_type: string;
  billing_period_start: string;
  billing_period_end: string;
  retro_reason: string | null;
  status: string;
  total_invoices: number;
  successful_invoices: number;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_at: string;
  details: Record<string, unknown>;
  performer?: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function RetroInvoicingPage() {
  const [retroInvoices, setRetroInvoices] = useState<RetroInvoice[]>([]);
  const [retroJobs, setRetroJobs] = useState<RetroJob[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'invoices' | 'jobs' | 'audit'>('invoices');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<RetroInvoice | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function getOrgId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setOrganizationId(profile.organization_id);
      }
    }

    getOrgId();
  }, [supabase]);

  const fetchData = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      // Fetch retro invoices
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select(
          `
          id,
          invoice_number,
          member_id,
          status,
          total,
          balance_due,
          due_date,
          retro_reason,
          generation_job_id,
          created_at,
          member:members(first_name, last_name, email)
        `
        )
        .eq('organization_id', organizationId)
        .eq('is_retro', true)
        .order('created_at', { ascending: false });

      if (invError && invError.code !== '42P01') throw invError;
      setRetroInvoices((invoices || []) as unknown as RetroInvoice[]);

      // Fetch retro jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('invoice_generation_jobs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_retro', true)
        .order('created_at', { ascending: false });

      if (jobsError && jobsError.code !== '42P01') throw jobsError;
      setRetroJobs((jobs || []) as RetroJob[]);

      // Fetch audit log
      const { data: audit, error: auditError } = await supabase
        .from('financial_audit_log')
        .select(
          `
          id,
          action,
          entity_type,
          entity_id,
          performed_at,
          details,
          performer:profiles(first_name, last_name)
        `
        )
        .eq('organization_id', organizationId)
        .or('action.ilike.%retro%,details->is_retro.eq.true')
        .order('performed_at', { ascending: false })
        .limit(100);

      if (auditError && auditError.code !== '42P01') throw auditError;
      setAuditLog((audit || []) as unknown as AuditEntry[]);
    } catch (error) {
      console.error('Error fetching retro data:', error);
      toast.error('Failed to load retro invoicing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  // Filter invoices by search
  const filteredInvoices = retroInvoices.filter((inv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(query) ||
      inv.member?.first_name?.toLowerCase().includes(query) ||
      inv.member?.last_name?.toLowerCase().includes(query) ||
      inv.retro_reason?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats
  const totalRetroAmount = retroInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalRetroCount = retroInvoices.length;
  const pendingRetro = retroInvoices.filter((inv) => inv.status !== 'paid').length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-700">Sent</Badge>;
      case 'draft':
        return <Badge className="bg-slate-100 text-slate-700">Draft</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const exportRetroInvoices = () => {
    const csv = [
      ['Invoice #', 'Member', 'Total', 'Balance', 'Status', 'Reason', 'Created'].join(','),
      ...retroInvoices.map((inv) =>
        [
          inv.invoice_number,
          `"${inv.member?.first_name || ''} ${inv.member?.last_name || ''}"`,
          inv.total,
          inv.balance_due,
          inv.status,
          `"${inv.retro_reason || ''}"`,
          format(new Date(inv.created_at), 'yyyy-MM-dd'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retro-invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Retro Invoicing</h1>
            <p className="text-muted-foreground">Manage retroactive invoices and audit trail</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportRetroInvoices}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/invoices/generate/individual">
            <Button variant="outline">
              <User className="h-4 w-4 mr-2" />
              Individual Retro
            </Button>
          </Link>
          <Link href="/invoices/generate/group">
            <Button>
              <Users className="h-4 w-4 mr-2" />
              Group Retro
            </Button>
          </Link>
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Retroactive Invoice Guidelines</p>
              <p className="text-sm text-amber-700 mt-1">
                Retroactive invoices should only be created for legitimate reasons such as missed billing
                cycles, plan changes, or corrections. All retro invoices are logged for audit purposes and
                require a documented reason.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <History className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Retro Invoices</p>
                <p className="text-xl font-bold">{totalRetroCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold">{formatCurrency(totalRetroAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{pendingRetro}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Batch Jobs</p>
                <p className="text-xl font-bold">{retroJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === 'invoices' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('invoices')}
        >
          <FileText className="h-4 w-4 mr-2" />
          Invoices ({retroInvoices.length})
        </Button>
        <Button
          variant={activeTab === 'jobs' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('jobs')}
        >
          <Users className="h-4 w-4 mr-2" />
          Batch Jobs ({retroJobs.length})
        </Button>
        <Button
          variant={activeTab === 'audit' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('audit')}
        >
          <History className="h-4 w-4 mr-2" />
          Audit Log ({auditLog.length})
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'invoices' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Retro Invoices</CardTitle>
                <CardDescription>All retroactively generated invoices</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : paginatedInvoices.length === 0 ? (
              <div className="text-center py-16">
                <History className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-medium">No Retro Invoices</p>
                <p className="text-sm text-muted-foreground">
                  No retroactive invoices have been generated yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Invoice #</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Member</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Total</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Reason</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Created</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Retro
                            </Badge>
                            <span className="font-mono text-sm">{invoice.invoice_number}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {invoice.member ? (
                            <p className="font-medium">
                              {invoice.member.first_name} {invoice.member.last_name}
                            </p>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(invoice.status)}</td>
                        <td className="py-3 px-4">
                          <p className="text-sm truncate max-w-48" title={invoice.retro_reason || ''}>
                            {invoice.retro_reason || '—'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowDetailModal(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'jobs' && (
        <Card>
          <CardHeader>
            <CardTitle>Batch Generation Jobs</CardTitle>
            <CardDescription>Retro invoice batch generation history</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : retroJobs.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-medium">No Batch Jobs</p>
                <p className="text-sm text-muted-foreground">
                  No retro batch generation jobs have been run
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Job Name</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Period</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Invoices</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Reason</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retroJobs.map((job) => (
                      <tr key={job.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{job.job_name}</td>
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(job.billing_period_start), 'MMM d')} -{' '}
                          {format(new Date(job.billing_period_end), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-medium">{job.successful_invoices}</span>
                          <span className="text-muted-foreground"> / {job.total_invoices}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {formatCurrency(job.total_amount)}
                        </td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(job.status)}</td>
                        <td className="py-3 px-4">
                          <p className="text-sm truncate max-w-32" title={job.retro_reason || ''}>
                            {job.retro_reason || '—'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(job.created_at), 'MMM d, yyyy HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Retro invoicing activity and changes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : auditLog.length === 0 ? (
              <div className="text-center py-16">
                <History className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-medium">No Audit Entries</p>
                <p className="text-sm text-muted-foreground">No retro invoicing activity recorded yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{entry.action.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.entity_type} • {entry.entity_id?.slice(0, 8)}...
                        </p>
                        {entry.details && (
                          <p className="text-sm mt-1">
                            {(entry.details as any).invoice_number && (
                              <span className="font-mono">{(entry.details as any).invoice_number}</span>
                            )}
                            {(entry.details as any).total_amount && (
                              <span> • {formatCurrency((entry.details as any).total_amount)}</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.performed_at), 'MMM d, yyyy HH:mm')}
                        </p>
                        {entry.performer && (
                          <p className="text-xs text-muted-foreground">
                            by {entry.performer.first_name} {entry.performer.last_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retro Invoice Details</DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                <div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 mb-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Retroactive Invoice
                  </Badge>
                  <p className="font-mono text-lg font-bold">{selectedInvoice.invoice_number}</p>
                </div>
                {getStatusBadge(selectedInvoice.status)}
              </div>

              {selectedInvoice.member && (
                <div>
                  <p className="text-sm text-muted-foreground">Member</p>
                  <p className="font-medium">
                    {selectedInvoice.member.first_name} {selectedInvoice.member.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.member.email}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedInvoice.total)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Due</p>
                  <p className={`text-xl font-bold ${selectedInvoice.balance_due > 0 ? 'text-amber-600' : ''}`}>
                    {formatCurrency(selectedInvoice.balance_due)}
                  </p>
                </div>
              </div>

              {selectedInvoice.retro_reason && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Reason for Retroactive Invoice</p>
                  <p className="text-sm">{selectedInvoice.retro_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                {selectedInvoice.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p>{format(new Date(selectedInvoice.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedInvoice.created_at), 'MMM d, yyyy')}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Close
            </Button>
            <Link href="/invoices">
              <Button>View All Invoices</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
