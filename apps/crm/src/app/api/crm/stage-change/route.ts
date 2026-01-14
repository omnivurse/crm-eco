import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/crm/queries';
import { changeRecordStage } from '@/lib/crm/mutations';

/**
 * POST /api/crm/stage-change
 * Change a record's stage (used for pipeline drag-drop)
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for appropriate role
    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { recordId, newStage, reason } = body;

    if (!recordId || !newStage) {
      return NextResponse.json(
        { error: 'recordId and newStage are required' },
        { status: 400 }
      );
    }

    const record = await changeRecordStage({
      recordId,
      newStage,
      reason,
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('Error changing stage:', error);
    return NextResponse.json(
      { error: 'Failed to change stage' },
      { status: 500 }
    );
  }
}
