'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Receipt,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  Copy,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Calendar,
  FileText,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface Invoice {
  id: string;
  invoice_number: string;
  title: string | null;
  status: string;
  subtotal: number;
  discount_value: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
  created_at: string;
  contact?: { id: string; title: string }[] | null;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-600', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-500/10 text-blue-600', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-500/10 text-purple-600', icon: Eye },
  paid: { label: 'Paid', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  partial: { label: 'Partial', color: 'bg-amber-500/10 text-amber-600', icon: CreditCard },
  overdue: { label: 'Overdue', color: 'bg-red-500/10 text-red-600', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500/10 text-slate-500', icon: XCircle },
};

// ============================================================================
// Components
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function InvoiceCard({
  invoice,
  onEdit,
  onDelete,
  onDuplicate,
  onSend,
  onMarkPaid,
}: {
  invoice: Invoice;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onMarkPaid: () => void;
}) {
  const status = STATUS_OPTIONS[invoice.status] || STATUS_OPTIONS.draft;
  const StatusIcon = status.icon;
  const contactName = invoice.contact?.[0]?.title || 'No contact';
  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-violet-500/50 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-violet-600 dark:text-violet-400">
              {invoice.invoice_number}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
              isOverdue ? 'bg-red-500/10 text-red-600' : status.color
            )}>
              <StatusIcon className="w-3 h-3" />
              {isOverdue ? 'Overdue' : status.label}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {invoice.title || 'Untitled Invoice'}
          </h3>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Invoice
            </DropdownMenuItem>
            {invoice.status === 'draft' && (
              <DropdownMenuItem onClick={onSend}>
                <Send className="w-4 h-4 mr-2" />
                Send Invoice
              </DropdownMenuItem>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <DropdownMenuItem onClick={onMarkPaid}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Paid
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
        <span className="flex items-center gap-1">
          <User className="w-4 h-4" />
          {contactName}
        </span>
        {invoice.due_date && (
          <span className={cn('flex items-center gap-1', isOverdue && 'text-red-500')} suppressHydrationWarning>
            <Calendar className="w-4 h-4" />
            Due {new Date(invoice.due_date).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
        <div>
          {invoice.amount_paid > 0 && invoice.status !== 'paid' && (
            <span className="text-xs text-emerald-600">
              Paid: {formatCurrency(invoice.amount_paid)}
            </span>
          )}
          {invoice.balance_due > 0 && invoice.status !== 'paid' && (
            <span className="text-xs text-slate-500 ml-2">
              Due: {formatCurrency(invoice.balance_due)}
            </span>
          )}
        </div>
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {formatCurrency(invoice.total)}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function InvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrganizationId(profile.organization_id);

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          title,
          status,
          subtotal,
          discount_value,
          tax_amount,
          total,
          amount_paid,
          balance_due,
          due_date,
          created_at,
          contact:crm_records!invoices_contact_id_fkey(id, title)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((data || []) as unknown as Invoice[]);
    } catch (error) {
      console.error('Error loading invoices:', error);
      // Table might not exist yet
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}?`)) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;
      toast.success('Invoice deleted successfully');
      await loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice');
    }
  }

  async function handleDuplicateInvoice(invoice: Invoice) {
    if (!organizationId) return;

    try {
      const { data: nextNumberData } = await supabase.rpc('generate_invoice_number', {
        org_id: organizationId,
      });

      const { error } = await supabase
        .from('invoices')
        .insert({
          organization_id: organizationId,
          invoice_number: nextNumberData || `INV-${Date.now()}`,
          title: `${invoice.title || 'Invoice'} (Copy)`,
          status: 'draft',
          subtotal: invoice.subtotal,
          discount_value: invoice.discount_value,
          tax_amount: invoice.tax_amount,
          total: invoice.total,
          amount_paid: 0,
          balance_due: invoice.total,
        });

      if (error) throw error;
      toast.success('Invoice duplicated successfully');
      await loadInvoices();
    } catch (error) {
      console.error('Error duplicating invoice:', error);
      toast.error('Failed to duplicate invoice');
    }
  }

  async function handleSendInvoice(invoice: Invoice) {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (error) throw error;
      toast.success('Invoice sent successfully');
      await loadInvoices();
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice');
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          amount_paid: invoice.total,
          balance_due: 0,
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (error) throw error;
      toast.success('Invoice marked as paid');
      await loadInvoices();
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      toast.error('Failed to update invoice');
    }
  }

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = !searchQuery ||
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalValue = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const paidValue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
  const pendingValue = invoices.filter(i => ['sent', 'viewed'].includes(i.status)).reduce((sum, i) => sum + (i.balance_due || 0), 0);
  const overdueCount = invoices.filter(i => {
    return i.due_date && new Date(i.due_date) < new Date() && i.status !== 'paid' && i.status !== 'cancelled';
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl">
            <Receipt className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Generate and track invoices for your clients
            </p>
          </div>
        </div>

        <Link href="/crm/invoices/new">
          <Button className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400">
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Invoiced" value={formatCurrency(totalValue)} icon={Receipt} color="violet" />
        <StatCard label="Paid" value={formatCurrency(paidValue)} icon={CheckCircle2} color="emerald" />
        <StatCard label="Outstanding" value={formatCurrency(pendingValue)} icon={Clock} color="amber" />
        <StatCard label="Overdue" value={overdueCount} icon={AlertCircle} color="red" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoices..."
            className="pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All Status</option>
          {Object.entries(STATUS_OPTIONS).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Invoices Grid */}
      {filteredInvoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onEdit={() => router.push(`/crm/invoices/${invoice.id}/edit`)}
              onDelete={() => handleDeleteInvoice(invoice)}
              onDuplicate={() => handleDuplicateInvoice(invoice)}
              onSend={() => handleSendInvoice(invoice)}
              onMarkPaid={() => handleMarkPaid(invoice)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-4">
            <Receipt className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-900 dark:text-white font-medium mb-1">
            {searchQuery || statusFilter !== 'all' ? 'No matching invoices' : 'No invoices yet'}
          </p>
          <p className="text-slate-500 text-sm mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Generate and send invoices to your clients'
            }
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link href="/crm/invoices/new">
              <Button className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400">
                <Plus className="w-4 h-4 mr-2" />
                Create First Invoice
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
