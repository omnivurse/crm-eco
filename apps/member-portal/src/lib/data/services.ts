import 'server-only';

import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

type Category = 'telehealth' | 'care' | 'discount' | 'labs' | 'rx' | 'hospital_debt_relief' | 'other';

export const listServiceProvidersByCategory = cache(async (category: Category) => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('service_providers')
    .select('id, name, description, logo_url, external_url, sso_kind, sort_order')
    .eq('organization_id', ctx.member.organization_id)
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  return data ?? [];
});

export const getServiceProviderById = cache(async (id: string) => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('service_providers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('is_active', true)
    .maybeSingle();
  return data;
});
