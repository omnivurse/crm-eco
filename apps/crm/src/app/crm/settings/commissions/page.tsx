'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui/components/tabs';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  TrendingUp,
  Users,
  Loader2,
  MoreHorizontal,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Layers,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

interface CommissionTier {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  level: number;
  base_rate_pct: number;
  bonus_rate_pct: number;
  override_rate_pct: number;
  min_personal_production: number;
  min_team_production: number;
  min_active_members: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface CommissionTransaction {
  id: string;
  advisor_id: string;
  advisor_name?: string;
  transaction_type: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  rate_pct: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

interface CommissionPayout {
  id: string;
  advisor_id: string;
  advisor_name?: string;
  period_start: string;
  period_end: string;
  total_commissions: number;
  total_overrides: number;
  total_bonuses: number;
  total_chargebacks: number;
  net_payout: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export default function CommissionsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');

  // Tier dialog state
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tier form
  const [tierForm, setTierForm] = useState({
    name: '',
    code: '',
    level: 1,
    base_rate_pct: 10,
    bonus_rate_pct: 0,
    override_rate_pct: 0,
    min_personal_production: 0,
    min_team_production: 0,
    min_active_members: 0,
    is_active: true,
  });

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrgId(profile.organization_id);

      const [tiersRes, transactionsRes, payoutsRes] = await Promise.all([
        supabase
          .from('commission_tiers')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('level'),
        supabase
          .from('commission_transactions')
          .select(`
            *,
            advisors(full_name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('commission_payouts')
          .select(`
            *,
            advisors(full_name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setTiers((tiersRes.data || []) as CommissionTier[]);
      setTransactions(
        (transactionsRes.data || []).map((t: any) => ({
          ...t,
          advisor_name: t.advisors?.full_name || 'Unknown',
        }))
      );
      setPayouts(
        (payoutsRes.data || []).map((p: any) => ({
          ...p,
          advisor_name: p.advisors?.full_name || 'Unknown',
        }))
      );
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateTierDialog = () => {
    setEditingTier(null);
    setTierForm({
      name: '',
      code: '',
      level: tiers.length + 1,
      base_rate_pct: 10,
      bonus_rate_pct: 0,
      override_rate_pct: 0,
      min_personal_production: 0,
      min_team_production: 0,
      min_active_members: 0,
      is_active: true,
    });
    setTierDialogOpen(true);
  };

  const openEditTierDialog = (tier: CommissionTier) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      code: tier.code,
      level: tier.level,
      base_rate_pct: tier.base_rate_pct,
      bonus_rate_pct: tier.bonus_rate_pct,
      override_rate_pct: tier.override_rate_pct,
      min_personal_production: tier.min_personal_production,
      min_team_production: tier.min_team_production,
      min_active_members: tier.min_active_members,
      is_active: tier.is_active,
    });
    setTierDialogOpen(true);
  };

  const handleSaveTier = async () => {
    if (!tierForm.name || !tierForm.code) return;
    setSaving(true);

    try {
      const data = {
        organization_id: orgId,
        name: tierForm.name,
        code: tierForm.code.toUpperCase(),
        level: tierForm.level,
        base_rate_pct: tierForm.base_rate_pct,
        bonus_rate_pct: tierForm.bonus_rate_pct,
        override_rate_pct: tierForm.override_rate_pct,
        min_personal_production: tierForm.min_personal_production,
        min_team_production: tierForm.min_team_production,
        min_active_members: tierForm.min_active_members,
        is_active: tierForm.is_active,
      };

      if (editingTier) {
        await supabase.from('commission_tiers').update(data).eq('id', editingTier.id);
      } else {
        await supabase.from('commission_tiers').insert(data);
      }

      fetchData();
      setTierDialogOpen(false);
    } catch (error) {
      console.error('Failed to save tier:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = async () => {
    if (!deleteTierId) return;
    try {
      await supabase.from('commission_tiers').delete().eq('id', deleteTierId);
      setTiers(tiers.filter(t => t.id !== deleteTierId));
    } catch (error) {
      console.error('Failed to delete tier:', error);
    } finally {
      setDeleteTierId(null);
    }
  };

  const updatePayoutStatus = async (payoutId: string, status: string) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }
      await supabase.from('commission_payouts').update(updates).eq('id', payoutId);
      setPayouts(payouts.map(p => p.id === payoutId ? { ...p, status, paid_at: status === 'paid' ? new Date().toISOString() : p.paid_at } : p));
    } catch (error) {
      console.error('Failed to update payout:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
      case 'approved':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'failed':
      case 'reversed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Stats
  const totalPending = payouts
    .filter(p => p.status === 'pending' || p.status === 'approved')
    .reduce((sum, p) => sum + p.net_payout, 0);
  const totalPaid = payouts
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.net_payout, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Commission Management</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage commission tiers, transactions, and payouts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Tiers</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{tiers.length}</p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Transactions</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{transactions.length}</p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Pending Payouts</p>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalPending)}</p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Paid Out</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tiers" className="w-full">
        <TabsList>
          <TabsTrigger value="tiers">Commission Tiers</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateTierDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Tier
            </Button>
          </div>

          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {tiers.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No commission tiers yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Create tiers to define commission structures
                </p>
                <Button onClick={openCreateTierDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tier
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Base Rate</TableHead>
                    <TableHead>Override</TableHead>
                    <TableHead>Requirements</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell>
                        <Badge variant="outline">{tier.level}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        {tier.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{tier.code}</TableCell>
                      <TableCell>{tier.base_rate_pct}%</TableCell>
                      <TableCell>{tier.override_rate_pct}%</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {tier.min_personal_production > 0 && (
                          <span>Min ${tier.min_personal_production.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                          {tier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditTierDialog(tier)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteTierId(tier.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No transactions yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Commission transactions will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Advisor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Gross Amount</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-slate-500">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{tx.advisor_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.transaction_type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(tx.gross_amount)}</TableCell>
                      <TableCell>{tx.rate_pct}%</TableCell>
                      <TableCell className="font-medium text-emerald-600">
                        {formatCurrency(tx.commission_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.status === 'paid' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                          className="gap-1"
                        >
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-4">
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {payouts.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No payouts yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Commission payouts will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Advisor</TableHead>
                    <TableHead>Commissions</TableHead>
                    <TableHead>Overrides</TableHead>
                    <TableHead>Bonuses</TableHead>
                    <TableHead>Chargebacks</TableHead>
                    <TableHead>Net Payout</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="text-slate-500">
                        {new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{payout.advisor_name}</TableCell>
                      <TableCell>{formatCurrency(payout.total_commissions)}</TableCell>
                      <TableCell>{formatCurrency(payout.total_overrides)}</TableCell>
                      <TableCell>{formatCurrency(payout.total_bonuses)}</TableCell>
                      <TableCell className="text-red-600">
                        {payout.total_chargebacks > 0 ? `-${formatCurrency(payout.total_chargebacks)}` : '-'}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600">
                        {formatCurrency(payout.net_payout)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={payout.status === 'paid' ? 'default' : payout.status === 'approved' ? 'secondary' : 'outline'}
                          className="gap-1"
                        >
                          {getStatusIcon(payout.status)}
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {payout.status === 'pending' && (
                              <DropdownMenuItem onClick={() => updatePayoutStatus(payout.id, 'approved')}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {(payout.status === 'pending' || payout.status === 'approved') && (
                              <DropdownMenuItem onClick={() => updatePayoutStatus(payout.id, 'paid')}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tier Dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTier ? 'Edit' : 'Add'} Commission Tier</DialogTitle>
            <DialogDescription>
              Configure commission rates and qualification requirements
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tier Name</Label>
                <Input
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                  placeholder="e.g., Senior Advisor"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={tierForm.code}
                  onChange={(e) => setTierForm({ ...tierForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SR"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Level (1 = highest)</Label>
              <Input
                type="number"
                value={tierForm.level}
                onChange={(e) => setTierForm({ ...tierForm, level: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Base Rate %</Label>
                <Input
                  type="number"
                  value={tierForm.base_rate_pct}
                  onChange={(e) => setTierForm({ ...tierForm, base_rate_pct: parseFloat(e.target.value) || 0 })}
                  step={0.5}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Bonus Rate %</Label>
                <Input
                  type="number"
                  value={tierForm.bonus_rate_pct}
                  onChange={(e) => setTierForm({ ...tierForm, bonus_rate_pct: parseFloat(e.target.value) || 0 })}
                  step={0.5}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Override %</Label>
                <Input
                  type="number"
                  value={tierForm.override_rate_pct}
                  onChange={(e) => setTierForm({ ...tierForm, override_rate_pct: parseFloat(e.target.value) || 0 })}
                  step={0.5}
                  min={0}
                  max={100}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Min Personal $</Label>
                <Input
                  type="number"
                  value={tierForm.min_personal_production}
                  onChange={(e) => setTierForm({ ...tierForm, min_personal_production: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Team $</Label>
                <Input
                  type="number"
                  value={tierForm.min_team_production}
                  onChange={(e) => setTierForm({ ...tierForm, min_team_production: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Members</Label>
                <Input
                  type="number"
                  value={tierForm.min_active_members}
                  onChange={(e) => setTierForm({ ...tierForm, min_active_members: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={tierForm.is_active}
                onCheckedChange={(checked) => setTierForm({ ...tierForm, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTier} disabled={saving || !tierForm.name || !tierForm.code}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingTier ? 'Save Changes' : 'Add Tier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tier Confirmation */}
      <AlertDialog open={!!deleteTierId} onOpenChange={() => setDeleteTierId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Commission Tier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tier? Advisors assigned to this tier will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTier} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
