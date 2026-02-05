import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import type { CreateWorkflowRequest } from '@/lib/workflows/types';

// GET /api/workflows - List all workflows
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    let query = supabase
      .from('crm_workflows')
      .select(`
        *,
        created_by_profile:profiles!crm_workflows_created_by_fkey(full_name, avatar_url)
      `)
      .eq('org_id', profile.organization_id)
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: workflows, error } = await query;

    if (error) throw error;

    return NextResponse.json({ workflows: workflows || [] });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
  }
}

// POST /api/workflows - Create new workflow
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body: CreateWorkflowRequest = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: workflow, error } = await supabase
      .from('crm_workflows')
      .insert({
        org_id: profile.organization_id,
        name: body.name,
        description: body.description || null,
        module_id: body.module_id || null,
        trigger_config: body.trigger_config || {},
        nodes: body.nodes || [],
        edges: body.edges || [],
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
  }
}
