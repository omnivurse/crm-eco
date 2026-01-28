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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui';
import {
  FileText,
  Search,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  Calendar,
  DollarSign,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  invoice_number: string;
  member_id: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  is_retro: boolean;
  generation_job_id: string | null;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showRetroOnly, setShowRetroOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function getOrgId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  const fetchInvoices = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('invoices')
        .select(
          `
          *,
          member:members(first_name, last_name, email)
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (showRetroOnly) {
        query = query.eq('is_retro', true);
      }

      const { data, error } = await query.limit(500);

      if (error && error.code !== '42P01') throw error;
      setInvoices((data || []) as Invoice[]);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchInvoices();
    }
  }, [organizationId, statusFilter, showRetroOnly]);

  // Filter by search
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(query) ||
      inv.member?.first_name?.toLowerCase().includes(query) ||
      inv.member?.last_name?.toLowerCase().includes(query) ||
      inv.member?.email?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const paidAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const outstandingAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);
  const overdueCount = filteredInvoices.filter(
    (inv) => inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date()
  ).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const isOverdue = status !== 'paid' && dueDate && new Date(dueDate) < new Date();

    if (isOverdue) {
      return (
        <Badge className="bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }

    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <Send className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case 'draft':
        return (
          <Badge className="bg-slate-100 text-slate-700">
            <FileText className="w-3 h-3 mr-1" />
            Draft
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'invoice_sent',
        entity_type: 'invoice',
        entity_id: invoice.id,
        performed_by: profileId,
        details: { invoice_number: invoice.invoice_number, member_id: invoice.member_id },
      });

      toast.success('Invoice sent');
      fetchInvoices();
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice');
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          amount_paid: invoice.total,
          balance_due: 0,
        })
        .eq('id', invoice.id);

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'invoice_paid',
        entity_type: 'invoice',
        entity_id: invoice.id,
        performed_by: profileId,
        details: { invoice_number: invoice.invoice_number, amount: invoice.total },
      });

      toast.success('Invoice marked as paid');
      fetchInvoices();
    } catch (error) {
      console.error('Error marking invoice paid:', error);
      toast.error('Failed to update invoice');
    }
  };

  const exportInvoices = () => {
    const csv = [
      ['Invoice #', 'Member', 'Email', 'Total', 'Paid', 'Balance', 'Status', 'Due Date', 'Retro', 'Created'].join(
        ','
      ),
      ...filteredInvoices.map((inv) =>
        [
          inv.invoice_number,
          `"${inv.member?.first_name || ''} ${inv.member?.last_name || ''}"`,
          inv.member?.email || '',
          inv.total,
          inv.amount_paid,
          inv.balance_due,
          inv.status,
          inv.due_date || '',
          inv.is_retro ? 'Yes' : 'No',
          format(new Date(inv.created_at), 'yyyy-MM-dd'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage and generate member invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/invoices/groups">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Invoice Groups
            </Button>
          </Link>
          <Button variant="outline" onClick={exportInvoices}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/invoices/generate/group">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Generate Group
            </Button>
          </Link>
          <Link href="/invoices/generate/individual">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invoiced</p>
                <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-xl font-bold">{formatCurrency(paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold">{formatCurrency(outstandingAmount)}</p>
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
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-xl font-bold">{overdueCount}</p>
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
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className="border rounded px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showRetroOnly}
                  onChange={(e) => setShowRetroOnly(e.target.checked)}
                  className="rounded"
                />
                Retro only
              </label>
              <Button variant="outline" size="sm" onClick={fetchInvoices}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : paginatedInvoices.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-lg font-medium">No invoices found</p>
              <p className="text-sm text-muted-foreground mb-4">Generate your first invoice to get started</p>
              <Link href="/invoices/generate/individual">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Invoice
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Invoice #</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Member</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Total</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Balance</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Due Date</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{invoice.invoice_number}</span>
                          {invoice.is_retro && (
                            <Badge variant="outline" className="text-xs">
                              Retro
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {invoice.member ? (
                          <div>
                            <p className="font-medium">
                              {invoice.member.first_name} {invoice.member.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{invoice.member.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(invoice.total)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={invoice.balance_due > 0 ? 'text-amber-600 font-medium' : ''}>
                          {formatCurrency(invoice.balance_due)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(invoice.status, invoice.due_date)}</td>
                      <td className="py-3 px-4">
                        {invoice.due_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
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
                          {invoice.status === 'draft' && (
                            <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice)}>
                              <Send className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          {invoice.status !== 'paid' && invoice.balance_due > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(invoice)}>
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

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
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-mono text-lg font-bold">{selectedInvoice.invoice_number}</p>
                  {selectedInvoice.is_retro && (
                    <Badge variant="outline" className="mt-1">
                      Retroactive Invoice
                    </Badge>
                  )}
                </div>
                {getStatusBadge(selectedInvoice.status, selectedInvoice.due_date)}
              </div>

              {selectedInvoice.member && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {selectedInvoice.member.first_name} {selectedInvoice.member.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.member.email}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</p>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Discount</p>
                    <p className="font-medium text-emerald-600">-{formatCurrency(selectedInvoice.discount_amount)}</p>
                  </div>
                )}
                {selectedInvoice.tax_amount > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tax</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.tax_amount)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedInvoice.total)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="font-medium text-emerald-600">{formatCurrency(selectedInvoice.amount_paid)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Due</p>
                  <p className={`font-bold ${selectedInvoice.balance_due > 0 ? 'text-amber-600' : ''}`}>
                    {formatCurrency(selectedInvoice.balance_due)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                {selectedInvoice.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p>{format(new Date(selectedInvoice.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {selectedInvoice.sent_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p>{format(new Date(selectedInvoice.sent_at), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {selectedInvoice.paid_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p>{format(new Date(selectedInvoice.paid_at), 'MMM d, yyyy')}</p>
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
            {selectedInvoice?.status === 'draft' && (
              <Button
                onClick={() => {
                  handleSendInvoice(selectedInvoice);
                  setShowDetailModal(false);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            {selectedInvoice?.status !== 'paid' && selectedInvoice?.balance_due && selectedInvoice.balance_due > 0 && (
              <Button
                onClick={() => {
                  handleMarkPaid(selectedInvoice);
                  setShowDetailModal(false);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
