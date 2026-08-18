import type { AuthRailStation } from './auth-rail';

/**
 * Which product a sign-in surface belongs to.
 *
 * The family owns exactly two pigments — cyan (CRM Core) and emerald (Admin
 * Enrollment / MMS); amber is semantic and means money, never brand. So the
 * surfaces are told apart by WHICH pigment leads and HOW LOUDLY the second
 * strand answers, not by inventing new hues:
 *
 *   crm      cyan leads,    counter quiet   CRM Core
 *   admin    emerald leads, counter quiet   Admin Enrollment (MMS)
 *   advisor  cyan leads,    counter raised  the advisor works a book of
 *                                           business (a CRM object) but what
 *                                           they produce is an enrollment
 *                                           (an MMS object) — they stand on
 *                                           the seam, cyan side
 *   member   emerald leads, counter raised  a member IS the record enrollment
 *                                           minted, and the person the book is
 *                                           about — the same seam, mirrored
 *   default  neither leads                  the house / unbranded surface
 *
 * The tone tokens themselves are switched on `[data-auth-variant]` in
 * packages/ui/src/styles/auth.css.
 */
export type AuthVariant = 'crm' | 'admin' | 'member' | 'advisor' | 'default';

/** Product wordline used by the compact (< lg) brand bar. */
export const AUTH_VARIANT_LABEL: Record<AuthVariant, string> = {
  crm: 'CRM Core',
  admin: 'Admin Enrollment',
  member: 'Member Portal',
  advisor: 'Advisor Portal',
  default: 'Double Helix',
};

/* ---- default station sets ------------------------------------------------
   These live here rather than beside the component so auth-rail.tsx exports
   nothing but its component (react-refresh/only-export-components).
   -------------------------------------------------------------------------- */

/**
 * The record types each surface carries, in order. These fix the strand's
 * geometry (how many turns it makes over the panel) and are NOT rendered as
 * text unless a caller opts in with `showRailStations` — so no new copy ships
 * on a production sign-in page by default.
 *
 * The nouns are the ones the landings already use for the same rungs; see
 * STATIONS in apps/crm/.../CrmLandingPage.tsx and apps/admin/.../AdminLandingPage.tsx.
 */
export const AUTH_RAIL_STATIONS: Record<AuthVariant, AuthRailStation[]> = {
  crm: [
    { id: 'lead', label: 'Lead' },
    { id: 'contact', label: 'Contact' },
    { id: 'enrollment', label: 'Enrollment' },
    { id: 'member', label: 'Member' },
    { id: 'commission', label: 'Commission' },
  ],
  admin: [
    { id: 'application', label: 'Application' },
    { id: 'signature', label: 'Signature' },
    { id: 'coverage', label: 'Coverage' },
    { id: 'billing', label: 'Billing' },
    { id: 'member', label: 'Member' },
  ],
  advisor: [
    { id: 'contact', label: 'Contact' },
    { id: 'enrollment', label: 'Enrollment' },
    { id: 'member', label: 'Member' },
    { id: 'commission', label: 'Commission' },
  ],
  member: [
    { id: 'household', label: 'Household' },
    { id: 'plan', label: 'Plan' },
    { id: 'coverage', label: 'Coverage' },
    { id: 'billing', label: 'Billing' },
  ],
  default: [
    { id: 'contacts', label: 'Contacts' },
    { id: 'plans', label: 'Plans' },
    { id: 'billing', label: 'Billing' },
    { id: 'commissions', label: 'Commissions' },
  ],
};
