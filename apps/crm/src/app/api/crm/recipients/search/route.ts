import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

/**
 * GET /api/crm/recipients/search?q=<query>
 * Search contacts and leads by email or name for compose autocomplete.
 * Returns results with record type (contact/lead) based on module key.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ recipients: [] });
    }

    // Sanitize to prevent Supabase filter injection
    const safeQuery = q.replace(/[%_\\]/g, '\\$&');

    const supabase = await createClient();

    // Look up contacts and leads module IDs for this org
    const { data: modules } = await supabase
      .from('crm_modules')
      .select('id, key')
      .eq('org_id', profile.organization_id)
      .in('key', ['contacts', 'leads']);

    if (!modules || modules.length === 0) {
      return NextResponse.json({ recipients: [] });
    }

    const moduleIds = modules.map(m => m.id);
    const moduleKeyMap: Record<string, string> = {};
    for (const m of modules) {
      moduleKeyMap[m.id] = m.key;
    }

    // Search records within contacts and leads modules
    const { data, error } = await supabase
      .from('crm_records')
      .select('id, title, email, phone, module_id, data')
      .eq('org_id', profile.organization_id)
      .in('module_id', moduleIds)
      .or(`title.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
      .not('email', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Recipient search error:', error);
      return NextResponse.json({ recipients: [] });
    }

    const recipients = (data || []).map(r => {
      const moduleKey = moduleKeyMap[r.module_id] || 'unknown';
      const recordData = (r.data || {}) as Record<string, unknown>;

      return {
        id: r.id,
        name: r.title || null,
        email: r.email,
        phone: r.phone || null,
        type: moduleKey === 'contacts' ? 'contact' : moduleKey === 'leads' ? 'lead' : 'unknown',
        // Include fields needed for merge field resolution
        first_name: (recordData.first_name as string) || null,
        last_name: (recordData.last_name as string) || null,
        company: (recordData.company as string) || (recordData.company_association as string) || null,
        title_field: (recordData.title as string) || (recordData.job_title as string) || null,
      };
    });

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('Error in GET /api/crm/recipients/search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
