import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/crm/duplicates
 *
 * Paginated list of probable-duplicate pairs for the caller's org,
 * backed by the `crm_probable_duplicates` view. Drives the Review
 * Duplicates page.
 *
 * Query params:
 *   - confidence : 'all' | 'high' | 'medium' | 'low'
 *   - module_id  : optional UUID — restrict to one CRM module
 *   - search     : optional substring — matches either left or right title
 *   - page       : 1-based page number (default 1)
 *   - page_size  : default 20, max 50
 */

const querySchema = z.object({
  confidence: z.enum(['all', 'high', 'medium', 'low']).default('all'),
  module_id: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { error: 'Only CRM admins and managers can review duplicates' },
        { status: 403 },
      );
    }

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid query' },
        { status: 400 },
      );
    }

    const { confidence, module_id, search, page, page_size } = parsed.data;
    const supabase = await createClient();

    // The view already enforces RLS (security_invoker), so we only
    // need to filter on caller-visible columns. The .eq('org_id', ...)
    // filter is defense-in-depth.
    let query = supabase
      .from('crm_probable_duplicates')
      .select('*', { count: 'exact' })
      .eq('org_id', profile.organization_id);

    if (confidence !== 'all') {
      query = query.eq('confidence', confidence);
    }
    if (module_id) {
      query = query.eq('module_id', module_id);
    }
    if (search) {
      // Titles can live on either side — match either column.
      const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
      query = query.or(
        `left_title.ilike.%${escaped}%,right_title.ilike.%${escaped}%`,
      );
    }

    const from = (page - 1) * page_size;
    const to = from + page_size - 1;
    query = query
      .order('confidence', { ascending: true }) // high < low alphabetically — override below
      .order('left_updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) {
      console.error('[duplicates] query error:', error);
      return NextResponse.json(
        { error: 'Failed to load duplicate pairs' },
        { status: 500 },
      );
    }

    // Confidence is a text column; sort client-side by semantic order.
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const rows = (data || []).slice().sort((a: any, b: any) => {
      const rc = (rank[a.confidence] ?? 3) - (rank[b.confidence] ?? 3);
      if (rc !== 0) return rc;
      const au = a.left_updated_at ? Date.parse(a.left_updated_at) : 0;
      const bu = b.left_updated_at ? Date.parse(b.left_updated_at) : 0;
      return bu - au;
    });

    return NextResponse.json({
      pairs: rows,
      page,
      page_size,
      total: count ?? rows.length,
    });
  } catch (err) {
    console.error('[duplicates] unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
