'use client';

import {
  Buildings,
  CheckCircle,
  Clock,
  CurrencyDollar,
  Eye,
  Plus,
  User,
  Warning,
  XCircle,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createClient } from '@crm-eco/lib/supabase/client';
import { fetchSupabaseList } from '@crm-eco/lib/data-table';
import { Permissions } from '@crm-eco/lib/permissions';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ResourceList,
  Textarea,
  type ResourceDescriptor,
  useCan,
} from '@crm-eco/ui';

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
  category?: { name: string } | null;
}

interface PayableCategory {
  id: string;
  name: string;
}

const emptyPayable = {
  payee_type: 'vendor' as 'vendor' | 'agent' | 'provider' | 'other',
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function StatusBadge({ status, dueDate }: { status: string; dueDate: string | null }) {
  const isOverdue =
    ['pending', 'approved'].includes(status) && dueDate && new Date(dueDate) < new Date();

  if (isOverdue) {
    return (
      <Badge className="bg-red-100 text-red-700">
        <Warning weight="light" className="mr-1 h-3 w-3" />
        Overdue
      </Badge>
    );
  }

  switch (status) {
    case 'paid':
      return (
        <Badge className="bg-emerald-100 text-emerald-700">
          <CheckCircle weight="light" className="mr-1 h-3 w-3" />
          Paid
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-100 text-amber-700">
          <Clock weight="light" className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    case 'approved':
      return (
        <Badge className="bg-blue-100 text-blue-700">
          <CheckCircle weight="light" className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case 'processing':
      return (
        <Badge className="bg-purple-100 text-purple-700">
          <ArrowClockwise weight="light" className="mr-1 h-3 w-3" />
          Processing
        </Badge>
      );
    case 'on_hold':
      return (
        <Badge className="bg-slate-100 text-slate-700">
          <XCircle weight="light" className="mr-1 h-3 w-3" />
          On Hold
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function PayeeIcon({ type }: { type: string }) {
  if (type === 'agent') return <User weight="light" className="h-4 w-4 text-teal-500" />;
  if (type === 'vendor') return <Buildings weight="light" className="h-4 w-4 text-blue-500" />;
  return <Buildings weight="light" className="h-4 w-4 text-slate-500" />;
}

export default function PayablesPage() {
  const canApprove = useCan(Permissions.PayablesApprove);
  const canPay = useCan(Permissions.PayablesPay);
  const supabase = createClient();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [categories, setCategories] = useState<PayableCategory[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    overdue: 0,
  });
  const [listKey, setListKey] = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
  const [formData, setFormData] = useState(emptyPayable);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function bootstrap() {
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
      if (!profile) return;
      setOrganizationId(profile.organization_id);
      setProfileId(profile.id);

      const { data: cats } = await supabase
        .from('payable_categories')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('name');
      setCategories((cats || []) as PayableCategory[]);
    }
    void bootstrap();
  }, [supabase]);

  const refreshStats = useCallback(async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await supabase
        .from('payables')
        .select('amount, status, due_date')
        .eq('organization_id', organizationId)
        .limit(5000);

      if (error && error.code !== '42P01') throw error;
      const rows = (data || []) as Pick<Payable, 'amount' | 'status' | 'due_date'>[];
      const now = new Date();
      setStats({
        total: rows.reduce((s, p) => s + (p.amount || 0), 0),
        pending: rows
          .filter((p) => p.status === 'pending')
          .reduce((s, p) => s + (p.amount || 0), 0),
        approved: rows
          .filter((p) => p.status === 'approved')
          .reduce((s, p) => s + (p.amount || 0), 0),
        overdue: rows
          .filter(
            (p) =>
              ['pending', 'approved'].includes(p.status) &&
              p.due_date &&
              new Date(p.due_date) < now,
          )
          .reduce((s, p) => s + (p.amount || 0), 0),
      });
    } catch (err) {
      console.error('Error loading payable stats:', err);
    }
  }, [organizationId, supabase]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats, listKey]);

  const handleApprove = useCallback(
    async (payable: Payable) => {
      try {
        const { error } = await (supabase as any)
          .from('payables')
          .update({
            status: 'approved',
            approved_by: profileId,
            approved_at: new Date().toISOString(),
          })
          .eq('id', payable.id);
        if (error) throw error;

        await (supabase as any).from('financial_audit_log').insert({
          organization_id: organizationId,
          action: 'payable_approved',
          entity_type: 'payable',
          entity_id: payable.id,
          performed_by: profileId,
          details: { payee_name: payable.payee_name, amount: payable.amount },
        });

        toast.success('Payable approved');
        setListKey((k) => k + 1);
      } catch (err) {
        console.error(err);
        toast.error('Failed to approve payable');
      }
    },
    [organizationId, profileId, supabase],
  );

  const handleMarkPaid = useCallback(
    async (payable: Payable) => {
      try {
        const { error } = await (supabase as any)
          .from('payables')
          .update({
            status: 'paid',
            paid_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', payable.id);
        if (error) throw error;

        await (supabase as any).from('financial_audit_log').insert({
          organization_id: organizationId,
          action: 'payable_paid',
          entity_type: 'payable',
          entity_id: payable.id,
          performed_by: profileId,
          details: { payee_name: payable.payee_name, amount: payable.amount },
        });

        toast.success('Payable marked as paid');
        setListKey((k) => k + 1);
      } catch (err) {
        console.error(err);
        toast.error('Failed to update payable');
      }
    },
    [organizationId, profileId, supabase],
  );

  const handleCreate = async () => {
    if (!formData.payee_name || !formData.amount) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
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

      await (supabase as any).from('financial_audit_log').insert({
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
      setListKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create payable');
    } finally {
      setSaving(false);
    }
  };

  const descriptor = useMemo<ResourceDescriptor<Payable> | null>(() => {
    if (!organizationId) return null;

    return {
      resource: 'payables',
      title: '',
      getRowId: (row) => row.id,
      searchPlaceholder: 'Search payables…',
      pageSize: 25,
      export: { filename: `payables-${format(new Date(), 'yyyy-MM-dd')}.csv` },
      emptyState: {
        title: 'No payables found',
        description: 'Create your first payable to get started',
        action: (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus weight="light" className="mr-2 h-4 w-4" />
            New Payable
          </Button>
        ),
      },
      toolbar: undefined,
      filters: [
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'processing', label: 'Processing' },
            { value: 'paid', label: 'Paid' },
            { value: 'on_hold', label: 'On Hold' },
          ],
        },
        {
          key: 'payee_type',
          label: 'Type',
          type: 'select',
          options: [
            { value: 'agent', label: 'Agent' },
            { value: 'vendor', label: 'Vendor' },
            { value: 'provider', label: 'Provider' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
      columns: [
        {
          key: 'payee_name',
          header: 'Payee',
          defaultWidth: 220,
          accessor: (r) => r.payee_name,
          cell: (r) => (
            <div className="flex items-center gap-2">
              <PayeeIcon type={r.payee_type} />
              <div className="min-w-0">
                <p className="truncate font-medium">{r.payee_name}</p>
                {r.payee_email && (
                  <p className="truncate text-sm text-muted-foreground">{r.payee_email}</p>
                )}
              </div>
            </div>
          ),
          exportValue: (r) => r.payee_name,
        },
        {
          key: 'description',
          header: 'Description',
          defaultWidth: 200,
          accessor: (r) => r.description ?? '',
          cell: (r) => (
            <div>
              <p className="truncate">{r.description || '—'}</p>
              {r.reference_number && (
                <p className="text-xs text-muted-foreground">Ref: {r.reference_number}</p>
              )}
            </div>
          ),
        },
        {
          key: 'amount',
          header: 'Amount',
          align: 'right',
          defaultWidth: 120,
          accessor: (r) => r.amount,
          cell: (r) => <span className="font-medium">{formatCurrency(r.amount)}</span>,
          exportValue: (r) => r.amount,
        },
        {
          key: 'status',
          header: 'Status',
          align: 'center',
          defaultWidth: 130,
          accessor: (r) => r.status,
          cell: (r) => <StatusBadge status={r.status} dueDate={r.due_date} />,
        },
        {
          key: 'due_date',
          header: 'Due Date',
          defaultWidth: 140,
          accessor: (r) => r.due_date ?? '',
          cell: (r) =>
            r.due_date ? (
              <span className="text-sm">{format(new Date(r.due_date), 'MMM d, yyyy')}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ],
      rowActions: [
        {
          id: 'view',
          label: 'View',
          icon: <Eye weight="light" className="h-4 w-4" />,
          run: (row) => {
            setSelectedPayable(row);
            setShowDetailModal(true);
          },
        },
        {
          id: 'approve',
          label: 'Approve',
          permission: Permissions.PayablesApprove,
          icon: <CheckCircle weight="light" className="h-4 w-4 text-blue-500" />,
          visible: (row) => row.status === 'pending',
          run: async (row, { refresh }) => {
            await handleApprove(row);
            await refresh();
          },
        },
        {
          id: 'mark_paid',
          label: 'Mark Paid',
          permission: Permissions.PayablesPay,
          icon: <CurrencyDollar weight="light" className="h-4 w-4 text-emerald-500" />,
          visible: (row) => row.status === 'approved',
          run: async (row, { refresh }) => {
            await handleMarkPaid(row);
            await refresh();
          },
        },
      ],
      dataSource: {
        kind: 'fetcher',
        load: (query) =>
          fetchSupabaseList<Payable>({
            client: supabase as any,
            table: 'payables',
            select: '*, category:payable_categories(name)',
            organizationId,
            searchColumns: ['payee_name', 'payee_email', 'reference_number', 'description'],
            sortableColumns: [
              'payee_name',
              'amount',
              'status',
              'due_date',
              'created_at',
              'description',
            ],
            filterableColumns: ['status', 'payee_type'],
            query,
          }),
      },
    };
  }, [handleApprove, handleMarkPaid, organizationId, supabase]);

  if (!organizationId || !descriptor) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <ArrowClockwise weight="light" className="mr-2 h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payables"
        description="Track and manage accounts payable — vendors, agents, and providers"
        icon={<CurrencyDollar weight="light" className="h-6 w-6" />}
        gradient="from-[var(--adm-teal)] to-[var(--adm-cyan)]"
        actions={
          <>
            <Link href="/payables/summary">
              <Button variant="outline" size="sm">
                View summary
              </Button>
            </Link>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus weight="light" className="mr-1 h-4 w-4" aria-hidden />
              New payable
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <CurrencyDollar weight="light" className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{formatCurrency(stats.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Clock weight="light" className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{formatCurrency(stats.pending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <CheckCircle weight="light" className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-xl font-bold">{formatCurrency(stats.approved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2">
                <Warning weight="light" className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-xl font-bold">{formatCurrency(stats.overdue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remount on mutations so the shared list reloads cleanly */}
      <ResourceList key={listKey} descriptor={descriptor} />

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Payable</DialogTitle>
            <DialogDescription>Create a new payable record</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payee Type *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.payee_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payee_type: e.target.value as typeof formData.payee_type,
                    })
                  }
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
                    className="w-full rounded-md border px-3 py-2"
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
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? (
                <>
                  <ArrowClockwise weight="light" className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus weight="light" className="mr-2 h-4 w-4" />
                  Create Payable
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payable Details</DialogTitle>
          </DialogHeader>
          {selectedPayable && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
                <PayeeIcon type={selectedPayable.payee_type} />
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
                    <StatusBadge status={selectedPayable.status} dueDate={selectedPayable.due_date} />
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
            {selectedPayable?.status === 'pending' && canApprove && (
              <Button
                onClick={() => {
                  void handleApprove(selectedPayable);
                  setShowDetailModal(false);
                }}
              >
                <CheckCircle weight="light" className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
            {selectedPayable?.status === 'approved' && canPay && (
              <Button
                onClick={() => {
                  void handleMarkPaid(selectedPayable);
                  setShowDetailModal(false);
                }}
              >
                <CurrencyDollar weight="light" className="mr-2 h-4 w-4" />
                Mark Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
