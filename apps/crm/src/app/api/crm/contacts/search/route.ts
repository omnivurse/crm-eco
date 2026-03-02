import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

/**
 * GET /api/crm/contacts/search?q=<query>
 * Search contacts and leads by email or name for autocomplete
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ contacts: [] });
    }

    // Sanitize to prevent Supabase filter injection
    const safeQuery = q.replace(/[%_\\]/g, '\\$&');

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('crm_records')
      .select('id, title, email, phone, module_id')
      .eq('org_id', profile.organization_id)
      .or(`title.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
      .not('email', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Contact search error:', error);
      return NextResponse.json({ contacts: [] });
    }

    const contacts = (data || []).map(r => ({
      id: r.id,
      name: r.title || null,
      email: r.email,
      phone: r.phone || null,
    }));

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Error in GET /api/crm/contacts/search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
