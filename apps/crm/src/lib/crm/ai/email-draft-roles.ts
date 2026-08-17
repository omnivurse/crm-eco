/**
 * Roles allowed to request an AI email draft.
 *
 * Single source of truth shared by the server gate
 * (`app/api/crm/ai/email-draft/route.ts`) and the ⌘K palette's client-side
 * offer (`CommandPalette.tsx`), so the palette never advertises an action the
 * API would 403 — and never hides one it would allow.
 *
 * Client-safe: no server imports.
 */
import type { CrmRole } from '@/lib/crm/types';

export const AI_EMAIL_DRAFT_ROLES: readonly CrmRole[] = ['crm_admin', 'crm_manager', 'crm_agent'];

/** True when `role` may request an AI email draft. Unknown / missing roles are denied. */
export function canDraftAiEmail(role: string | null | undefined): boolean {
  return (AI_EMAIL_DRAFT_ROLES as readonly string[]).includes(role ?? '');
}
