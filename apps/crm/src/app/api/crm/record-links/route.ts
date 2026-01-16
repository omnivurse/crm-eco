import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile, getRecordLinks } from '@/lib/crm/queries';
import { createRecordLink, updateRecordLink, deleteRecordLink } from '@/lib/crm/mutations';

/**
 * GET /api/crm/record-links
 * Get linked records for a specific record
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      );
    }

    const links = await getRecordLinks(recordId);
    return NextResponse.json(links);
  } catch (error) {
    console.error('Error fetching record links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch record links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/record-links
 * Create a new record link
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

    const body = await request.json();
    const { source_record_id, target_record_id, link_type, is_primary, meta } = body;

    if (!source_record_id || !target_record_id || !link_type) {
      return NextResponse.json(
        { error: 'source_record_id, target_record_id, and link_type are required' },
        { status: 400 }
      );
    }

    const link = await createRecordLink({
      org_id: profile.organization_id,
      source_record_id,
      target_record_id,
      link_type,
      is_primary,
      meta,
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error('Error creating record link:', error);
    return NextResponse.json(
      { error: 'Failed to create record link' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/crm/record-links
 * Update a record link
 */
export async function PUT(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, is_primary, meta } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const link = await updateRecordLink(id, { is_primary, meta });
    return NextResponse.json(link);
  } catch (error) {
    console.error('Error updating record link:', error);
    return NextResponse.json(
      { error: 'Failed to update record link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/record-links
 * Delete a record link
 */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await deleteRecordLink(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting record link:', error);
    return NextResponse.json(
      { error: 'Failed to delete record link' },
      { status: 500 }
    );
  }
}
