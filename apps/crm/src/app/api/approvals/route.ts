import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getPendingApprovalsForUser,
  getApprovalHistory,
  getApprovalInbox,
  getApprovalDetail,
  getApprovalDecisions,
  type ApprovalStatus,
} from '@/lib/approvals';

export const dynamic = 'force-dynamic';

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
 * Get approvals with filters
 * 
 * Query params:
 * - approvalId: Get specific approval with history and decisions
 * - recordId: Get approvals for a specific record
 * - status: Filter by status (pending, approved, rejected, all)
 * - entityType: Filter by module key (deals, leads, etc.)
 * - assignedToMe: Filter to approvals assigned to current user
 * - requestedByMe: Filter to approvals requested by current user
 * - inbox: Use enhanced inbox query with all filters
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
    const useInbox = searchParams.get('inbox') === 'true';
    
    // Filter params
    const status = searchParams.get('status') as ApprovalStatus | 'all' | null;
    const entityType = searchParams.get('entityType');
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const requestedByMe = searchParams.get('requestedByMe') === 'true';

    // Get specific approval with full details
    if (approvalId) {
      const [history, decisions, detail] = await Promise.all([
        getApprovalHistory(approvalId),
        getApprovalDecisions(approvalId),
        getApprovalDetail(approvalId),
      ]);
      
      if (!detail || detail.org_id !== profile.organization_id) {
        return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
      }
      
      return NextResponse.json({
        approval: detail,
        history,
        decisions,
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

    // Use enhanced inbox query with filters
    if (useInbox || status || entityType || assignedToMe || requestedByMe) {
      const inbox = await getApprovalInbox(
        profile.organization_id,
        profile.id,
        profile.crm_role,
        {
          status: status || undefined,
          entity_type: entityType || undefined,
          assigned_to_me: assignedToMe,
          requested_by_me: requestedByMe,
        }
      );
      
      return NextResponse.json({ 
        inbox,
        filters: {
          status,
          entityType,
          assignedToMe,
          requestedByMe,
        }
      });
    }

    // Default: Get all pending approvals for user (legacy behavior)
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
