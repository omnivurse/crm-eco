import { NextResponse } from 'next/server';
import { getTeamMembers } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inbox/team
 * Get team members available for assignment
 */
export async function GET() {
  try {
    const members = await getTeamMembers();
    
    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error in GET /api/inbox/team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}
