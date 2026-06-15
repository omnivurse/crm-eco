/**
 * Normalize `convert_lead_to_contact` RPC payloads for the CRM API + dialog.
 * Handles idempotent "already converted" and duplicate-email merge paths.
 */

export interface LeadConversionApiResult {
  success: boolean;
  contact_id?: string;
  contact_title?: string;
  contact_status?: string;
  message?: string;
  error?: string;
  /** Lead was converted earlier — contact_id is the linked contact. */
  already_converted?: boolean;
  /** Email matches an existing contact — offer merge. */
  suggest_merge?: boolean;
  existing_contact_id?: string;
  insurance_repair?: Record<string, unknown>;
  insurance_repair_failed?: boolean;
  insurance_repair_error?: string;
}

function readContactId(raw: Record<string, unknown>): string | undefined {
  for (const key of ['contact_id', 'converted_contact_id', 'existing_contact_id'] as const) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** Map RPC JSONB to a stable API shape the dialog understands. */
export function normalizeLeadConversionRpcResult(
  raw: unknown,
): LeadConversionApiResult {
  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'Invalid conversion response from server' };
  }

  const r = raw as Record<string, unknown>;
  const contactId = readContactId(r);
  const error = typeof r.error === 'string' ? r.error : undefined;
  const message = typeof r.message === 'string' ? r.message : undefined;

  if (r.success === true && contactId) {
    return {
      success: true,
      contact_id: contactId,
      contact_title: typeof r.contact_title === 'string' ? r.contact_title : undefined,
      contact_status: typeof r.contact_status === 'string' ? r.contact_status : undefined,
      message: message ?? 'Lead converted to contact successfully',
    };
  }

  if (
    r.success === false &&
    contactId &&
    error?.toLowerCase().includes('already been converted')
  ) {
    return {
      success: true,
      contact_id: contactId,
      contact_title: typeof r.contact_title === 'string' ? r.contact_title : undefined,
      already_converted: true,
      message: 'This lead is already linked to a contact. You can open the contact record below.',
    };
  }

  if (r.success === false && typeof r.existing_contact_id === 'string') {
    return {
      success: false,
      error: error ?? 'A contact with this email already exists',
      existing_contact_id: r.existing_contact_id,
      suggest_merge: true,
    };
  }

  if (r.success === true && !contactId) {
    return {
      success: false,
      error: message ?? error ?? 'Conversion reported success but no contact was returned',
    };
  }

  return {
    success: false,
    error: error ?? message ?? 'Failed to convert lead to contact',
    existing_contact_id:
      typeof r.existing_contact_id === 'string' ? r.existing_contact_id : contactId,
  };
}

/** Whether a lead record should hide Convert actions and show View Contact. */
export function isLeadRecordConverted(record: {
  status?: string | null;
  data?: Record<string, unknown> | null;
}): boolean {
  if ((record.status ?? '') === 'Converted') return true;
  const data = record.data ?? {};
  if (data.is_converted === true || data.is_converted === 'true') return true;
  if (data.lead_status === 'Converted') return true;
  const cid = data.converted_contact_id;
  return typeof cid === 'string' && cid.trim().length > 0;
}

export function getConvertedContactId(
  data?: Record<string, unknown> | null,
): string | undefined {
  if (!data) return undefined;
  const cid = data.converted_contact_id;
  return typeof cid === 'string' && cid.trim().length > 0 ? cid.trim() : undefined;
}
