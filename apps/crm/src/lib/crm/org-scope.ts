/**
 * Organization scoping for the CRM app
 *
 * **Single tenant UUID** for the signed-in user comes from `profiles.organization_id`
 * (`getCurrentProfile` / `getAuthProfile`).
 *
 * **Postgres column names differ by table family:**
 * - `crm_*` core tables (`crm_records`, `crm_modules`, `crm_notes`, …) use **`org_id`**
 *   — always the same UUID as `profiles.organization_id` for that tenant.
 * - `profiles`, `organizations`, and several product tables use **`organization_id`**.
 *
 * **Server code:** pass `profile.organization_id` into query helpers and use `.eq('org_id', …)`
 * on CRM tables, or `.eq('organization_id', …)` where that column exists.
 *
 * **Browser code:** RLS still enforces access; optional `.eq('org_id', organizationId)` from
 * `useTenantOrganizationId()` adds defense-in-depth (see `TenantContext`).
 */

/** Column on `profiles` and related identity tables */
export const PROFILE_ORGANIZATION_COLUMN = 'organization_id' as const;

/** Column on `crm_records`, `crm_modules`, `crm_notes`, and most `crm_*` tables */
export const CRM_ORG_COLUMN = 'org_id' as const;
