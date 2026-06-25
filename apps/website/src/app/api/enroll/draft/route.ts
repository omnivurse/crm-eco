import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { randomUUID } from 'crypto';
import {
  readDraftFromRequest,
  setDraftCookie,
  clearDraftCookie,
  type EnrollmentDraft,
} from '@crm-eco/lib/enroll';

export const dynamic = 'force-dynamic';

/**
 * GET /api/enroll/draft?slug=...
 * Returns the current draft (if any) for the given slug.
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
 * Creates or updates a draft for the public WEBSITE enrollment software.
 * Body: { slug, data?: {...} }
 *
 * The signed draft cookie is the anon prospect's identity/ownership token for the
 * whole public enrollment flow — there is NO login. We never trust the client for
 * the tenant or advisor: organization_id, the landing-page id, and the landing
 * page's default advisor are all resolved HERE from the published landing_pages
 * row and baked into the signed cookie, so submit/* can rely on them without
 * re-resolving (and without a malicious client being able to spoof a different
 * org/advisor).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { slug, data } = body as { slug?: string; data?: Record<string, unknown> };

  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: landing, error: landingErr } = await supabase
    .from('landing_pages')
    .select('id, organization_id, default_advisor_id')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (landingErr || !landing) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 404 });
  }

  const existing = readDraftFromRequest(request);
  const sameSlug = existing?.slug === slug;

  // Website-specific identity baked into the SIGNED draft (server-trusted, never
  // client-supplied): which published landing page this enrollment came through
  // and the advisor it should be attributed to. Mirrors the advisor flow in
  // api/enroll/public (landing_pages.default_advisor_id). The submit route reads
  // these from draft.data so the prospect's browser can never spoof them.
  const draft: EnrollmentDraft = {
    draftId: sameSlug ? existing!.draftId : randomUUID(),
    organizationId: landing.organization_id,
    slug,
    createdAt: sameSlug ? existing!.createdAt : Date.now(),
    data: {
      ...(sameSlug ? existing!.data : {}),
      ...(data ?? {}),
      // Re-stamped on every write from the trusted landing_pages row so a client
      // can't override them via the merged client `data` above.
      landing_page_id: landing.id,
      advisor_id: landing.default_advisor_id ?? null,
      enrollment_source: 'website',
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
