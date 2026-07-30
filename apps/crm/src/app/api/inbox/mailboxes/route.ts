import { NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { buildSharedMailboxes } from '@/lib/inbox/shared-mailboxes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inbox/mailboxes
 *
 * Shared mailboxes available to the caller, with unread badges.
 *
 * The address list comes from email_sender_addresses (the registry that also
 * drives the compose From picker) so the sidebar and the sender dropdown can
 * never drift apart. Counts come from an aggregate RPC rather than counting
 * rows here.
 */
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const [{ data: addressRows, error: addressError }, { data: domainRows }] = await Promise.all([
      supabase
        .from('email_sender_addresses')
        .select('email, name, is_default, email_domains!inner (status)')
        .eq('org_id', profile.organization_id)
        .eq('email_domains.status', 'verified'),
      supabase
        .from('email_domains')
        .select('domain')
        .eq('org_id', profile.organization_id)
        .eq('status', 'verified'),
    ]);

    if (addressError) {
      console.error('Error fetching shared mailbox addresses:', addressError);
      return NextResponse.json({ error: 'Failed to fetch mailboxes' }, { status: 500 });
    }

    // Unread badges are additive polish: if the aggregate is unavailable (for
    // example the migration has not been applied yet) still render the
    // mailboxes rather than failing the whole sidebar.
    let unreadByMailbox: Record<string, number> = {};
    const { data: unreadRows, error: unreadError } = await (supabase as any).rpc(
      'inbox_unread_by_mailbox',
    );

    if (unreadError) {
      console.warn('inbox_unread_by_mailbox unavailable; rendering without badges:', unreadError.message);
    } else {
      unreadByMailbox = Object.fromEntries(
        (unreadRows || [])
          .filter((r: { mailbox: string | null }) => Boolean(r.mailbox))
          .map((r: { mailbox: string; unread_conversations: number | string }) => [
            r.mailbox.toLowerCase(),
            Number(r.unread_conversations) || 0,
          ]),
      );
    }

    const mailboxes = buildSharedMailboxes(
      (addressRows || []) as Array<{
        email: string;
        name?: string | null;
        is_default?: boolean | null;
      }>,
      unreadByMailbox,
    );

    // Domains let the client resolve a reply From for catch-all addresses that
    // were never registered as senders.
    const domains = ((domainRows || []) as Array<{ domain: string }>)
      .map((d) => d.domain?.trim().toLowerCase())
      .filter(Boolean);

    return NextResponse.json({ mailboxes, domains });
  } catch (error) {
    console.error('Inbox mailboxes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
