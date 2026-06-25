import 'server-only';

import { cache } from 'react';
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';

export interface PortalTenant {
  organizationId: string;
  branding: Record<string, unknown>;
}

/**
 * Resolves the active member's organization and its canonical branding
 * (organizations.branding jsonb) for server-side theming of the portal.
 *
 * WHY THIS IS A *SOFT* RESOLVER (no redirect):
 * This runs in the root layout, which wraps EVERY route — including the
 * unauthenticated/public ones ((auth) login, /access-denied, public enroll &
 * pricing pages). The redirecting gate `requireActiveMembership()` belongs to
 * the (member) route group layout, NOT here: calling it in the root layout
 * would bounce unauthenticated visitors off /login (redirect loop) and off the
 * public marketing pages. So we resolve the member context the same way
 * `requireActiveMembership` does internally — `getMemberForUser()` against the
 * cookie/SSR client — but return `null` instead of redirecting when there is no
 * member. Branding then simply falls through to the theme.css defaults on
 * public pages.
 *
 * WHY A SERVICE-ROLE CLIENT FOR THE BRANDING READ:
 * Portal members live in `members`/`memberships`, NOT `organization_members`,
 * so the `my_organizations` view is empty for them and they have no RLS SELECT
 * grant on `organizations` — a cookie/SSR client would read 0 rows for the
 * branding column. We therefore resolve the org id from the authenticated
 * member context first, then read the SINGLE `branding` column with a
 * service-role client scoped to that one own-org id (`.eq('id', orgId)`). This
 * mirrors the elevated own-org posture already used by the enroll flow
 * (apps/portal/src/app/enroll/[slug]/page.tsx → createServiceRoleClient()).
 *
 * Cached per request via React's `cache()`.
 *
 * @returns the org id + branding (empty `{}` on a branding miss so callers fall
 *          through to the theme.css defaults), or `null` when there is no
 *          authenticated member org (public/unauthenticated pages).
 */
export const getPortalTenant = cache(async (): Promise<PortalTenant | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const ctx = await getMemberForUser(supabase, user.id);
  const organizationId = ctx?.member.organization_id;

  if (!organizationId) return null;

  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from('organizations')
    .select('branding')
    .eq('id', organizationId)
    .maybeSingle();

  const branding = (data?.branding ?? {}) as Record<string, unknown>;

  return { organizationId, branding };
});
