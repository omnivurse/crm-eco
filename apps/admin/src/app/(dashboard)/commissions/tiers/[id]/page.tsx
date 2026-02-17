import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { CommissionTierForm } from '@/components/commissions/CommissionTierForm';
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

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTier(id: string): Promise<{ tier: CommissionTier; organizationId: string } | null> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const { data: tier, error } = await (supabase
    .from('commission_tiers') as any)
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !tier) return null;

  return { tier, organizationId: profile.organization_id };
}

export default async function EditCommissionTierPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getTier(id);

  if (!result) {
    notFound();
  }

  return <CommissionTierForm tier={result.tier} organizationId={result.organizationId} />;
}
