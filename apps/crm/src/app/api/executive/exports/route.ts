import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/executive/exports
 *
 * Lists warehouse exports for the current org.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || '20'), 100);

    const { data, error } = await supabase
      .from('warehouse_exports')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ exports: data || [] });
  } catch (error) {
    console.error('Error fetching exports:', error);
    return NextResponse.json({ error: 'Failed to fetch exports' }, { status: 500 });
  }
}

/**
 * POST /api/executive/exports
 *
 * Triggers a warehouse snapshot export.
 * Admin-only. Idempotent via snapshot function.
 *
 * Body:
 *   export_type – 'commissions' | 'rankings' | 'agencies' | 'kpis' | 'full'
 *   month       – optional period (YYYY-MM-DD)
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createClient();

    const validTypes = ['commissions', 'rankings', 'agencies', 'kpis', 'full'];
    if (!body.export_type || !validTypes.includes(body.export_type)) {
      return NextResponse.json(
        { error: `export_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc('generate_warehouse_snapshot', {
      p_org_id: profile.organization_id,
      p_export_type: body.export_type,
      p_month: body.month || null,
      p_actor_id: profile.id,
    });

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error generating warehouse export:', error);
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}
