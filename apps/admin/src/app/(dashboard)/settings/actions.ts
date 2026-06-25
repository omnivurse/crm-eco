'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant, type TenantRole } from '@/lib/tenant';

/**
 * Tenant branding + provisioning server actions
 * ----------------------------------------------------------------
 * `organizations.branding` (jsonb, DEFAULT '{}') is the CANONICAL
 * brand store for the whole platform — CRM, admin, portal, and the
 * server-rendered theming <style> in each app's root layout all read
 * from it. The `admin_settings` branding columns
 * (`default_primary_color`, `default_secondary_color`,
 * `default_logo_url`, `company_name`) are now deprecated; the admin
 * Settings page keeps reading them only as a backwards-compat shim and
 * must not be treated as the source of truth.
 *
 * Provisioning writes go through the normal cookie/SSR Supabase client
 * (NOT service-role) so the database RLS policy
 * `organizations_update_owner_admin` (roles owner/super_admin/admin)
 * is the real gatekeeper. The app-level role check below mirrors that
 * policy so we fail fast with a friendly error instead of bouncing off
 * an RLS 403, but it is defense-in-depth — RLS remains authoritative.
 */

/**
 * Canonical shape of the `organizations.branding` jsonb. Every key is
 * optional; an empty object ('{}') means "use the theme.css defaults".
 *
 * Keys are snake_case to match the SINGLE shape every existing reader
 * already resolves:
 *   - the server-rendered theming layer, packages/ui/src/lib/branding.ts
 *     readColor() (flat fallback `branding.primary_color`),
 *   - the email brand vars, packages/lib/src/email/email-service.ts
 *     getBrandVars() (`branding.primary_color` / `logo_url` / `company_name`),
 *   - the enrollment-contract edge function
 *     (supabase/functions/generate-enrollment-contract/index.ts reads
 *     `branding.primary_color`).
 * Writing camelCase here would store branding NONE of those readers pick up,
 * silently no-op'ing the theme override — so we keep snake_case.
 */
export interface OrgBranding {
  /** Primary brand color, hex (maps onto the `--primary` token). */
  primary_color?: string;
  /** Secondary brand color, hex (maps onto the `--secondary` token). */
  secondary_color?: string;
  /** Accent color, hex (maps onto the `--accent` token). */
  accent_color?: string;
  /** Public logo URL shown in headers / enrollment pages. */
  logo_url?: string;
  /** Display / company name shown in branded surfaces. */
  company_name?: string;
}

export interface SaveOrgBrandingInput {
  branding: OrgBranding;
  /** Optional tenant subdomain (e.g. `acme` → acme.admin.doublehelix.com). */
  subdomain?: string | null;
  /** Optional vanity domain (e.g. `portal.acme.com`). */
  domain?: string | null;
}

export type SaveOrgBrandingResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: SaveOrgBrandingError };

export type SaveOrgBrandingError =
  | 'unauthorized'
  | 'no_tenant'
  | 'forbidden'
  | 'subdomain_or_domain_taken'
  | 'save_failed';

/** Roles allowed to write organization branding/provisioning fields.
 *  Mirrors the RLS policy `organizations_update_owner_admin`. */
const ORG_WRITE_ROLES: readonly TenantRole[] = ['owner', 'super_admin', 'admin'];

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Legacy admin_settings seed-default colors. These map 1:1 to the old
// admin Settings defaults and are treated as "not customized" so an org
// that never changed its colors stays at branding = '{}' and renders the
// theme.css defaults (PIFH-safe — same opt-in rule as the SQL backfill).
const SEED_PRIMARY = '#1e40af';
const SEED_SECONDARY = '#3b82f6';

/**
 * Strip / normalize the branding object so we never persist empty
 * strings, non-brand keys, or the legacy seed-default colors. An object
 * that normalizes to `{}` is stored as `{}` so the org provably falls
 * through to the theme.css defaults (this is exactly how PIFH stays on
 * the cyan default).
 */
function normalizeBranding(input: OrgBranding): OrgBranding {
  const out: OrgBranding = {};

  const setColor = (
    key: 'primary_color' | 'secondary_color' | 'accent_color',
    raw?: string,
    seedDefault?: string,
  ) => {
    if (!raw) return;
    const v = raw.trim();
    if (!v || !HEX_COLOR.test(v)) return;
    // Drop seed defaults so unchanged orgs keep branding minimal / '{}'.
    if (seedDefault && v.toLowerCase() === seedDefault.toLowerCase()) return;
    out[key] = v;
  };

  setColor('primary_color', input.primary_color, SEED_PRIMARY);
  setColor('secondary_color', input.secondary_color, SEED_SECONDARY);
  setColor('accent_color', input.accent_color);

  const logo = input.logo_url?.trim();
  if (logo) out.logo_url = logo;

  const company = input.company_name?.trim();
  if (company) out.company_name = company;

  return out;
}

/**
 * Normalize an optional subdomain/domain. Returns:
 *   - `undefined` when the field was not provided (do not touch column)
 *   - `null` when the user explicitly cleared it (write NULL)
 *   - a cleaned string otherwise
 */
function normalizeSlugField(
  raw: string | null | undefined,
  kind: 'subdomain' | 'domain',
): string | null | undefined {
  if (raw === undefined) return undefined; // untouched
  if (raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null; // explicit clear

  if (kind === 'subdomain') {
    // Store the normalized (lowercased/trimmed) value as-typed. The DB
    // unique constraint organizations_subdomain_key is the real collision
    // guard (mapped to subdomain_or_domain_taken on 23505); we keep format
    // validation soft so we never reject a value the DB would accept.
    return v;
  }
  // domain: strip protocol + trailing slash, keep the host
  return v.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/**
 * Persist branding (+ optional subdomain/domain) for the CURRENT tenant.
 *
 * Writes via the cookie/SSR Supabase client so RLS
 * `organizations_update_owner_admin` applies. The unique constraints
 * `organizations_subdomain_key` / `organizations_domain_key` already
 * exist — a collision surfaces as Postgres error 23505, which we map to
 * `subdomain_or_domain_taken`. We never create a unique index here.
 */
export async function saveOrgBranding(
  input: SaveOrgBrandingInput,
): Promise<SaveOrgBrandingResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // Resolve the active tenant (also verifies membership) and the
  // user's role *within that tenant*.
  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: 'no_tenant' };

  // App-level mirror of RLS `organizations_update_owner_admin`.
  if (!ORG_WRITE_ROLES.includes(tenant.role)) {
    return { ok: false, error: 'forbidden' };
  }

  // Build the update payload. `branding` is always written (canonical
  // store). subdomain/domain only when provided.
  const updates: {
    branding: OrgBranding;
    subdomain?: string | null;
    domain?: string | null;
  } = {
    branding: normalizeBranding(input.branding),
  };

  const subdomain = normalizeSlugField(input.subdomain, 'subdomain');
  if (subdomain !== undefined) updates.subdomain = subdomain;

  const domain = normalizeSlugField(input.domain, 'domain');
  if (domain !== undefined) updates.domain = domain;

  // `organizations` is a platform-global table (see tenant-supabase.ts
  // PLATFORM_GLOBAL_TABLES) — write it directly, scoped by id, NOT via
  // the org-stamping fromTenant() helper.
  const { error } = await (supabase as any)
    .from('organizations')
    .update(updates)
    .eq('id', tenant.organizationId);

  if (error) {
    // 23505 = unique_violation on organizations_subdomain_key /
    // organizations_domain_key.
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      return { ok: false, error: 'subdomain_or_domain_taken' };
    }
    console.error('[saveOrgBranding] update failed:', error);
    return { ok: false, error: 'save_failed' };
  }

  return { ok: true, organizationId: tenant.organizationId };
}

/**
 * Read the canonical branding (+ subdomain/domain) for the current
 * tenant so the Settings editor can hydrate without going through the
 * deprecated `admin_settings` columns. `getActiveTenant()` already
 * carries `branding`, but it does not surface `domain`, so we read the
 * organization row directly (RLS-scoped) here.
 */
export async function getOrgBranding(): Promise<{
  ok: boolean;
  branding: OrgBranding;
  subdomain: string | null;
  domain: string | null;
}> {
  const empty = { ok: false, branding: {} as OrgBranding, subdomain: null, domain: null };

  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return empty;

  const { data, error } = await (supabase as any)
    .from('organizations')
    .select('branding, subdomain, domain')
    .eq('id', tenant.organizationId)
    .single();

  if (error || !data) return empty;

  return {
    ok: true,
    branding: (data.branding ?? {}) as OrgBranding,
    subdomain: (data.subdomain ?? null) as string | null,
    domain: (data.domain ?? null) as string | null,
  };
}
