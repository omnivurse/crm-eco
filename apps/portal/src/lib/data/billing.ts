import 'server-only';

import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export interface ListOpts {
  limit?: number;
  offset?: number;
  statusFilter?: string;
}

export const listPaymentProfiles = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('payment_profiles')
    .select('id, card_last4, last_four, card_type, expiration_date, is_default, status, account_type, bank_name')
    .eq('member_id', ctx.member.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false });
  return data ?? [];
});

export const getActiveBillingSchedule = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('billing_schedules')
    .select('id, amount, frequency, next_billing_date, status, payment_profile_id')
    .eq('member_id', ctx.member.id)
    .eq('status', 'active')
    .eq('frequency', 'monthly')
    .order('next_billing_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
});

export const listTransactions = cache(async (opts: ListOpts = {}) => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  let q = supabase
    .from('billing_transactions')
    .select('*', { count: 'exact' })
    .eq('member_id', ctx.member.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.statusFilter) q = q.eq('status', opts.statusFilter);

  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0 };
});

export const listInvoices = cache(async (opts: ListOpts = {}) => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  let q = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('member_id', ctx.member.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.statusFilter) q = q.eq('status', opts.statusFilter);

  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0 };
});

export const listOpenFailures = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('billing_failures')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  return data ?? [];
});
