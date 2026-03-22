import { CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH } from '@/lib/crm/record-form-defaults';

export interface MergeCrmDataJsonContext {
  /** For PATCH: previous row title when first/last clear. */
  previousTitle?: string | null;
}

/**
 * Maps JSONB `data` onto indexed `crm_records` columns (shared by POST and PATCH).
 */
export function mergeCrmDataJsonIntoRowColumns(
  d: Record<string, unknown>,
  ctx: MergeCrmDataJsonContext = {}
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (d.email !== undefined) updates.email = d.email || null;
  if (d.phone !== undefined) updates.phone = d.phone || null;

  if (d.first_name !== undefined || d.last_name !== undefined) {
    const first = (d.first_name as string) || '';
    const last = (d.last_name as string) || '';
    updates.title = ([first, last].filter(Boolean).join(' ') || ctx.previousTitle) ?? null;
  }

  if (d.contact_status !== undefined) updates.status = d.contact_status || null;
  if (d.lead_status !== undefined) updates.status = d.lead_status || null;
  if (d.status !== undefined) updates.status = d.status || null;

  for (const key of CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH) {
    if (d[key] !== undefined) {
      updates[key] = d[key];
    }
  }

  // Deals / accounts: display name only in JSONB
  if (d.title !== undefined) {
    updates.title = ((d.title as string) || ctx.previousTitle) ?? null;
  }
  if (d.name !== undefined && updates.title === undefined) {
    updates.title = ((d.name as string) || ctx.previousTitle) ?? null;
  }

  return updates;
}
