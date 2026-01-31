import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

const EXPORT_COLUMNS = [
  'created_at',
  'actor_email',
  'actor_role',
  'action',
  'action_category',
  'target_entity_type',
  'target_entity_id',
  'description',
  'risk_level',
  'ip_address',
  'app_source',
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertToCSV(logs: Record<string, unknown>[]): string {
  const headers = EXPORT_COLUMNS.join(',');
  const rows = logs.map((log) =>
    EXPORT_COLUMNS.map((col) => escapeCSV(log[col])).join(',')
  );
  return [headers, ...rows].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = request.nextUrl;

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile and verify permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query with filters
    let query = supabase
      .from('unified_audit_logs')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    // Apply filters
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const riskLevel = searchParams.get('riskLevel');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (userId) query = query.eq('actor_id', userId);
    if (action) query = query.eq('action', action);
    if (riskLevel) query = query.eq('risk_level', riskLevel);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    // Higher limit for export
    query = query.limit(10000);

    const { data: logs, error } = await query;

    if (error) {
      console.error('[AuditLogs Export] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    const format = searchParams.get('format') || 'csv';
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const json = JSON.stringify(logs, null, 2);
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename=audit-logs-${dateStr}.json`,
        },
      });
    }

    // CSV export (default)
    const csv = convertToCSV(logs || []);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=audit-logs-${dateStr}.csv`,
      },
    });
  } catch (error) {
    console.error('[AuditLogs Export] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
