import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional(),
});

const addTagsToRecordsSchema = z.object({
  record_ids: z.array(z.string().uuid()),
  tag_ids: z.array(z.string().uuid()),
});

/**
 * GET /api/crm/tags
 * Get all tags for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createCrmClient();
    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get('module');

    let query = supabase
      .from('crm_tags')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('name', { ascending: true });

    if (moduleKey) {
      query = query.or(`module_key.eq.${moduleKey},module_key.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/crm/tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

/**
 * POST /api/crm/tags
 * Create a new tag or add tags to records (based on request body)
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createCrmClient();
    const body = await request.json();

    // Check if this is an "add tags to records" request
    if (body.record_ids && body.tag_ids) {
      const parsed = addTagsToRecordsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
      }

      // Insert tag assignments
      const tagAssignments = parsed.data.record_ids.flatMap((recordId) =>
        parsed.data.tag_ids.map((tagId) => ({
          record_id: recordId,
          tag_id: tagId,
          org_id: profile.organization_id,
        }))
      );

      const { error } = await supabase
        .from('crm_record_tags')
        .upsert(tagAssignments, { onConflict: 'record_id,tag_id' });

      if (error) {
        console.error('Error adding tags to records:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: tagAssignments.length });
    }

    // Otherwise, create a new tag
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { data: tag, error } = await supabase
      .from('crm_tags')
      .insert({
        org_id: profile.organization_id,
        name: parsed.data.name,
        color: parsed.data.color || '#6366f1',
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tag:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/crm/tags:', error);
    return NextResponse.json({ error: 'Failed to process tag request' }, { status: 500 });
  }
}
