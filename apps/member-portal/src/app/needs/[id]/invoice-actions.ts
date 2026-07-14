'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  getMemberForUser,
  computeInvoiceTotals,
  lineItemAmount,
  type NeedInvoice,
  type NeedInvoiceLineItem,
} from '@crm-eco/lib';
import { revalidatePath } from 'next/cache';

interface SaveResult {
  success: boolean;
  message: string;
}

/**
 * Persist a member-built itemized invoice onto their Need. Amounts are always
 * recomputed server-side (never trusted from the client), the invoice is merged
 * into `custom_fields` (preserving the share-request data), and the subtotal is
 * mirrored to `billed_amount` so the amounts card reflects it.
 */
export async function saveNeedInvoice(
  needId: string,
  invoice: NeedInvoice,
): Promise<SaveResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Authentication required.' };

  const context = await getMemberForUser(supabase, user.id);
  if (!context) return { success: false, message: 'Member profile not found.' };

  const { member, profile } = context;
  if (!member.organization_id) return { success: false, message: 'Organization not found.' };

  // Ownership check + pull existing custom_fields to merge into.
  const { data: existing, error: fetchError } = await (supabase as any)
    .from('needs')
    .select('id, member_id, organization_id, custom_fields')
    .eq('id', needId)
    .eq('member_id', member.id)
    .eq('organization_id', member.organization_id)
    .single();

  if (fetchError || !existing) {
    return { success: false, message: 'Request not found or access denied.' };
  }

  // Sanitize + recompute server-side.
  const cleanItems: NeedInvoiceLineItem[] = (invoice?.line_items ?? [])
    .filter((li) => li && (String(li.description || '').trim() || li.amount || li.unit_price))
    .slice(0, 200) // hard cap
    .map((li, idx) => {
      const quantity = Number(li.quantity) || 0;
      const unit_price = Number(li.unit_price) || 0;
      // Prefer an explicit amount when provided; otherwise qty × unit price.
      const amount =
        li.amount !== undefined && li.amount !== null && !Number.isNaN(Number(li.amount))
          ? Math.round((Number(li.amount) + Number.EPSILON) * 100) / 100
          : lineItemAmount(quantity, unit_price);
      return {
        id: typeof li.id === 'string' && li.id ? li.id : `li-${idx}-${Date.now()}`,
        description: String(li.description || '').slice(0, 500),
        code: li.code ? String(li.code).slice(0, 60) : null,
        quantity,
        unit_price,
        amount,
        source_attachment_id: li.source_attachment_id ? String(li.source_attachment_id) : null,
      };
    });

  const cleanInvoice: NeedInvoice = {
    line_items: cleanItems,
    self_pay_adjustment: Math.max(0, Number(invoice?.self_pay_adjustment) || 0),
    notes: String(invoice?.notes || '').slice(0, 2000),
    updated_at: new Date().toISOString(),
  };

  const totals = computeInvoiceTotals(cleanInvoice);

  const existingCustom =
    existing.custom_fields && typeof existing.custom_fields === 'object'
      ? (existing.custom_fields as Record<string, unknown>)
      : {};

  const updatePayload: Record<string, unknown> = {
    custom_fields: { ...existingCustom, invoice: cleanInvoice },
    updated_at: new Date().toISOString(),
  };
  // Mirror the billed subtotal onto the indexed column so it displays/filters.
  if (totals.subtotal > 0) updatePayload.billed_amount = totals.subtotal;

  const { error: updateError } = await (supabase as any)
    .from('needs')
    .update(updatePayload)
    .eq('id', needId);

  if (updateError) {
    return { success: false, message: 'Failed to save the invoice. Please try again.' };
  }

  await (supabase as any).from('need_events').insert({
    need_id: needId,
    organization_id: member.organization_id,
    event_type: 'invoice_updated',
    description: `Member itemized invoice updated (${cleanItems.length} line item${
      cleanItems.length === 1 ? '' : 's'
    })`,
    created_by_profile_id: profile.id,
  });

  revalidatePath(`/needs/${needId}`);
  return { success: true, message: 'Invoice saved.' };
}
