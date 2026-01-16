'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@crm-eco/ui';
import { Loader2, TrendingUp, DollarSign, Users, Award, Save } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
interface AgentCommissionTabProps {
  agentId: string;
  organizationId: string;
}

// Commission types (tables may not be in generated types yet)
interface CommissionTier {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  level: number;
  base_rate_pct: number;
  bonus_rate_pct: number | null;
  override_rate_pct: number | null;
  min_personal_production: number | null;
  min_team_production: number | null;
  min_active_members: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CommissionTransaction {
  id: string;
  advisor_id: string;
  transaction_type: string;
  period_start: string;
  period_end: string;
  commission_amount: number | null;
  status: string;
  created_at: string;
}

interface CommissionPayout {
  id: string;
  advisor_id: string;
  period_start: string;
  period_end: string;
  total_commissions: number | null;
  total_overrides: number | null;
  total_bonuses: number | null;
  total_chargebacks: number | null;
  net_payout: number | null;
  status: string;
  created_at: string;
}

interface AgentProductionData {
  currentTierId: string | null;
  overrideRatePct: number | null;
  personalProduction: number;
  teamProduction: number;
  lifetimeProduction: number;
  commissionEligible: boolean;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'approved':
      return 'secondary';
    case 'pending':
      return 'outline';
    case 'held':
    case 'reversed':
      return 'destructive';
    default:
      return 'outline';
  }
};

export function AgentCommissionTab({ agentId, organizationId }: AgentCommissionTabProps) {
  const supabase = createClient();
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [agentData, setAgentData] = useState<AgentProductionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [agentId]);

  async function loadData() {
    setLoading(true);
    try {
      // Load tiers
      const { data: tiersData } = await supabase
        .from('commission_tiers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('level', { ascending: true });

      setTiers(tiersData || []);

      // Load agent production data
      const { data: agentDataResult } = await supabase
        .from('advisors')
        .select('commission_tier_id, override_rate_pct, personal_production, team_production, lifetime_production, commission_eligible')
        .eq('id', agentId)
        .single() as { data: Pick<Advisor, 'commission_tier_id' | 'override_rate_pct' | 'personal_production' | 'team_production' | 'lifetime_production' | 'commission_eligible'> | null };

      if (agentDataResult) {
        setAgentData({
          currentTierId: agentDataResult.commission_tier_id,
          overrideRatePct: agentDataResult.override_rate_pct,
          personalProduction: agentDataResult.personal_production || 0,
          teamProduction: agentDataResult.team_production || 0,
          lifetimeProduction: agentDataResult.lifetime_production || 0,
          commissionEligible: agentDataResult.commission_eligible ?? true,
        });
        setSelectedTierId(agentDataResult.commission_tier_id || '');
      }

      // Load recent transactions
      const { data: txData } = await supabase
        .from('commission_transactions')
        .select('*')
        .eq('advisor_id', agentId)
        .order('created_at', { ascending: false })
        .limit(10);

      setTransactions((txData || []) as CommissionTransaction[]);

      // Load recent payouts
      const { data: payoutData } = await supabase
        .from('commission_payouts')
        .select('*')
        .eq('advisor_id', agentId)
        .order('created_at', { ascending: false })
        .limit(5);

      setPayouts((payoutData || []) as CommissionPayout[]);
    } catch (error) {
      console.error('Error loading commission data:', error);
      toast.error('Failed to load commission data');
    } finally {
      setLoading(false);
    }
  }

  async function saveTierAssignment() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('advisors')
        .update({ commission_tier_id: selectedTierId || null })
        .eq('id', agentId);

      if (error) throw error;

      // Log activity
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profile) {
        await (supabase as any).rpc('log_admin_activity', {
          p_organization_id: organizationId,
          p_actor_profile_id: profile.id,
          p_entity_type: 'advisor',
          p_entity_id: agentId,
          p_action: 'update_commission_tier',
          p_metadata: { new_tier_id: selectedTierId },
        });
      }

      toast.success('Commission tier updated');
      await loadData();
    } catch (error) {
      console.error('Error updating tier:', error);
      toast.error('Failed to update commission tier');
    } finally {
      setSaving(false);
    }
  }

  const currentTier = tiers.find(t => t.id === agentData?.currentTierId);
  const totalEarned = transactions
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + (t.commission_amount || 0), 0);
  const pendingAmount = transactions
    .filter(t => ['pending', 'approved'].includes(t.status))
    .reduce((sum, t) => sum + (t.commission_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-3 text-slate-500">Loading commission data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Production Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Personal Production</p>
                <p className="text-xl font-bold">${(agentData?.personalProduction || 0).toLocaleString()}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Team Production</p>
                <p className="text-xl font-bold">${(agentData?.teamProduction || 0).toLocaleString()}</p>
              </div>
              <Users className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Earned</p>
                <p className="text-xl font-bold text-green-600">${totalEarned.toLocaleString()}</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="text-xl font-bold text-yellow-600">${pendingAmount.toLocaleString()}</p>
              </div>
              <Award className="h-6 w-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Tier</CardTitle>
          <CardDescription>Assign this agent to a commission tier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Current Tier</label>
              <Select value={selectedTierId} onValueChange={setSelectedTierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Tier Assigned</SelectItem>
                  {tiers.map(tier => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.name} ({tier.base_rate_pct}% base)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={saveTierAssignment}
              disabled={saving || selectedTierId === agentData?.currentTierId}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>

          {currentTier && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-medium mb-2">{currentTier.name} Rates</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Base Rate</p>
                  <p className="text-lg font-bold text-green-600">{currentTier.base_rate_pct}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Bonus Rate</p>
                  <p className="text-lg font-bold text-blue-600">{currentTier.bonus_rate_pct || 0}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Override Rate</p>
                  <p className="text-lg font-bold text-purple-600">{currentTier.override_rate_pct || 0}%</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Commission Transactions</CardTitle>
          <CardDescription>Last 10 transactions for this agent</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No commission transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {tx.transaction_type === 'new_business' ? 'New Business' :
                        tx.transaction_type === 'renewal' ? 'Renewal' :
                        tx.transaction_type === 'override' ? 'Override' :
                        tx.transaction_type === 'bonus' ? 'Bonus' :
                        tx.transaction_type === 'chargeback' ? 'Chargeback' : tx.transaction_type}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(tx.period_start), 'MMM d')} - {format(new Date(tx.period_end), 'MMM d, yyyy')}
                      {' • '}
                      {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${tx.transaction_type === 'chargeback' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.transaction_type === 'chargeback' ? '-' : ''}${Math.abs(tx.commission_amount || 0).toFixed(2)}
                    </p>
                    <Badge variant={getStatusBadgeVariant(tx.status)} className="text-xs">
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
          <CardDescription>Last 5 payout periods</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No payouts processed yet.</p>
          ) : (
            <div className="space-y-3">
              {payouts.map(payout => (
                <div key={payout.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {format(new Date(payout.period_start), 'MMM d')} - {format(new Date(payout.period_end), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-slate-500">
                      Commissions: ${(payout.total_commissions || 0).toFixed(2)} | 
                      Overrides: ${(payout.total_overrides || 0).toFixed(2)} | 
                      Bonuses: ${(payout.total_bonuses || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-green-600">
                      ${(payout.net_payout || 0).toFixed(2)}
                    </p>
                    <Badge variant={getStatusBadgeVariant(payout.status)} className="text-xs">
                      {payout.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
