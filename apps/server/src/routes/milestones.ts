import { Router } from 'express';
import { z } from 'zod';
import { supabaseClient } from '../supabase.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  calculateMilestoneProgress,
  generateMilestoneNotification,
  mapDbRowToAgentLevel,
  type AdvisorMetrics,
  type AgentLevel,
} from '@crm-eco/shared';

const router = Router();

// Roles that can access milestones
const MILESTONE_ROLES = ['staff', 'agent', 'admin', 'super_admin', 'advisor'];

function hasMilestoneAccess(role?: string): boolean {
  return MILESTONE_ROLES.includes(role || '');
}

// ============================================================================
// MILESTONE TRACKING
// ============================================================================

// Get all advisor milestone progress
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasMilestoneAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabaseClient
      .from('advisor_milestone_progress')
      .select(`
        *,
        advisor:advisors(id, first_name, last_name, email, code),
        current_level:agent_levels!advisor_milestone_progress_current_level_id_fkey(id, name, rank, commission_rate),
        next_level:agent_levels!advisor_milestone_progress_next_level_id_fkey(id, name, rank, min_active_members, min_monthly_enrollments, commission_rate)
      `)
      .order('progress_percent', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ milestones: data || [] });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Get milestone progress for specific advisor
router.get('/advisor/:advisorId', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasMilestoneAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { advisorId } = req.params;

    const { data, error } = await supabaseClient
      .from('advisor_milestone_progress')
      .select(`
        *,
        advisor:advisors(id, first_name, last_name, email, code),
        current_level:agent_levels!advisor_milestone_progress_current_level_id_fkey(*),
        next_level:agent_levels!advisor_milestone_progress_next_level_id_fkey(*)
      `)
      .eq('advisor_id', advisorId)
      .single();

    if (error) {
      // If no progress record exists, calculate it
      if (error.code === 'PGRST116') {
        const progress = await calculateAdvisorProgress(advisorId);
        return res.json({ progress });
      }
      return res.status(400).json({ error: error.message });
    }

    res.json({ progress: data });
  } catch (error) {
    console.error('Get advisor milestone error:', error);
    res.status(500).json({ error: 'Failed to fetch milestone progress' });
  }
});

// Recalculate milestones for all advisors (admin only)
router.post('/recalculate', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const orgId = req.body.orgId || '00000000-0000-0000-0000-000000000001';

    // Get all active advisors
    const { data: advisors, error: advisorError } = await supabaseClient
      .from('advisors')
      .select('id, agent_level_id, first_name, last_name')
      .eq('status', 'active');

    if (advisorError) {
      return res.status(400).json({ error: advisorError.message });
    }

    // Get all agent levels
    const { data: levels, error: levelsError } = await supabaseClient
      .from('agent_levels')
      .select('*')
      .order('rank');

    if (levelsError) {
      return res.status(400).json({ error: levelsError.message });
    }

    const agentLevels: AgentLevel[] = (levels || []).map(mapDbRowToAgentLevel);

    // Calculate progress for each advisor
    const results = [];
    const notifications = [];

    for (const advisor of advisors || []) {
      const metrics = await getAdvisorMetrics(advisor.id);
      const result = calculateMilestoneProgress(
        metrics,
        agentLevels,
        advisor.agent_level_id
      );

      // Upsert progress record
      const { error: upsertError } = await supabaseClient
        .from('advisor_milestone_progress')
        .upsert({
          org_id: orgId,
          advisor_id: advisor.id,
          current_level_id: result.currentLevel?.id,
          next_level_id: result.nextLevel?.id,
          active_members_count: metrics.activeMembersCount,
          monthly_enrollments_count: metrics.monthlyEnrollmentsCount,
          progress_percent: result.progressPercent,
          metrics_snapshot: metrics,
          calculated_at: new Date().toISOString(),
        }, {
          onConflict: 'advisor_id',
        });

      if (upsertError) {
        console.error('Upsert error for advisor', advisor.id, upsertError);
      }

      results.push(result);

      // Generate notification if applicable
      const notification = generateMilestoneNotification(
        result,
        `${advisor.first_name} ${advisor.last_name}`
      );

      if (notification) {
        notifications.push(notification);
      }
    }

    res.json({
      success: true,
      processed: results.length,
      notifications: notifications.length,
      notificationDetails: notifications,
    });
  } catch (error) {
    console.error('Recalculate milestones error:', error);
    res.status(500).json({ error: 'Failed to recalculate milestones' });
  }
});

// Recalculate milestone for specific advisor
router.post('/recalculate/:advisorId', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasMilestoneAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { advisorId } = req.params;
    const progress = await calculateAdvisorProgress(advisorId);

    res.json({ progress });
  } catch (error) {
    console.error('Recalculate advisor milestone error:', error);
    res.status(500).json({ error: 'Failed to recalculate milestone' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAdvisorMetrics(advisorId: string): Promise<AdvisorMetrics> {
  // Get active members count
  const { count: activeMembersCount } = await supabaseClient
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisorId)
    .eq('status', 'active');

  // Get monthly enrollments count (current month)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const { count: monthlyEnrollmentsCount } = await supabaseClient
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisorId)
    .gte('enrollment_date', startOfMonth)
    .lte('enrollment_date', endOfMonth);

  // Get total commissions (paid)
  const { data: commissions } = await supabaseClient
    .from('commissions')
    .select('amount')
    .eq('advisor_id', advisorId)
    .eq('status', 'paid');

  const totalCommissions = (commissions || []).reduce(
    (sum, c) => sum + (c.amount || 0),
    0
  );

  return {
    advisorId,
    activeMembersCount: activeMembersCount || 0,
    monthlyEnrollmentsCount: monthlyEnrollmentsCount || 0,
    totalCommissions,
  };
}

async function calculateAdvisorProgress(advisorId: string) {
  // Get advisor info
  const { data: advisor, error: advisorError } = await supabaseClient
    .from('advisors')
    .select('id, org_id, agent_level_id, first_name, last_name')
    .eq('id', advisorId)
    .single();

  if (advisorError || !advisor) {
    throw new Error('Advisor not found');
  }

  // Get all agent levels
  const { data: levels, error: levelsError } = await supabaseClient
    .from('agent_levels')
    .select('*')
    .eq('org_id', advisor.org_id)
    .order('rank');

  if (levelsError) {
    throw new Error('Failed to fetch agent levels');
  }

  const agentLevels: AgentLevel[] = (levels || []).map(mapDbRowToAgentLevel);
  const metrics = await getAdvisorMetrics(advisorId);

  const result = calculateMilestoneProgress(
    metrics,
    agentLevels,
    advisor.agent_level_id
  );

  // Upsert progress record
  await supabaseClient
    .from('advisor_milestone_progress')
    .upsert({
      org_id: advisor.org_id,
      advisor_id: advisorId,
      current_level_id: result.currentLevel?.id,
      next_level_id: result.nextLevel?.id,
      active_members_count: metrics.activeMembersCount,
      monthly_enrollments_count: metrics.monthlyEnrollmentsCount,
      progress_percent: result.progressPercent,
      metrics_snapshot: metrics,
      calculated_at: new Date().toISOString(),
    }, {
      onConflict: 'advisor_id',
    });

  return {
    ...result,
    advisor: {
      id: advisor.id,
      name: `${advisor.first_name} ${advisor.last_name}`,
    },
  };
}

export default router;
