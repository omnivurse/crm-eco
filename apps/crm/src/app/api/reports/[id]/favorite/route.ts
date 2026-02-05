import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// PATCH /api/reports/[id]/favorite - Toggle favorite status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current favorite status
    const { data: report, error: fetchError } = await supabase
      .from('crm_reports')
      .select('id, is_favorite')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Toggle favorite
    const { data: updated, error: updateError } = await supabase
      .from('crm_reports')
      .update({ is_favorite: !report.is_favorite })
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select('id, is_favorite')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 });
  }
}
