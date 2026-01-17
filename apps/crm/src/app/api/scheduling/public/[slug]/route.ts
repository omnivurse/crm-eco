import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/scheduling/public/[slug]
 * Get public scheduling link info by slug (no auth required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { data: link, error } = await supabase
      .from('scheduling_links')
      .select(`
        id,
        name,
        slug,
        description,
        duration_minutes,
        meeting_type,
        location,
        availability,
        timezone,
        min_notice_hours,
        max_days_in_advance,
        custom_questions,
        is_active,
        owner_id,
        org_id
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !link) {
      return NextResponse.json({ error: 'Scheduling link not found' }, { status: 404 });
    }

    // Get owner info
    const { data: owner } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', link.owner_id)
      .single();

    // Get organization info
    const { data: org } = await supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', link.org_id)
      .single();

    return NextResponse.json({
      ...link,
      owner: owner || { full_name: 'Team Member' },
      organization: org || { name: 'Organization' },
    });
  } catch (error) {
    console.error('Failed to fetch scheduling link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
