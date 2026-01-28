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
  DollarSign,
  Search,
  Filter,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Building2,
  User,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Payable {
  id: string;
  payee_type: string;
  payee_id: string | null;
  payee_name: string;
  payee_email: string | null;
  reference_number: string | null;
  description: string | null;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  source_type: string | null;
  notes: string | null;
  created_at: string;
  category?: {
    name: string;
  } | null;
}

interface PayableCategory {
  id: string;
  name: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'processing' | 'paid' | 'on_hold';
type PayeeTypeFilter = 'all' | 'agent' | 'vendor' | 'provider' | 'other';

const emptyPayable = {
  payee_type: 'vendor' as const,
  payee_name: '',
  payee_email: '',
  category_id: '',
  reference_number: '',
  description: '',
  amount: '',
  due_date: format(new Date(), 'yyyy-MM-dd'),
  payment_method: '',
  notes: '',
};

export default function PayablesPage() {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [categories, setCategories] = useState<PayableCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [payeeTypeFilter, setPayeeTypeFilter] = useState<PayeeTypeFilter>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
  const [formData, setFormData] = useState(emptyPayable);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

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

  const fetchPayables = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('payables')
        .select(
          `
          *,
          category:payable_categories(name)
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (payeeTypeFilter !== 'all') {
        query = query.eq('payee_type', payeeTypeFilter);
      }

      const { data, error } = await query.limit(500);

      if (error && error.code !== '42P01') throw error;
      setPayables((data || []) as Payable[]);
    } catch (error) {
      console.error('Error fetching payables:', error);
      toast.error('Failed to load payables');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('payable_categories')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error && error.code !== '42P01') throw error;
      setCategories((data || []) as PayableCategory[]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchPayables();
      fetchCategories();
    }
  }, [organizationId, statusFilter, payeeTypeFilter]);

  // Filter by search
  const filteredPayables = payables.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.payee_name.toLowerCase().includes(query) ||
      p.payee_email?.toLowerCase().includes(query) ||
      p.reference_number?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredPayables.length / pageSize);
  const paginatedPayables = filteredPayables.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats
  const totalAmount = filteredPayables.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingAmount = filteredPayables
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const approvedAmount = filteredPayables
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const overdueAmount = filteredPayables
    .filter((p) => ['pending', 'approved'].includes(p.status) && p.due_date && new Date(p.due_date) < new Date())
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const isOverdue =
      ['pending', 'approved'].includes(status) && dueDate && new Date(dueDate) < new Date();

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
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-purple-100 text-purple-700">
            <RefreshCw className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        );
      case 'on_hold':
        return (
          <Badge className="bg-slate-100 text-slate-700">
            <XCircle className="w-3 h-3 mr-1" />
            On Hold
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPayeeTypeIcon = (type: string) => {
    switch (type) {
      case 'agent':
        return <User className="h-4 w-4 text-teal-500" />;
      case 'vendor':
        return <Building2 className="h-4 w-4 text-blue-500" />;
      default:
        return <Building2 className="h-4 w-4 text-slate-500" />;
    }
  };

  const handleCreate = async () => {
    if (!formData.payee_name || !formData.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('payables')
        .insert({
          organization_id: organizationId,
          payee_type: formData.payee_type,
          payee_name: formData.payee_name,
          payee_email: formData.payee_email || null,
          category_id: formData.category_id || null,
          reference_number: formData.reference_number || null,
          description: formData.description || null,
          amount: parseFloat(formData.amount),
          due_date: formData.due_date || null,
          payment_method: formData.payment_method || null,
          notes: formData.notes || null,
          status: 'pending',
          created_by: profileId,
        })
        .select()
        .single();

      if (error) throw error;

      // Log to audit
      await supabase.from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'payable_created',
        entity_type: 'payable',
        entity_id: data.id,
        performed_by: profileId,
        details: {
          payee_name: formData.payee_name,
          amount: parseFloat(formData.amount),
        },
      });

      toast.success('Payable created');
      setShowCreateModal(false);
      setFormData(emptyPayable);
      fetchPayables();
    } catch (error) {
      console.error('Error creating payable:', error);
      toast.error('Failed to create payable');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (payable: Payable) => {
    try {
      const { error } = await supabase
        .from('payables')
        .update({
          status: 'approved',
          approved_by: profileId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', payable.id);

      if (error) throw error;

      await supabase.from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'payable_approved',
        entity_type: 'payable',
        entity_id: payable.id,
        performed_by: profileId,
        details: { payee_name: payable.payee_name, amount: payable.amount },
      });

      toast.success('Payable approved');
      fetchPayables();
    } catch (error) {
      console.error('Error approving payable:', error);
      toast.error('Failed to approve payable');
    }
  };

  const handleMarkPaid = async (payable: Payable) => {
    try {
      const { error } = await supabase
        .from('payables')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', payable.id);

      if (error) throw error;

      await supabase.from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'payable_paid',
        entity_type: 'payable',
        entity_id: payable.id,
        performed_by: profileId,
        details: { payee_name: payable.payee_name, amount: payable.amount },
      });

      toast.success('Payable marked as paid');
      fetchPayables();
    } catch (error) {
      console.error('Error marking payable as paid:', error);
      toast.error('Failed to update payable');
    }
  };

  const exportPayables = () => {
    const csv = [
      ['Payee', 'Type', 'Email', 'Amount', 'Status', 'Due Date', 'Paid Date', 'Reference', 'Description'].join(
        ','
      ),
      ...filteredPayables.map((p) =>
        [
          `"${p.payee_name}"`,
          p.payee_type,
          p.payee_email || '',
          p.amount,
          p.status,
          p.due_date || '',
          p.paid_date || '',
          p.reference_number || '',
          `"${p.description || ''}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payables-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payables</h1>
          <p className="text-muted-foreground">Manage accounts payable and vendor payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/payables/summary">
            <Button variant="outline">View Summary</Button>
          </Link>
          <Button variant="outline" onClick={exportPayables}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Payable
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
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
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{formatCurrency(pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-xl font-bold">{formatCurrency(approvedAmount)}</p>
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
                <p className="text-xl font-bold">{formatCurrency(overdueAmount)}</p>
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
                placeholder="Search payables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="border rounded px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
                <option value="paid">Paid</option>
                <option value="on_hold">On Hold</option>
              </select>
              <select
                className="border rounded px-3 py-2 text-sm"
                value={payeeTypeFilter}
                onChange={(e) => setPayeeTypeFilter(e.target.value as PayeeTypeFilter)}
              >
                <option value="all">All Types</option>
                <option value="agent">Agent</option>
                <option value="vendor">Vendor</option>
                <option value="provider">Provider</option>
                <option value="other">Other</option>
              </select>
              <Button variant="outline" size="sm" onClick={fetchPayables}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payables Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : paginatedPayables.length === 0 ? (
            <div className="text-center py-16">
              <DollarSign className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-lg font-medium">No payables found</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first payable to get started</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Payable
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Payee</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Due Date</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayables.map((payable) => (
                    <tr key={payable.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getPayeeTypeIcon(payable.payee_type)}
                          <div>
                            <p className="font-medium">{payable.payee_name}</p>
                            {payable.payee_email && (
                              <p className="text-sm text-muted-foreground">{payable.payee_email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="truncate max-w-48">{payable.description || '—'}</p>
                        {payable.reference_number && (
                          <p className="text-xs text-muted-foreground">Ref: {payable.reference_number}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(payable.amount)}</td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(payable.status, payable.due_date)}
                      </td>
                      <td className="py-3 px-4">
                        {payable.due_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{format(new Date(payable.due_date), 'MMM d, yyyy')}</span>
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
                              setSelectedPayable(payable);
                              setShowDetailModal(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {payable.status === 'pending' && (
                            <Button variant="ghost" size="sm" onClick={() => handleApprove(payable)}>
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          {payable.status === 'approved' && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(payable)}>
                              <DollarSign className="h-4 w-4 text-emerald-500" />
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
              {Math.min(currentPage * pageSize, filteredPayables.length)} of {filteredPayables.length}
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

      {/* Create Payable Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Payable</DialogTitle>
            <DialogDescription>Create a new payable record</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payee Type *</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={formData.payee_type}
                  onChange={(e) => setFormData({ ...formData, payee_type: e.target.value })}
                >
                  <option value="vendor">Vendor</option>
                  <option value="agent">Agent</option>
                  <option value="provider">Provider</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {categories.length > 0 && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Payee Name *</Label>
              <Input
                placeholder="Enter payee name"
                value={formData.payee_name}
                onChange={(e) => setFormData({ ...formData, payee_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Payee Email</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={formData.payee_email}
                onChange={(e) => setFormData({ ...formData, payee_email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                placeholder="Invoice #, PO #, etc."
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Enter description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Internal notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Payable
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payable Details</DialogTitle>
          </DialogHeader>

          {selectedPayable && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                {getPayeeTypeIcon(selectedPayable.payee_type)}
                <div>
                  <p className="font-semibold">{selectedPayable.payee_name}</p>
                  {selectedPayable.payee_email && (
                    <p className="text-sm text-muted-foreground">{selectedPayable.payee_email}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedPayable.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    {getStatusBadge(selectedPayable.status, selectedPayable.due_date)}
                  </div>
                </div>
                {selectedPayable.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p>{format(new Date(selectedPayable.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {selectedPayable.paid_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Date</p>
                    <p>{format(new Date(selectedPayable.paid_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>

              {selectedPayable.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{selectedPayable.description}</p>
                </div>
              )}

              {selectedPayable.reference_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-mono">{selectedPayable.reference_number}</p>
                </div>
              )}

              {selectedPayable.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedPayable.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm">{format(new Date(selectedPayable.created_at), 'PPpp')}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Close
            </Button>
            {selectedPayable?.status === 'pending' && (
              <Button
                onClick={() => {
                  handleApprove(selectedPayable);
                  setShowDetailModal(false);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}
            {selectedPayable?.status === 'approved' && (
              <Button
                onClick={() => {
                  handleMarkPaid(selectedPayable);
                  setShowDetailModal(false);
                }}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Mark Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
