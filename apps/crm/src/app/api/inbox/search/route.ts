import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

/**
 * GET /api/inbox/search?q=<query>&from=<email>&has=attachment&date_from=<iso>&date_to=<iso>
 * Full-text search across inbox messages, grouped by conversation
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const from = searchParams.get('from')?.trim();
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!q && !from) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const supabase = await createClient();

    let query = supabase
      .from('inbox_messages')
      .select('id, conversation_id, subject, from_name, from_address, body_text, sent_at, direction, channel', { count: 'exact' })
      .eq('org_id', profile.organization_id)
      .order('sent_at', { ascending: false })
      .limit(limit);

    // Full-text search
    if (q) {
      query = query.textSearch('search_vector', q, {
        type: 'websearch',
        config: 'english',
      });
    }

    // Filter by sender
    if (from) {
      query = query.or(`from_address.ilike.%${from}%,from_name.ilike.%${from}%`);
    }

    // Date range
    if (dateFrom) {
      query = query.gte('sent_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('sent_at', dateTo);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Inbox search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group results by conversation
    const conversationIds = [...new Set((data || []).map(m => m.conversation_id))];

    // Fetch conversation details
    let conversations: Record<string, { subject: string | null; contact_name: string | null; contact_email: string | null }> = {};
    if (conversationIds.length > 0) {
      const { data: convData } = await supabase
        .from('inbox_conversations')
        .select('id, subject, contact_name, contact_email')
        .in('id', conversationIds);

      if (convData) {
        conversations = Object.fromEntries(
          convData.map(c => [c.id, { subject: c.subject, contact_name: c.contact_name, contact_email: c.contact_email }])
        );
      }
    }

    const results = (data || []).map(msg => ({
      message_id: msg.id,
      conversation_id: msg.conversation_id,
      subject: msg.subject,
      from_name: msg.from_name,
      from_address: msg.from_address,
      preview: msg.body_text?.slice(0, 200) || null,
      sent_at: msg.sent_at,
      direction: msg.direction,
      channel: msg.channel,
      conversation: conversations[msg.conversation_id] || null,
    }));

    return NextResponse.json({ results, total: count || 0 });
  } catch (error) {
    console.error('Error in GET /api/inbox/search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
