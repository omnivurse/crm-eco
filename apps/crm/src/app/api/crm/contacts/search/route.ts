import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface SmartSearchRow {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  module_id: string;
  data: Record<string, unknown> | null;
  module_key: string;
  module_name: string;
  module_name_plural: string | null;
  match_type: 'exact' | 'fuzzy';
  rank: number;
}

interface ContactRow {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * GET /api/crm/contacts/search?q=<query>
 *
 * Autocomplete endpoint that returns contacts/leads matching the query
 * by name or email. Uses the typo-tolerant `crm_smart_search` RPC under
 * the hood so misspellings ("Bollman" -> "Bollmann") still surface the
 * right person — same engine as the global search bar.
 *
 * Returns up to 10 contacts, every result has a non-null email
 * (autocomplete consumers expect to fill an email field).
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

    const supabase = await createClient();

    const rows = await fuzzyContactSearch(supabase, profile.organization_id, q);

    const contacts = rows.map((r) => ({
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

/**
 * Run the fuzzy RPC and trim down to up to 10 records that have an email
 * address. Falls back to plain ilike if the RPC isn't available yet
 * (e.g. on a database where the migration hasn't been deployed).
 */
async function fuzzyContactSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  query: string,
): Promise<ContactRow[]> {
  const { data, error } = await supabase.rpc('crm_smart_search', {
    p_org_id: orgId,
    p_query: query,
    p_module_key: null,
    // Pull a wider candidate set so the email filter still leaves enough
    // results after pruning.
    p_limit: 30,
    p_similarity_threshold: 0.25,
  });

  if (!error && Array.isArray(data)) {
    const rows = data as SmartSearchRow[];
    return rows
      .filter((r) => !!r.email)
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        title: r.title,
        email: r.email,
        phone: r.phone,
      }));
  }

  if (error) {
    console.warn(
      '[contacts/search] crm_smart_search RPC failed, falling back to ilike:',
      error.message,
    );
  }

  return ilikeFallback(supabase, orgId, query);
}

async function ilikeFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  query: string,
): Promise<ContactRow[]> {
  const safeQuery = query.replace(/[%_\\]/g, '\\$&');

  const { data, error } = await supabase
    .from('crm_records')
    .select('id, title, email, phone')
    .eq('org_id', orgId)
    .or(`title.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
    .not('email', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[contacts/search] ilike fallback failed:', error);
    return [];
  }

  return (data || []) as ContactRow[];
}
