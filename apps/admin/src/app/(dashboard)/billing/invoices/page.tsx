'use client';

import { ArrowClockwise, CircleNotch, DownloadSimple, Eye, FileText, PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format, addDays } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';

/** Invoice row with optional joined contact for the billing view */
interface BillingInvoiceView {
  id: string;
  invoice_number: string;
  contact_id: string | null;
  due_date: string | null;
  subtotal: number | null;
  discount_value: number | null;
  tax_amount: number | null;
  total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  status: string | null;
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_at: string | null;
  contact?: {
    id: string;
    title: string | null;
    email: string | null;
  } | null;
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'sent':
      return 'bg-blue-100 text-blue-800';
    case 'partial':
      return 'bg-yellow-100 text-yellow-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
    case 'void':
      return 'bg-slate-100 text-slate-500 line-through';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

import type { Member } from '@crm-eco/lib/types';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<BillingInvoiceView[]>([]);
  const [members, setMembers] = useState<Pick<Member, 'id' | 'first_name' | 'last_name' | 'email'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    memberId: '',
    amount: '',
    dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    notes: '',
  });
  const supabase = createClient();

  useEffect(() => {
    loadInvoices();
    loadMembers();
  }, [filter]);

  async function loadMembers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) return;

      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, email')
        .eq('organization_id', profile.organization_id)
        .order('last_name');

      setMembers((data || []) as Pick<Member, 'id' | 'first_name' | 'last_name' | 'email'>[]);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  }

  async function createInvoice() {
    if (!newInvoice.memberId || !newInvoice.amount) {
      toast.error('Please select a member and enter an amount');
      return;
    }

    setCreatingInvoice(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) return;

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { error } = await (supabase.from('invoices') as any).insert({
        organization_id: profile.organization_id,
        contact_id: newInvoice.memberId,
        invoice_number: invoiceNumber,
        due_date: newInvoice.dueDate,
        subtotal: parseFloat(newInvoice.amount),
        discount_value: 0,
        tax_amount: 0,
        total: parseFloat(newInvoice.amount),
        amount_paid: 0,
        balance_due: parseFloat(newInvoice.amount),
        status: 'draft',
        notes: newInvoice.notes || null,
      });

      if (error) {
        toast.error('Failed to create invoice');
        console.error(error);
      } else {
        toast.success(`Invoice ${invoiceNumber} created`);
        setShowNewInvoice(false);
        setNewInvoice({
          memberId: '',
          amount: '',
          dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
          notes: '',
        });
        await loadInvoices();
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setCreatingInvoice(false);
    }
  }

  async function loadInvoices() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) return;

      let query = (supabase.from('invoices') as any)
        .select(`
          id, invoice_number, contact_id, due_date, subtotal, discount_value,
          tax_amount, total, amount_paid, balance_due, status, sent_at, paid_at,
          notes, pdf_url, created_at,
          contact:crm_records!contact_id(id, title, email)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error loading invoices:', error);
        toast.error('Failed to load invoices');
      } else {
        setInvoices((data || []) as unknown as BillingInvoiceView[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendInvoice(invoice: BillingInvoiceView) {
    setProcessingId(invoice.id);
    try {
      // Update invoice status to sent
      const { error } = await (supabase.from('invoices') as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (error) {
        toast.error('Failed to send invoice');
      } else {
        toast.success(`Invoice ${invoice.invoice_number} sent to ${invoice.contact?.email || 'recipient'}`);
        await loadInvoices();
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  }

  async function markAsPaid(invoice: BillingInvoiceView) {
    setProcessingId(invoice.id);
    try {
      const { error } = await (supabase.from('invoices') as any)
        .update({
          status: 'paid',
          amount_paid: invoice.total,
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (error) {
        toast.error('Failed to update invoice');
      } else {
        toast.success(`Invoice ${invoice.invoice_number} marked as paid`);
        await loadInvoices();
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <CircleNotch weight="light" className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    pending: invoices.filter(i => i.status !== null && ['sent', 'partial'].includes(i.status)).length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    draft: invoices.filter(i => i.status === 'draft').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/billing"
        backLabel="Back to billing"
        title="Invoices"
        description={`${stats.total} total invoices`}
        icon={<FileText weight="light" className="w-6 h-6" />}
        gradient="from-amber-500 to-orange-400"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={loadInvoices}>
              <ArrowClockwise weight="light" className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowNewInvoice(true)}>
              <Plus weight="light" className="h-4 w-4 mr-2" />
              New invoice
            </Button>
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('all')}>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-slate-500">Total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('paid')}>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
            <p className="text-sm text-slate-500">Paid</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('sent')}>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
            <p className="text-sm text-slate-500">Pending</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('overdue')}>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
            <p className="text-sm text-slate-500">Overdue</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('draft')}>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            <p className="text-sm text-slate-500">Draft</p>
          </CardContent>
        </Card>
      </div>

      {/* New Invoice Dialog */}
      <Dialog open={showNewInvoice} onOpenChange={setShowNewInvoice}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>
              Create a manual invoice for a member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member">Member</Label>
              <Select
                value={newInvoice.memberId}
                onValueChange={(value) => setNewInvoice({ ...newInvoice, memberId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newInvoice.amount}
                onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={newInvoice.dueDate}
                onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Invoice notes..."
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewInvoice(false)}>
              Cancel
            </Button>
            <Button onClick={createInvoice} disabled={creatingInvoice}>
              {creatingInvoice ? (
                <>
                  <CircleNotch weight="light" className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Invoice'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {filter === 'all' ? 'All Invoices' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Invoices`}
          </CardTitle>
          {filter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>
              Clear Filter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-slate-500 text-sm">Invoice #</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Member</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Period</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Due Date</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Amount</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length > 0 ? (
                  invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText weight="light" className="h-4 w-4 text-slate-400" />
                          <span className="font-mono font-medium">{invoice.invoice_number}</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm">
                        {invoice.contact ? (
                          <span className="text-blue-600">
                            {invoice.contact.title || 'Unknown'}
                          </span>
                        ) : (
                          <span className="text-slate-400">Unknown</span>
                        )}
                      </td>
                      <td className="py-3 text-sm text-slate-600">
                        {invoice.created_at
                          ? format(new Date(invoice.created_at), 'MMM d, yyyy')
                          : '—'}
                      </td>
                      <td className="py-3 text-sm">
                        <span className={invoice.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                          {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '—'}
                        </span>
                      </td>
                      <td className="py-3 text-sm">
                        <p className="font-semibold">${(invoice.total ?? 0).toFixed(2)}</p>
                        {(invoice.amount_paid ?? 0) > 0 && (invoice.amount_paid ?? 0) < (invoice.total ?? 0) && (
                          <p className="text-xs text-slate-500">
                            Paid: ${(invoice.amount_paid ?? 0).toFixed(2)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(invoice.status ?? '')}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 text-sm">
                        <div className="flex gap-1">
                          {invoice.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => sendInvoice(invoice)}
                              disabled={processingId === invoice.id}
                            >
                              <PaperPlaneTilt weight="light" className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.status !== null && ['sent', 'partial', 'overdue'].includes(invoice.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsPaid(invoice)}
                              disabled={processingId === invoice.id}
                            >
                              Mark Paid
                            </Button>
                          )}
                          {invoice.pdf_url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                <DownloadSimple weight="light" className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost">
                            <Eye weight="light" className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      <FileText weight="light" className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      No invoices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
