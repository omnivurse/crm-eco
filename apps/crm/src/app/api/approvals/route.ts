import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPendingApprovalsForUser, getApprovalHistory } from '@/lib/approvals';

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
 * GET /api/approvals
 * Get pending approvals for current user
 * 
 * Query params:
 * - approvalId: Get specific approval history
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const approvalId = searchParams.get('approvalId');
    const recordId = searchParams.get('recordId');

    // Get specific approval history
    if (approvalId) {
      const history = await getApprovalHistory(approvalId);
      
      // Also get the approval details
      const { data: approval } = await supabase
        .from('crm_approvals')
        .select(`
          *,
          process:crm_approval_processes(name, steps),
          requester:profiles!crm_approvals_requested_by_fkey(full_name)
        `)
        .eq('id', approvalId)
        .single();
      
      if (!approval || approval.org_id !== profile.organization_id) {
        return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
      }
      
      return NextResponse.json({
        approval,
        history,
      });
    }

    // Get approvals for a specific record
    if (recordId) {
      const { data: approvals } = await supabase
        .from('crm_approvals')
        .select(`
          *,
          process:crm_approval_processes(name, steps),
          requester:profiles!crm_approvals_requested_by_fkey(full_name)
        `)
        .eq('record_id', recordId)
        .eq('org_id', profile.organization_id)
        .order('created_at', { ascending: false });
      
      return NextResponse.json({ approvals: approvals || [] });
    }

    // Get all pending approvals for user
    const pending = await getPendingApprovalsForUser(profile.id, profile.crm_role);
    
    return NextResponse.json({ pending });
  } catch (error) {
    console.error('Get approvals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
