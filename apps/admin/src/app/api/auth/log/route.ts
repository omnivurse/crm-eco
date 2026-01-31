import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { logAuthEvent } from '@crm-eco/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, details } = body;

    // Validate action
    const validActions = ['login_success', 'login_failed', 'logout', 'password_reset', 'mfa_enabled', 'mfa_disabled'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // For login_success, verify the user is actually authenticated
    if (action === 'login_success') {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || user.email !== email) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
    }

    // Log the auth event
    const result = await logAuthEvent('admin', action, email, {
      ...details,
      source: 'admin_login_page',
    });

    if (!result.success) {
      console.error('[Auth Log] Failed to log event:', result.error);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth Log] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
