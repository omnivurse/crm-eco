import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';
import {
  applyCrmRecordTextSearch,
  fetchOrgDataJsonKeysForSearch,
  isConvertedLeadRow,
} from '@/lib/crm/record-search';

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
 *
 * Special-cases digit-heavy queries: routes through `crm_phone_lookup`,
 * which strips non-digits from both the query and stored phones, so an
 * "8005558888" search finds a contact stored as "(800) 555-8888" or
 * "1-800-555-8888".
 */
async function fuzzyContactSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  query: string,
): Promise<ContactRow[]> {
  const digits = query.replace(/\D/g, '');
  const compactLen = Math.max(query.replace(/\s/g, '').length, 1);
  const isPhoneOnly =
    digits.length >= 4 &&
    digits.length <= 15 &&
    digits.length / compactLen >= 0.88 &&
    !query.includes('@');

  if (isPhoneOnly) {
    const { data: phoneRows, error: phoneErr } = await supabase.rpc(
      'crm_phone_lookup',
      {
        p_org_id: orgId,
        p_query: digits,
        p_module_key: null,
        p_limit: 30,
      },
    );
    if (!phoneErr && Array.isArray(phoneRows)) {
      const rows = phoneRows as SmartSearchRow[];
      const filtered = rows
        .filter((r) => !!r.email && !isConvertedLeadRow(r))
        .slice(0, 10)
        .map((r) => ({
          id: r.id,
          title: r.title,
          email: r.email,
          phone: r.phone,
        }));
      if (filtered.length > 0) return filtered;
    }
    if (phoneErr) {
      console.warn(
        '[contacts/search] crm_phone_lookup RPC failed:',
        phoneErr.message,
      );
    }
    // Fall through to smart_search as a backup (covers phones in title/data).
  }

  const { data, error } = await supabase.rpc('crm_smart_search', {
    p_org_id: orgId,
    p_query: query,
    p_module_key: null,
    // Pull a wider candidate set so the email filter still leaves enough
    // results after pruning.
    p_limit: 30,
    p_similarity_threshold: 0.2,
  });

  if (!error && Array.isArray(data)) {
    const rows = data as SmartSearchRow[];
    return rows
      .filter((r) => !!r.email && !isConvertedLeadRow(r))
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
  const dataJsonKeys = await fetchOrgDataJsonKeysForSearch(supabase, orgId);

  let qb = supabase
    .from('crm_records')
    .select('id, title, email, phone')
    .eq('org_id', orgId)
    .not('email', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(10);

  qb = applyCrmRecordTextSearch(qb, query, { dataJsonKeys });

  const { data, error } = await qb;
  if (error) {
    console.error('[contacts/search] ilike fallback failed:', error);
    return [];
  }

  return (data || []) as ContactRow[];
}
