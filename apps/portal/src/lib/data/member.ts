import 'server-only';

import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

/**
 * Server-only data accessors for the member portal.
 * Each function calls requireActiveMembership() first to enforce the gate
 * and is wrapped in React's cache() so a single request only does one round-trip.
 */

export const getMemberContext = cache(async () => {
  return requireActiveMembership();
});

export const listMemberEnrollments = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('enrollments')
    .select(`
      id, enrollment_number, status, enrollment_mode, enrollment_source,
      requested_effective_date, effective_date, base_monthly_cost,
      created_at, updated_at,
      plans:selected_plan_id (id, name, code, monthly_share)
    `)
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false });
  return data ?? [];
});

export const getActiveMembership = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('memberships')
    .select(`
      id, status, billing_amount, effective_date, end_date,
      plans:plan_id (id, name, code, monthly_share, description)
    `)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('status', 'active')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
});

export const listDependentsForMember = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id')
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id);

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  if (enrollmentIds.length === 0) return [];

  const { data } = await supabase
    .from('enrollment_dependents')
    .select(`
      id, enrollment_id, status, inactive_reason, additional_cost,
      dependents:dependent_id (
        id, first_name, last_name, date_of_birth, relationship, custom_fields
      )
    `)
    .in('enrollment_id', enrollmentIds);

  return data ?? [];
});

export const getMemberAdvisor = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data: enroll } = await supabase
    .from('enrollments')
    .select('advisor_id')
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .not('advisor_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enroll?.advisor_id) return null;

  const { data: advisor } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, email, phone, avatar_url')
    .eq('id', enroll.advisor_id)
    .maybeSingle();
  return advisor;
});

export const listMemberNotifications = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('member_notifications')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
});

export const countUnreadNotifications = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from('member_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('is_read', false);
  return count ?? 0;
});

export const listChangeRequests = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('member_change_requests')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
});

export const listMemberDocuments = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('member_documents')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('is_active', true)
    .order('issued_at', { ascending: false });
  return data ?? [];
});

export const listAgreementSignatures = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id')
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id);
  const ids = (enrollments ?? []).map((e) => e.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('agreement_signatures')
    .select('*')
    .in('enrollment_id', ids)
    .order('signed_at', { ascending: false });
  return data ?? [];
});
