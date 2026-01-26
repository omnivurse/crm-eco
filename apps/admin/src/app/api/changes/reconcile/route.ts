import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

/**
 * POST /api/changes/reconcile
 * Approve or reject a change that requires review
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user has admin role
    const adminRoles = ['super_admin', 'admin', 'manager'];
    if (!profile.role || !adminRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { changeId, action, notes } = body;

    if (!changeId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: changeId, action' },
        { status: 400 }
      );
    }

    const validActions = ['approved', 'rejected', 'auto_resolved'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: approved, rejected, auto_resolved' },
        { status: 400 }
      );
    }

    // Verify the change belongs to the user's organization
    const { data: existingChange, error: fetchError } = await supabase
      .from('change_events')
      .select('id, org_id, requires_review')
      .eq('id', changeId)
      .single();

    if (fetchError || !existingChange) {
      return NextResponse.json({ error: 'Change not found' }, { status: 404 });
    }

    if (existingChange.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the change event
    const { data: updatedChange, error: updateError } = await supabase
      .from('change_events')
      .update({
        reconciliation_status: action,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        requires_review: false, // Clear the review flag
      })
      .eq('id', changeId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating change:', updateError);
      return NextResponse.json({ error: 'Failed to update change' }, { status: 500 });
    }

    return NextResponse.json({ event: updatedChange });
  } catch (error) {
    console.error('Reconcile change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
