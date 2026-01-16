import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getDealStages, getCurrentProfile } from '@/lib/crm/queries';
import { createDealStage, updateDealStage, deleteDealStage } from '@/lib/crm/mutations';

/**
 * GET /api/crm/stages
 * Get all deal stages for the current organization
 */
export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stages = await getDealStages(profile.organization_id);
    return NextResponse.json(stages);
  } catch (error) {
    console.error('Error fetching deal stages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deal stages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/stages
 * Create a new deal stage
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for admin/manager role
    if (!profile.crm_role || !['crm_admin', 'crm_manager'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { key, name, color, probability, is_won, is_lost, display_order } = body;

    if (!key || !name) {
      return NextResponse.json(
        { error: 'key and name are required' },
        { status: 400 }
      );
    }

    const stage = await createDealStage({
      org_id: profile.organization_id,
      key,
      name,
      color,
      probability,
      is_won,
      is_lost,
      display_order,
    });

    return NextResponse.json(stage, { status: 201 });
  } catch (error) {
    console.error('Error creating deal stage:', error);
    return NextResponse.json(
      { error: 'Failed to create deal stage' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/crm/stages
 * Update a deal stage
 */
export async function PUT(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const stage = await updateDealStage(id, updates);
    return NextResponse.json(stage);
  } catch (error) {
    console.error('Error updating deal stage:', error);
    return NextResponse.json(
      { error: 'Failed to update deal stage' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/stages
 * Delete (deactivate) a deal stage
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

    await deleteDealStage(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting deal stage:', error);
    return NextResponse.json(
      { error: 'Failed to delete deal stage' },
      { status: 500 }
    );
  }
}
