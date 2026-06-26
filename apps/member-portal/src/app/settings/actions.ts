'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MemberSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  billingReminders: boolean;
  needUpdates: boolean;
  marketingEmails: boolean;
  language: string;
  timezone: string;
}

const DEFAULTS: MemberSettings = {
  emailNotifications: true,
  smsNotifications: false,
  billingReminders: true,
  needUpdates: true,
  marketingEmails: true,
  language: 'en',
  timezone: 'America/New_York',
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * Read the current member's saved settings. Everything lives on columns the gate
 * already loaded (members.receive_emails/receive_sms/communication_preferences/
 * preferred_language and profiles.time_zone), so no extra round-trip is needed.
 */
export async function getMemberSettings(): Promise<MemberSettings> {
  const ctx = await requireActiveMembership();
  const member = ctx.member as Record<string, unknown>;
  const prefs = (member.communication_preferences as Record<string, unknown> | null) ?? {};
  const profile = ctx.profile as Record<string, unknown>;

  return {
    emailNotifications: asBool(member.receive_emails, DEFAULTS.emailNotifications),
    smsNotifications: asBool(member.receive_sms, DEFAULTS.smsNotifications),
    billingReminders: asBool(prefs.billing_reminders, DEFAULTS.billingReminders),
    needUpdates: asBool(prefs.need_updates, DEFAULTS.needUpdates),
    marketingEmails: asBool(prefs.marketing, DEFAULTS.marketingEmails),
    language: (member.preferred_language as string) || DEFAULTS.language,
    timezone: (profile.time_zone as string) || DEFAULTS.timezone,
  };
}

/**
 * Persist notification preferences.
 *
 * WHY service-role (see profile/actions.ts): `members` has no member-self UPDATE
 * RLS policy. The auth gate proves ctx.member is this user's own member; the
 * service-role write is scoped to that exact id + org. communication_preferences
 * is read-modify-merged so unrelated keys are preserved.
 */
export async function saveNotificationPreferences(input: {
  emailNotifications: boolean;
  smsNotifications: boolean;
  billingReminders: boolean;
  needUpdates: boolean;
  marketingEmails: boolean;
}): Promise<ActionResult> {
  try {
    const ctx = await requireActiveMembership();
    const existingPrefs =
      ((ctx.member as Record<string, unknown>).communication_preferences as Record<string, unknown> | null) ?? {};

    const mergedPrefs = {
      ...existingPrefs,
      billing_reminders: input.billingReminders,
      need_updates: input.needUpdates,
      marketing: input.marketingEmails,
    };

    const service = createServiceRoleClient();
    const { data, error } = await (service as any)
      .from('members')
      .update({
        receive_emails: input.emailNotifications,
        receive_sms: input.smsNotifications,
        communication_preferences: mergedPrefs,
      })
      .eq('id', ctx.member.id)
      .eq('organization_id', ctx.member.organization_id)
      .select('id')
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Preferences could not be saved. Please try again.' };

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Persist language (members.preferred_language) and timezone (profiles.time_zone).
 * profiles has a self-update policy, but we use the service role here too so both
 * writes share one trusted, ownership-verified path.
 */
export async function saveLocalePreferences(input: {
  language: string;
  timezone: string;
}): Promise<ActionResult> {
  try {
    const ctx = await requireActiveMembership();
    const service = createServiceRoleClient();

    const { data: memberRow, error: memberErr } = await (service as any)
      .from('members')
      .update({ preferred_language: input.language })
      .eq('id', ctx.member.id)
      .eq('organization_id', ctx.member.organization_id)
      .select('id')
      .maybeSingle();

    if (memberErr) return { success: false, error: memberErr.message };
    if (!memberRow) return { success: false, error: 'Settings could not be saved. Please try again.' };

    const { error: profileErr } = await (service as any)
      .from('profiles')
      .update({ time_zone: input.timezone })
      .eq('id', ctx.profile.id);

    if (profileErr) return { success: false, error: profileErr.message };

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * File a data-privacy request (export or deletion) as a member change request so
 * it lands in the staff queue. This replaces the dead-end buttons with a real,
 * auditable, non-destructive request — actual export/deletion is performed by
 * staff (and a future automated flow), never silently from a button click.
 */
export async function requestPrivacyAction(
  kind: 'export' | 'deletion',
): Promise<ActionResult> {
  try {
    const ctx = await requireActiveMembership();
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.from('member_change_requests').insert({
      organization_id: ctx.member.organization_id,
      member_id: ctx.member.id,
      request_type: 'other',
      status: 'pending_review',
      payload: { privacy_action: kind } as never,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'An unexpected error occurred' };
  }
}
