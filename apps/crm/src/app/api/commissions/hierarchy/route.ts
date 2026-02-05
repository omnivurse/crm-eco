import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface AdvisorNode {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  commissionTier: string | null;
  personalProduction: number;
  teamProduction: number;
  memberCount: number;
  children: AdvisorNode[];
}

/**
 * GET /api/commissions/hierarchy
 * Get the advisor hierarchy tree
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get all advisors with their parent relationships
    const { data: advisors, error } = await supabase
      .from('advisors')
      .select(`
        id,
        first_name,
        last_name,
        email,
        status,
        commission_tier,
        parent_advisor_id,
        personal_production,
        team_production
      `)
      .eq('organization_id', profile.organization_id)
      .order('last_name');

    if (error) {
      console.error('Get hierarchy error:', error);
      return NextResponse.json({ error: 'Failed to fetch hierarchy' }, { status: 500 });
    }

    // Get member counts per advisor
    const { data: memberCounts } = await supabase
      .from('members')
      .select('advisor_id')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'active');

    const memberCountMap: Record<string, number> = {};
    if (memberCounts) {
      for (const m of memberCounts) {
        if (m.advisor_id) {
          memberCountMap[m.advisor_id] = (memberCountMap[m.advisor_id] || 0) + 1;
        }
      }
    }

    // Build the tree
    const advisorMap = new Map<string, AdvisorNode>();
    const rootNodes: AdvisorNode[] = [];

    // First pass: create all nodes
    for (const advisor of advisors || []) {
      const node: AdvisorNode = {
        id: advisor.id,
        firstName: advisor.first_name,
        lastName: advisor.last_name,
        email: advisor.email,
        status: advisor.status,
        commissionTier: advisor.commission_tier,
        personalProduction: Number(advisor.personal_production) || 0,
        teamProduction: Number(advisor.team_production) || 0,
        memberCount: memberCountMap[advisor.id] || 0,
        children: [],
      };
      advisorMap.set(advisor.id, node);
    }

    // Second pass: build tree structure
    for (const advisor of advisors || []) {
      const node = advisorMap.get(advisor.id);
      if (!node) continue;

      if (advisor.parent_advisor_id) {
        const parent = advisorMap.get(advisor.parent_advisor_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          rootNodes.push(node);
        }
      } else {
        // No parent, this is a root node
        rootNodes.push(node);
      }
    }

    // Calculate team production recursively
    function calculateTeamProduction(node: AdvisorNode): number {
      let total = node.personalProduction;
      for (const child of node.children) {
        total += calculateTeamProduction(child);
      }
      node.teamProduction = total;
      return total;
    }

    for (const root of rootNodes) {
      calculateTeamProduction(root);
    }

    // Calculate statistics
    const stats = {
      totalAdvisors: advisors?.length || 0,
      activeAdvisors: advisors?.filter(a => a.status === 'active').length || 0,
      totalProduction: rootNodes.reduce((sum, n) => sum + n.teamProduction, 0),
      avgTeamSize: rootNodes.length > 0 
        ? Math.round(((advisors?.length || 0) - rootNodes.length) / rootNodes.length * 10) / 10 
        : 0,
    };

    return NextResponse.json({
      hierarchy: rootNodes,
      stats,
    });
  } catch (error) {
    console.error('Hierarchy API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
