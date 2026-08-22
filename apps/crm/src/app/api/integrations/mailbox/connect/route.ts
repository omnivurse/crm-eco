import { NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';
import { COMMS_FLAGS, isCommsFlagEnabled } from '@/lib/email/comms-flags';
import { mailboxOauthConnectDecision } from '@/lib/email/mailbox-oauth-gate';

/**
 * Personal mailbox OAuth is Phase 3 and fail-closed.
 * Calendar OAuth must not be used as mail scopes.
 */
export async function POST() {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const enabled = await isCommsFlagEnabled(
    supabase,
    COMMS_FLAGS.mailboxOauth,
    profile.organization_id,
    false,
  );
  const decision = mailboxOauthConnectDecision(enabled);
  return NextResponse.json(
    { error: decision.error, code: decision.code },
    { status: decision.status },
  );
}
