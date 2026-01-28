import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/automation/rules/[id]
 * Get a single automation rule
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch rule' }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/automation/rules/[id]:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PUT /api/automation/rules/[id]
 * Update an automation rule
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient() as any;
    const body = await request.json();
    
    // Get user profile
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user?.id)
      .single();
    
    const updateData: Record<string, unknown> = { updated_by: profile?.id };
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.trigger_type !== undefined) updateData.trigger_type = body.trigger_type;
    if (body.trigger_config !== undefined) updateData.trigger_config = body.trigger_config;
    if (body.conditions !== undefined) updateData.conditions = body.conditions;
    if (body.actions !== undefined) updateData.actions = body.actions;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating rule:', error);
      return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/automation/rules/[id]:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/automation/rules/[id]
 * Delete an automation rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient() as any;
    
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting rule:', error);
      return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/automation/rules/[id]:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
