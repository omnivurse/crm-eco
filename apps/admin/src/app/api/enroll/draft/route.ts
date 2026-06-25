import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { randomUUID } from 'crypto';
import {
  readDraftFromRequest,
  setDraftCookie,
  clearDraftCookie,
  type EnrollmentDraft,
} from '@crm-eco/lib/enroll';
import { resolveOrgByHost } from '@/lib/enroll-org';

export const dynamic = 'force-dynamic';

/**
 * GET /api/enroll/draft?slug=...
 * Returns the current draft (if any). When a slug is supplied it must match the
 * draft's slug (so a stale cookie from another landing page is ignored).
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  const draft = readDraftFromRequest(request);
  if (!draft) {
    return NextResponse.json({ draft: null });
  }
  if (slug && draft.slug !== slug) {
    return NextResponse.json({ draft: null });
  }
  return NextResponse.json({ draft });
}

/**
 * POST /api/enroll/draft
 * Creates or updates a draft for the public enrollment software.
 * Body: { slug?, data?: {...} }
 *
 * The signed draft cookie is the anon prospect's identity/ownership token for the
 * whole flow — there is NO login. The tenant `organization_id`, the landing-page
 * id, and the landing page's default advisor are all resolved HERE server-side
 * (never trusted from the client) and baked into the signed cookie:
 *
 *  - WITH slug  → from the published `landing_pages` row (agent landing page).
 *  - NO slug    → generic entry; org resolved from the request HOST
 *                 (`organizations.domain`) else the default org (PIFH).
 *
 * The client-supplied `data` is merged first, then the server-trusted fields are
 * re-stamped on top so a malicious client cannot spoof org/advisor/source.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { slug, data } = body as { slug?: string; data?: Record<string, unknown> };

  const supabase = createServiceRoleClient();

  let organizationId: string;
  let landingPageId: string | null = null;
  let advisorId: string | null = null;
  let resolvedSlug = '';
  let enrollmentSource = 'generic_web';

  if (slug) {
    const { data: landing, error: landingErr } = await supabase
      .from('landing_pages')
      .select('id, organization_id, default_advisor_id')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (landingErr || !landing) {
      return NextResponse.json({ error: 'invalid_slug' }, { status: 404 });
    }

    organizationId = landing.organization_id as string;
    landingPageId = (landing.id as string) ?? null;
    advisorId = (landing.default_advisor_id as string | null) ?? null;
    resolvedSlug = slug;
    enrollmentSource = 'website';
  } else {
    // Generic entry (no slug): resolve the tenant from the request host, else the
    // configured default org. No advisor / landing page.
    organizationId = await resolveOrgByHost(supabase, request.headers.get('host'));
  }

  const existing = readDraftFromRequest(request);
  const sameTarget =
    !!existing && existing.slug === resolvedSlug && existing.organizationId === organizationId;

  const draft: EnrollmentDraft = {
    draftId: sameTarget ? existing!.draftId : randomUUID(),
    organizationId,
    slug: resolvedSlug,
    createdAt: sameTarget ? existing!.createdAt : Date.now(),
    data: {
      ...(sameTarget ? existing!.data : {}),
      ...(data ?? {}),
      // Re-stamped from the trusted server resolution so the merged client `data`
      // above can never override them.
      landing_page_id: landingPageId,
      advisor_id: advisorId,
      enrollment_source: enrollmentSource,
    },
  };

  const response = NextResponse.json({ draft });
  setDraftCookie(response, draft);
  return response;
}

/**
 * DELETE /api/enroll/draft
 * Clears the active draft cookie.
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearDraftCookie(response);
  return response;
}
