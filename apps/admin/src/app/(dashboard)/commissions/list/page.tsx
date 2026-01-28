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
  TrendingUp,
  Search,
  Filter,
  Download,
  RefreshCw,
  Plus,
  Copy,
  Gift,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Commission {
  id: string;
  advisor_id: string;
  member_id: string | null;
  transaction_type: string;
  commission_amount: number;
  rate_pct: number;
  status: string;
  is_bonus: boolean;
  bonus_reason: string | null;
  created_at: string;
  advisor?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  member?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface BonusType {
  id: string;
  name: string;
  description: string;
  calculation_type: string;
  default_amount: number | null;
  default_percentage: number | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'held';
type TypeFilter = 'all' | 'new_business' | 'renewal' | 'override' | 'bonus';

export default function CommissionsListPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bonusTypes, setBonusTypes] = useState<BonusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modals
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Bonus form
  const [bonusForm, setBonusForm] = useState({
    agentId: '',
    bonusTypeId: '',
    amount: '',
    reason: '',
    effectiveDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [savingBonus, setSavingBonus] = useState(false);

  // Copy form
  const [copyForm, setCopyForm] = useState({
    sourceAgentId: '',
    targetAgentId: '',
    copyType: 'rates' as 'rates' | 'structure' | 'all',
  });
  const [copying, setCopying] = useState(false);

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

  // Fetch data
  const fetchCommissions = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('commission_transactions')
        .select(
          `
          id,
          advisor_id,
          member_id,
          transaction_type,
          commission_amount,
          rate_pct,
          status,
          is_bonus,
          bonus_reason,
          created_at,
          advisor:advisors(id, first_name, last_name, email),
          member:members(first_name, last_name)
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        if (typeFilter === 'bonus') {
          query = query.eq('is_bonus', true);
        } else {
          query = query.eq('transaction_type', typeFilter);
        }
      }

      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start);
      }

      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end + 'T23:59:59');
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;
      setCommissions((data || []) as unknown as Commission[]);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, email')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('last_name');

      if (error) throw error;
      setAgents((data || []) as Agent[]);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchBonusTypes = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('commission_bonus_types')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (error && error.code !== '42P01') throw error;
      setBonusTypes((data || []) as BonusType[]);
    } catch (error) {
      console.error('Error fetching bonus types:', error);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchCommissions();
      fetchAgents();
      fetchBonusTypes();
    }
  }, [organizationId, statusFilter, typeFilter, dateRange]);

  // Filter commissions by search
  const filteredCommissions = commissions.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.advisor?.first_name?.toLowerCase().includes(query) ||
      c.advisor?.last_name?.toLowerCase().includes(query) ||
      c.advisor?.email?.toLowerCase().includes(query) ||
      c.member?.first_name?.toLowerCase().includes(query) ||
      c.member?.last_name?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredCommissions.length / pageSize);
  const paginatedCommissions = filteredCommissions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Stats
  const totalAmount = filteredCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const pendingAmount = filteredCommissions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const paidAmount = filteredCommissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const bonusAmount = filteredCommissions
    .filter((c) => c.is_bonus)
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
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
      case 'held':
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="w-3 h-3 mr-1" />
            Held
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string, isBonus: boolean) => {
    if (isBonus) {
      return <Badge className="bg-purple-100 text-purple-700">Bonus</Badge>;
    }
    switch (type) {
      case 'new_business':
        return <Badge className="bg-teal-100 text-teal-700">New Business</Badge>;
      case 'renewal':
        return <Badge className="bg-blue-100 text-blue-700">Renewal</Badge>;
      case 'override':
        return <Badge className="bg-orange-100 text-orange-700">Override</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // Handle bonus generation
  const handleGenerateBonus = async () => {
    if (!bonusForm.agentId || !bonusForm.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    setSavingBonus(true);
    try {
      const { data, error } = await supabase
        .from('commission_transactions')
        .insert({
          organization_id: organizationId,
          advisor_id: bonusForm.agentId,
          transaction_type: 'bonus',
          commission_amount: parseFloat(bonusForm.amount),
          rate_pct: 100,
          status: 'pending',
          is_bonus: true,
          bonus_type_id: bonusForm.bonusTypeId || null,
          bonus_reason: bonusForm.reason,
          effective_date: bonusForm.effectiveDate,
          period_start: bonusForm.effectiveDate,
          period_end: bonusForm.effectiveDate,
          gross_amount: parseFloat(bonusForm.amount),
        })
        .select()
        .single();

      if (error) throw error;

      // Log to audit
      await supabase.from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'bonus_commission_generated',
        entity_type: 'commission',
        entity_id: data.id,
        performed_by: profileId,
        details: {
          agent_id: bonusForm.agentId,
          amount: parseFloat(bonusForm.amount),
          reason: bonusForm.reason,
        },
      });

      toast.success('Bonus commission generated');
      setShowBonusModal(false);
      setBonusForm({
        agentId: '',
        bonusTypeId: '',
        amount: '',
        reason: '',
        effectiveDate: format(new Date(), 'yyyy-MM-dd'),
      });
      fetchCommissions();
    } catch (error) {
      console.error('Error generating bonus:', error);
      toast.error('Failed to generate bonus');
    } finally {
      setSavingBonus(false);
    }
  };

  // Handle copy agent commissions
  const handleCopyCommissions = async () => {
    if (!copyForm.sourceAgentId || !copyForm.targetAgentId) {
      toast.error('Please select source and target agents');
      return;
    }

    if (copyForm.sourceAgentId === copyForm.targetAgentId) {
      toast.error('Source and target agents must be different');
      return;
    }

    setCopying(true);
    try {
      // Get source agent's commission rates/structure
      const { data: sourceRates, error: ratesError } = await supabase
        .from('commission_rates')
        .select('*')
        .eq('advisor_id', copyForm.sourceAgentId);

      if (ratesError && ratesError.code !== '42P01') throw ratesError;

      let itemsCopied = 0;

      if (sourceRates && sourceRates.length > 0) {
        // Copy rates to target agent
        const newRates = sourceRates.map((rate) => ({
          ...rate,
          id: undefined,
          advisor_id: copyForm.targetAgentId,
          created_at: undefined,
          updated_at: undefined,
        }));

        const { error: insertError } = await supabase.from('commission_rates').insert(newRates);

        if (insertError && insertError.code !== '42P01') throw insertError;
        itemsCopied = newRates.length;
      }

      // Log the copy action
      const { error: historyError } = await supabase.from('commission_copy_history').insert({
        organization_id: organizationId,
        source_agent_id: copyForm.sourceAgentId,
        target_agent_id: copyForm.targetAgentId,
        copy_type: copyForm.copyType,
        items_copied: itemsCopied,
        created_by: profileId,
        details: {
          rates_copied: itemsCopied,
        },
      });

      if (historyError && historyError.code !== '42P01') {
        console.error('Error logging copy history:', historyError);
      }

      // Log to audit
      await supabase.from('financial_audit_log').insert({
        organization_id: organizationId,
        action: 'commission_structure_copied',
        entity_type: 'commission',
        performed_by: profileId,
        details: {
          source_agent_id: copyForm.sourceAgentId,
          target_agent_id: copyForm.targetAgentId,
          copy_type: copyForm.copyType,
          items_copied: itemsCopied,
        },
      });

      toast.success(`Copied ${itemsCopied} commission rates to target agent`);
      setShowCopyModal(false);
      setCopyForm({
        sourceAgentId: '',
        targetAgentId: '',
        copyType: 'rates',
      });
    } catch (error) {
      console.error('Error copying commissions:', error);
      toast.error('Failed to copy commissions');
    } finally {
      setCopying(false);
    }
  };

  // Export commissions
  const exportCommissions = () => {
    const csv = [
      ['Agent', 'Email', 'Member', 'Type', 'Amount', 'Rate %', 'Status', 'Date', 'Bonus', 'Reason'].join(','),
      ...filteredCommissions.map((c) =>
        [
          `"${c.advisor?.first_name || ''} ${c.advisor?.last_name || ''}"`,
          c.advisor?.email || '',
          `"${c.member?.first_name || ''} ${c.member?.last_name || ''}"`,
          c.transaction_type,
          c.commission_amount,
          c.rate_pct,
          c.status,
          format(new Date(c.created_at), 'yyyy-MM-dd'),
          c.is_bonus ? 'Yes' : 'No',
          `"${c.bonus_reason || ''}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commissions List</h1>
          <p className="text-muted-foreground">View and manage all commission transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCopyModal(true)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Agent
          </Button>
          <Button variant="outline" onClick={() => setShowBonusModal(true)}>
            <Gift className="h-4 w-4 mr-2" />
            Generate Bonus
          </Button>
          <Button variant="outline" onClick={exportCommissions}>
            <Download className="h-4 w-4 mr-2" />
            Export
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
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-bold">{formatCurrency(paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bonuses</p>
                <p className="text-xl font-bold">{formatCurrency(bonusAmount)}</p>
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
                placeholder="Search by agent or member..."
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
                <option value="paid">Paid</option>
                <option value="held">Held</option>
              </select>
              <select
                className="border rounded px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              >
                <option value="all">All Types</option>
                <option value="new_business">New Business</option>
                <option value="renewal">Renewal</option>
                <option value="override">Override</option>
                <option value="bonus">Bonus</option>
              </select>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-40"
                placeholder="Start date"
              />
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-40"
                placeholder="End date"
              />
              <Button variant="outline" size="sm" onClick={fetchCommissions}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : paginatedCommissions.length === 0 ? (
            <div className="text-center py-16">
              <DollarSign className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-lg font-medium">No commissions found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Agent</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Member</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Rate</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCommissions.map((commission) => (
                    <tr key={commission.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-medium">
                          {commission.advisor?.first_name} {commission.advisor?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{commission.advisor?.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        {commission.member ? (
                          <span>
                            {commission.member.first_name} {commission.member.last_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {getTypeBadge(commission.transaction_type, commission.is_bonus)}
                        {commission.bonus_reason && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-32">
                            {commission.bonus_reason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(commission.commission_amount)}
                      </td>
                      <td className="py-3 px-4 text-right">{commission.rate_pct}%</td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(commission.status)}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {format(new Date(commission.created_at), 'MMM d, yyyy')}
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
              {Math.min(currentPage * pageSize, filteredCommissions.length)} of{' '}
              {filteredCommissions.length}
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

      {/* Generate Bonus Modal */}
      <Dialog open={showBonusModal} onOpenChange={setShowBonusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Bonus Commission</DialogTitle>
            <DialogDescription>Create a bonus commission for an agent</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Agent *</Label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={bonusForm.agentId}
                onChange={(e) => setBonusForm({ ...bonusForm, agentId: e.target.value })}
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name} ({agent.email})
                  </option>
                ))}
              </select>
            </div>

            {bonusTypes.length > 0 && (
              <div className="space-y-2">
                <Label>Bonus Type</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={bonusForm.bonusTypeId}
                  onChange={(e) => {
                    const type = bonusTypes.find((t) => t.id === e.target.value);
                    setBonusForm({
                      ...bonusForm,
                      bonusTypeId: e.target.value,
                      amount: type?.default_amount?.toString() || bonusForm.amount,
                    });
                  }}
                >
                  <option value="">Select a type (optional)</option>
                  {bonusTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={bonusForm.amount}
                onChange={(e) => setBonusForm({ ...bonusForm, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={bonusForm.effectiveDate}
                onChange={(e) => setBonusForm({ ...bonusForm, effectiveDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason/Notes</Label>
              <Textarea
                placeholder="Enter reason for this bonus..."
                value={bonusForm.reason}
                onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBonusModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateBonus} disabled={savingBonus}>
              {savingBonus ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Generate Bonus
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Agent Commissions Modal */}
      <Dialog open={showCopyModal} onOpenChange={setShowCopyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Agent Commission Structure</DialogTitle>
            <DialogDescription>
              Copy commission rates and structure from one agent to another
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source Agent (copy from) *</Label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={copyForm.sourceAgentId}
                onChange={(e) => setCopyForm({ ...copyForm, sourceAgentId: e.target.value })}
              >
                <option value="">Select source agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Target Agent (copy to) *</Label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={copyForm.targetAgentId}
                onChange={(e) => setCopyForm({ ...copyForm, targetAgentId: e.target.value })}
              >
                <option value="">Select target agent</option>
                {agents
                  .filter((a) => a.id !== copyForm.sourceAgentId)
                  .map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>What to Copy</Label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={copyForm.copyType}
                onChange={(e) =>
                  setCopyForm({ ...copyForm, copyType: e.target.value as 'rates' | 'structure' | 'all' })
                }
              >
                <option value="rates">Commission Rates Only</option>
                <option value="structure">Commission Structure</option>
                <option value="all">All Commission Settings</option>
              </select>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> This will add commission rates to the target agent. Existing
                rates for the target agent will not be modified.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopyCommissions} disabled={copying}>
              {copying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Commission Structure
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
