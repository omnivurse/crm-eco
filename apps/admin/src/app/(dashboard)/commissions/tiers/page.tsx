import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { Plus, Layers, Users, Percent } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
// Commission tier type (tables may not be in generated types yet)
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

async function getCommissionTiers(): Promise<CommissionTier[]> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return [];

  const { data: tiers, error } = await (supabase
    .from('commission_tiers') as any)
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('level', { ascending: true });

  if (error) {
    console.error('Error fetching commission tiers:', error);
    return [];
  }

  return tiers || [];
}

async function getAgentCountByTier(tierId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();

  const { count } = await supabase
    .from('advisors')
    .select('id', { count: 'exact', head: true })
    .eq('commission_tier_id', tierId);

  return count ?? 0;
}

export default async function CommissionTiersPage() {
  const tiers = await getCommissionTiers();

  // Get agent counts for each tier
  const tierAgentCounts: Record<string, number> = {};
  for (const tier of tiers) {
    tierAgentCounts[tier.id] = await getAgentCountByTier(tier.id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission Tiers</h1>
          <p className="text-slate-500">Define commission levels, rates, and qualification thresholds</p>
        </div>
        <Link href="/commissions/tiers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Tier
          </Button>
        </Link>
      </div>

      {/* Tiers Grid */}
      {tiers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Commission Tiers</h3>
            <p className="text-slate-500 mb-4">
              Create commission tiers to define how agents earn commissions.
            </p>
            <Link href="/commissions/tiers/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Tier
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Link key={tier.id} href={`/commissions/tiers/${tier.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                        L{tier.level}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{tier.name}</CardTitle>
                        <p className="text-xs text-slate-500">{tier.code}</p>
                      </div>
                    </div>
                    <Badge variant={tier.is_active ? 'success' : 'secondary'}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Rates */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-lg font-bold text-green-600">{tier.base_rate_pct}%</p>
                      <p className="text-xs text-slate-500">Base</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-lg font-bold text-blue-600">{tier.bonus_rate_pct || 0}%</p>
                      <p className="text-xs text-slate-500">Bonus</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-lg font-bold text-purple-600">{tier.override_rate_pct || 0}%</p>
                      <p className="text-xs text-slate-500">Override</p>
                    </div>
                  </div>

                  {/* Thresholds */}
                  <div className="text-sm text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Min Personal Production:</span>
                      <span className="font-medium">${(tier.min_personal_production || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Team Production:</span>
                      <span className="font-medium">${(tier.min_team_production || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Active Members:</span>
                      <span className="font-medium">{tier.min_active_members || 0}</span>
                    </div>
                  </div>

                  {/* Agent Count */}
                  <div className="pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{tierAgentCounts[tier.id]} agents</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
