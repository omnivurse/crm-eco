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

const createPlaybookSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.array(playbookSectionSchema),
  target_modules: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

/**
 * DB ↔ API mapping for advisor_playbooks.
 *
 * The frontend has historically used the field names `name`, `content`,
 * `is_active`, and `target_modules`. The DB columns are `title`,
 * `content_json`, `status` (text), and `target_modules` (added in migration
 * 202605220009). We adapt in both directions so the API contract stays
 * the same and old clients keep working.
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
 * GET /api/playbooks
 * List all playbooks for the current organization
 */
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: playbooks, error } = await supabase
      .from('advisor_playbooks')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch playbooks:', error);
      return NextResponse.json({ error: 'Failed to fetch playbooks' }, { status: 500 });
    }

    return NextResponse.json((playbooks ?? []).map((p) => rowToApi(p as PlaybookRow)));
  } catch (error) {
    console.error('Failed to fetch playbooks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/playbooks
 * Create a new playbook
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();

    const body = await request.json();
    const parsed = createPlaybookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { data: playbook, error } = await supabase
      .from('advisor_playbooks')
      .insert({
        organization_id: profile.organization_id,
        title: parsed.data.name,
        description: parsed.data.description || null,
        content_json: parsed.data.content,
        target_modules: parsed.data.target_modules ?? ['Deals'],
        status: (parsed.data.is_active ?? true) ? 'active' : 'inactive',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create playbook:', error);
      return NextResponse.json({ error: 'Failed to create playbook' }, { status: 500 });
    }

    return NextResponse.json(rowToApi(playbook as PlaybookRow), { status: 201 });
  } catch (error) {
    console.error('Failed to create playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
