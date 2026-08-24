/** Display maps for `public.needs` — the table both the member portal and CRM use. */

export const PENDING_NEED_STATUSES = ['new', 'open', 'submitted', 'in_review'] as const;
export const APPROVED_NEED_STATUSES = ['approved', 'paid'] as const;
export const HIGH_URGENCY_LIGHTS = ['orange', 'red'] as const;

export function isPortalShareRequest(customFields: unknown): boolean {
  if (!customFields || typeof customFields !== 'object') return false;
  return 'share_request' in customFields && (customFields as { share_request?: unknown }).share_request != null;
}
