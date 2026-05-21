import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { randomUUID } from 'crypto';
import {
  readDraftFromRequest,
  setDraftCookie,
  clearDraftCookie,
  type EnrollmentDraft,
} from '@/lib/enroll/draft-cookie';

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
 * Creates or updates a draft. Body: { slug, data: {...} }
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
    .select('id, organization_id')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (landingErr || !landing) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 404 });
  }

  const existing = readDraftFromRequest(request);
  const draft: EnrollmentDraft = {
    draftId: existing?.slug === slug ? existing.draftId : randomUUID(),
    organizationId: landing.organization_id,
    slug,
    createdAt: existing?.slug === slug ? existing.createdAt : Date.now(),
    data: { ...(existing?.slug === slug ? existing.data : {}), ...(data ?? {}) },
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
