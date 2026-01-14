import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

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

// Validation schema for audit log entries
const auditLogSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'import', 'export', 'bulk_update']),
  entity: z.string().min(1, 'Entity is required'),
  entity_id: z.string().uuid('Entity ID must be a valid UUID'),
  diff: z.record(z.unknown()).optional(),
  meta: z.record(z.unknown()).optional(),
});

type AuditLogInput = z.infer<typeof auditLogSchema>;

/**
 * POST /api/crm/audit
 * 
 * Append an entry to the CRM audit log
 * Used by UI actions to log significant events
 * 
 * Body:
 *   - action: 'create' | 'update' | 'delete' | 'import' | 'export' | 'bulk_update'
 *   - entity: string (e.g., 'crm_records', 'leads', 'contacts')
 *   - entity_id: UUID of the affected entity
 *   - diff: optional object with old/new values
 *   - meta: optional additional metadata
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = auditLogSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input: AuditLogInput = validationResult.data;

    // Get user's profile and organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Insert audit log entry
    const { data: auditLog, error: insertError } = await supabase
      .from('crm_audit_log')
      .insert({
        org_id: profile.organization_id,
        actor_id: profile.id,
        action: input.action,
        entity: input.entity,
        entity_id: input.entity_id,
        diff: input.diff || null,
        meta: input.meta || {},
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Audit log insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create audit log entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: auditLog.id,
      created_at: auditLog.created_at,
    });
  } catch (error) {
    console.error('Audit API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crm/audit
 * 
 * Retrieve audit log entries (admin/ops only)
 * Query params:
 *   - entity: filter by entity type
 *   - entity_id: filter by specific entity
 *   - action: filter by action type
 *   - limit: max results (default 50)
 *   - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Only admin and ops can view audit logs
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    const entityId = searchParams.get('entity_id');
    const action = searchParams.get('action');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('crm_audit_log')
      .select(`
        id,
        action,
        entity,
        entity_id,
        diff,
        meta,
        created_at,
        actor:profiles!actor_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (entity) {
      query = query.eq('entity', entity);
    }
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    if (action) {
      query = query.eq('action', action);
    }

    const { data: logs, error: queryError } = await query;

    if (queryError) {
      console.error('Audit log query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to retrieve audit logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: logs || [],
      count: logs?.length || 0,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Audit API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
