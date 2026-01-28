import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

/**
 * GET /api/automation/rules
 * List automation rules
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    
    let query = supabase
      .from('automation_rules')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching rules:', error);
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }
    
    return NextResponse.json({ rules: data || [] });
  } catch (error) {
    console.error('Error in GET /api/automation/rules:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/automation/rules
 * Create a new automation rule
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    const body = await request.json();
    
    // Get user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Validate required fields
    if (!body.name || !body.trigger_type || !body.trigger_config || !body.actions) {
      return NextResponse.json(
        { error: 'Missing required fields: name, trigger_type, trigger_config, actions' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        org_id: profile.organization_id,
        name: body.name,
        description: body.description,
        trigger_type: body.trigger_type,
        trigger_config: body.trigger_config,
        conditions: body.conditions || { match: 'all', rules: [] },
        actions: body.actions,
        is_active: body.is_active ?? true,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating rule:', error);
      return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/automation/rules:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
