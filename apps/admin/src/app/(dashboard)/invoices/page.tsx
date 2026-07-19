'use client';

import { ArrowClockwise, Calendar, CaretLeft, CaretRight, CheckCircle, Clock, CurrencyDollar, DownloadSimple, EnvelopeSimple, Eye, FileText, MagnifyingGlass, PaperPlaneTilt, Plus, User, Users, Warning } from '@phosphor-icons/react';
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
import { StatusBadge } from '@crm-eco/ui/components/status-badge';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

/** Invoice row with optional joined contact (crm_record) */
interface InvoiceView {
  id: string;
  invoice_number: string;
  contact_id: string | null;
  status: string | null;
  subtotal: number | null;
  discount_value: number | null;
  tax_amount: number | null;
  total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  is_retro: boolean | null;
  generation_job_id: string | null;
  created_at: string | null;
  contact?: {
    id: string;
    title: string | null;
    email: string | null;
  } | null;
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
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
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceView | null>(null);

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
          id, invoice_number, contact_id, status, subtotal, discount_value, tax_amount,
          total, amount_paid, balance_due, due_date, sent_at, paid_at, is_retro,
          generation_job_id, created_at,
          contact:crm_records!contact_id(id, title, email)
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
      setInvoices((data || []) as unknown as InvoiceView[]);
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
      inv.contact?.title?.toLowerCase().includes(query) ||
      inv.contact?.email?.toLowerCase().includes(query)
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
    // "overdue" is derived (unpaid + past due date), not a stored status.
    const isOverdue = status !== 'paid' && dueDate && new Date(dueDate) < new Date();
    const effective = isOverdue ? 'overdue' : status;
    const label = effective ? effective.charAt(0).toUpperCase() + effective.slice(1) : status;
    return <StatusBadge status={effective} label={label} />;
  };

  const handleSendInvoice = async (invoice: InvoiceView) => {
    try {
      const { error } = await (supabase as any)
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (error) throw error;

      await (supabase as any).from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'invoice_sent',
        entity_type: 'invoice',
        entity_id: invoice.id,
        performed_by: profileId,
        details: { invoice_number: invoice.invoice_number, contact_id: invoice.contact_id },
      });

      toast.success('Invoice sent');
      fetchInvoices();
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice');
    }
  };

  const handleMarkPaid = async (invoice: InvoiceView) => {
    try {
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
          `"${inv.contact?.title || ''}"`,
          inv.contact?.email || '',
          inv.total,
          inv.amount_paid,
          inv.balance_due,
          inv.status,
          inv.due_date || '',
          inv.is_retro ? 'Yes' : 'No',
          inv.created_at ? format(new Date(inv.created_at), 'yyyy-MM-dd') : '',
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Invoices</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage and generate member invoices</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Link href="/invoices/groups">
            <Button variant="outline" size="sm">
              <Users weight="light" className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Groups</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={exportInvoices}>
            <DownloadSimple weight="light" className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Link href="/invoices/generate/group">
            <Button variant="outline" size="sm">
              <Users weight="light" className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Gen Group</span>
            </Button>
          </Link>
          <Link href="/invoices/generate/individual">
            <Button size="sm">
              <Plus weight="light" className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Generate</span>
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
                <FileText weight="light" className="h-5 w-5 text-slate-600" />
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
                <CheckCircle weight="light" className="h-5 w-5 text-emerald-600" />
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
                <Clock weight="light" className="h-5 w-5 text-amber-600" />
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
                <Warning weight="light" className="h-5 w-5 text-red-600" />
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
              <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="MagnifyingGlass invoices..."
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
                <ArrowClockwise weight="light" className="h-4 w-4" />
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
              <ArrowClockwise weight="light" className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : paginatedInvoices.length === 0 ? (
            <div className="text-center py-16">
              <FileText weight="light" className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-lg font-medium">No invoices found</p>
              <p className="text-sm text-muted-foreground mb-4">Generate your first invoice to get started</p>
              <Link href="/invoices/generate/individual">
                <Button>
                  <Plus weight="light" className="h-4 w-4 mr-2" />
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
                        {invoice.contact ? (
                          <div>
                            <p className="font-medium">
                              {invoice.contact.title || '—'}
                            </p>
                            <p className="text-sm text-muted-foreground">{invoice.contact.email || ''}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(invoice.total ?? 0)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={(invoice.balance_due ?? 0) > 0 ? 'text-amber-600 font-medium' : ''}>
                          {formatCurrency(invoice.balance_due ?? 0)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(invoice.status ?? '', invoice.due_date)}</td>
                      <td className="py-3 px-4">
                        {invoice.due_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar weight="light" className="h-4 w-4 text-muted-foreground" />
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
                            <Eye weight="light" className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'draft' && (
                            <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice)}>
                              <PaperPlaneTilt weight="light" className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          {invoice.status !== 'paid' && (invoice.balance_due ?? 0) > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(invoice)}>
                              <CheckCircle weight="light" className="h-4 w-4 text-emerald-500" />
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
                <CaretLeft weight="light" className="h-4 w-4" />
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
                <CaretRight weight="light" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
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
                {getStatusBadge(selectedInvoice.status ?? '', selectedInvoice.due_date)}
              </div>

              {selectedInvoice.contact && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <User weight="light" className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {selectedInvoice.contact.title || '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.contact.email || ''}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="font-medium">{formatCurrency(selectedInvoice.subtotal ?? 0)}</p>
                </div>
                {(selectedInvoice.discount_value ?? 0) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Discount</p>
                    <p className="font-medium text-emerald-600">-{formatCurrency(selectedInvoice.discount_value ?? 0)}</p>
                  </div>
                )}
                {(selectedInvoice.tax_amount ?? 0) > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tax</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.tax_amount ?? 0)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedInvoice.total ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="font-medium text-emerald-600">{formatCurrency(selectedInvoice.amount_paid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Due</p>
                  <p className={`font-bold ${(selectedInvoice.balance_due ?? 0) > 0 ? 'text-amber-600' : ''}`}>
                    {formatCurrency(selectedInvoice.balance_due ?? 0)}
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
                  <p>{selectedInvoice.created_at ? format(new Date(selectedInvoice.created_at), 'MMM d, yyyy') : '—'}</p>
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
                <PaperPlaneTilt weight="light" className="h-4 w-4 mr-2" />
                PaperPlaneTilt Invoice
              </Button>
            )}
            {selectedInvoice?.status !== 'paid' && selectedInvoice?.balance_due && selectedInvoice.balance_due > 0 && (
              <Button
                onClick={() => {
                  handleMarkPaid(selectedInvoice);
                  setShowDetailModal(false);
                }}
              >
                <CheckCircle weight="light" className="h-4 w-4 mr-2" />
                Mark Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
