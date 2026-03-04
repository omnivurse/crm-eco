import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const EXTENSION_CATEGORIES = [
  'communication', 'analytics', 'automation', 'data',
  'finance', 'compliance', 'productivity', 'utility', 'custom',
] as const;

const EXTENSION_TYPES = [
  'plugin', 'integration', 'theme', 'widget', 'automation', 'report',
] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/extensions?category=analytics&type=plugin&featured=true&search=email
// Browse the extension catalog (published extensions)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const category = request.nextUrl.searchParams.get('category');
    const type = request.nextUrl.searchParams.get('type');
    const featured = request.nextUrl.searchParams.get('featured') === 'true';
    const search = request.nextUrl.searchParams.get('search');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('crm_extensions')
      .select('*', { count: 'exact' })
      .eq('status', 'published')
      .order('is_featured', { ascending: false })
      .order('install_count', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category && EXTENSION_CATEGORIES.includes(category as typeof EXTENSION_CATEGORIES[number])) {
      query = query.eq('category', category);
    }
    if (type && EXTENSION_TYPES.includes(type as typeof EXTENSION_TYPES[number])) {
      query = query.eq('extension_type', type);
    }
    if (featured) query = query.eq('is_featured', true);
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) {
      console.error('[Extensions] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch extensions' }, { status: 500 });
    }

    // Also fetch installed extension IDs for this org
    const { data: installs } = await supabase
      .from('crm_extension_installs')
      .select('extension_id, status')
      .eq('organization_id', profile.organization_id);

    const installMap = new Map(
      (installs || []).map((i) => [i.extension_id, i.status])
    );

    const extensions = (data || []).map((ext) => ({
      ...ext,
      installed: installMap.has(ext.id),
      install_status: installMap.get(ext.id) || null,
    }));

    return NextResponse.json({ extensions, total: count || 0 });
  } catch (error) {
    console.error('[Extensions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
