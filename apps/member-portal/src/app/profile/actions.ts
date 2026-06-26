'use server';

import { revalidatePath } from 'next/cache';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MemberProfileInput {
  first_name: string;
  last_name: string;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

/**
 * Persist a member's own editable profile fields.
 *
 * WHY service-role + verify-ownership-in-code (not the RLS/cookie client):
 * `members` has NO member self-update RLS policy (only advisors + service_role —
 * verified against live pg_policies). A member updating their own row through the
 * RLS client silently affects 0 rows ("saved but wrong"). requireActiveMembership()
 * already resolves and proves ctx.member is THIS user's own member, so a
 * service-role update scoped to that exact id is self-only and safe. We confirm a
 * row came back so a failed write surfaces as an error instead of a fake success.
 */
export async function updateMemberProfile(
  input: MemberProfileInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireActiveMembership();

    if (!input.first_name?.trim() || !input.last_name?.trim()) {
      return { success: false, error: 'First and last name are required' };
    }

    const service = createServiceRoleClient();
    const { data, error } = await (service as any)
      .from('members')
      .update({
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        phone: input.phone ?? null,
        address_line1: input.address_line1 ?? null,
        address_line2: input.address_line2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postal_code: input.postal_code ?? null,
      })
      // Scope to the gate-verified, self-owned member AND its org (defense in depth).
      .eq('id', ctx.member.id)
      .eq('organization_id', ctx.member.organization_id)
      .select('id')
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Profile could not be saved. Please try again.' };

    revalidatePath('/profile');
    return { success: true, data: { id: data.id } };
  } catch {
    return { success: false, error: 'An unexpected error occurred' };
  }
}
