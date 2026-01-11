import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { executeApprovalAction, cancelApproval } from '@/lib/approvals';

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

const approvalActionSchema = z.object({
  approvalId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'request_changes', 'cancel']),
  comment: z.string().optional(),
});

/**
 * POST /api/approvals/act
 * Take action on an approval (approve, reject, request changes, cancel)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = approvalActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { approvalId, action, comment } = parsed.data;

    // Handle cancel separately
    if (action === 'cancel') {
      const result = await cancelApproval(approvalId, profile.id);
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error,
        }, { status: 400 });
      }
      
      return NextResponse.json({
        success: true,
        newStatus: 'cancelled',
      });
    }

    // Execute approval action
    const result = await executeApprovalAction(
      { approvalId, action, comment },
      {
        profileId: profile.id,
        userId: user.id,
        userRole: profile.crm_role,
      }
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Approval action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
