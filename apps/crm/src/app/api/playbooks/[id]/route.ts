import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const playbookItemSchema = z.object({
  type: z.enum(['task', 'question', 'resource', 'milestone']),
  title: z.string().min(1),
  description: z.string().optional(),
});

const playbookSectionSchema = z.object({
  section: z.string().min(1),
  items: z.array(playbookItemSchema),
});

const updatePlaybookSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.array(playbookSectionSchema).optional(),
  target_modules: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Adapt the DB row (title/content_json/status) to the API shape
 * (name/content/is_active) that the frontend uses. See ../route.ts for
 * the parallel mapping on list/create.
 */
type PlaybookRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  content_json: unknown;
  status: string | null;
  target_modules: string[] | null;
  category: string | null;
  sort_order: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function rowToApi(row: PlaybookRow) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.title,
    description: row.description,
    content: row.content_json,
    target_modules: row.target_modules ?? [],
    is_active: row.status === 'active',
    category: row.category,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * GET /api/playbooks/[id]
 * Get a single playbook by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: playbook, error } = await supabase
      .from('advisor_playbooks')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !playbook) {
      return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
    }

    return NextResponse.json(rowToApi(playbook as PlaybookRow));
  } catch (error) {
    console.error('Failed to fetch playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/playbooks/[id]
 * Update a playbook
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();

    const body = await request.json();
    const parsed = updatePlaybookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Map API field names → DB column names.
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.title = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.content !== undefined) updateData.content_json = parsed.data.content;
    if (parsed.data.target_modules !== undefined) updateData.target_modules = parsed.data.target_modules;
    if (parsed.data.is_active !== undefined) {
      updateData.status = parsed.data.is_active ? 'active' : 'inactive';
    }
    updateData.updated_at = new Date().toISOString();

    const { data: playbook, error } = await supabase
      .from('advisor_playbooks')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error || !playbook) {
      console.error('Failed to update playbook:', error);
      return NextResponse.json({ error: 'Failed to update playbook' }, { status: 500 });
    }

    return NextResponse.json(rowToApi(playbook as PlaybookRow));
  } catch (error) {
    console.error('Failed to update playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playbooks/[id]
 * Delete a playbook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('advisor_playbooks')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('Failed to delete playbook:', error);
      return NextResponse.json({ error: 'Failed to delete playbook' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
