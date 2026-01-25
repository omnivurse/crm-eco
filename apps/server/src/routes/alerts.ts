import { Router } from 'express';
import { z } from 'zod';
import { supabaseClient } from '../supabase.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Roles that can access alerts
const ALERT_ROLES = ['staff', 'agent', 'admin', 'super_admin'];

function hasAlertAccess(role?: string): boolean {
  return ALERT_ROLES.includes(role || '');
}

// ============================================================================
// REPORT ALERTS CRUD
// ============================================================================

// Get all alerts
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasAlertAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { report_id, is_enabled } = req.query;

    let query = supabaseClient
      .from('report_alerts')
      .select('*, report:crm_reports(name, data_source)')
      .order('created_at', { ascending: false });

    if (report_id) {
      query = query.eq('report_id', report_id);
    }

    if (is_enabled !== undefined) {
      query = query.eq('is_enabled', is_enabled === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ alerts: data || [] });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get single alert
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasAlertAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const { data, error } = await supabaseClient
      .from('report_alerts')
      .select('*, report:crm_reports(name, data_source, columns, filters)')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert: data });
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// Create alert
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasAlertAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const schema = z.object({
      name: z.string().min(1),
      reportId: z.string().uuid().optional(),
      conditionType: z.enum(['threshold', 'milestone', 'change']),
      conditionConfig: z.object({
        metric: z.string().optional(),
        operator: z.string().optional(),
        value: z.number().optional(),
        levelId: z.string().uuid().optional(),
        levelName: z.string().optional(),
        changeType: z.enum(['increase', 'decrease', 'any']).optional(),
        changePercent: z.number().optional(),
        changeValue: z.number().optional(),
      }),
      recipients: z.array(z.string().email()).default([]),
      isEnabled: z.boolean().default(true),
    });

    const params = schema.parse(req.body);

    const { data, error } = await supabaseClient
      .from('report_alerts')
      .insert({
        name: params.name,
        report_id: params.reportId,
        condition_type: params.conditionType,
        condition_config: params.conditionConfig,
        recipients: params.recipients,
        is_enabled: params.isEnabled,
        created_by: req.user?.id,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ alert: data });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create alert',
    });
  }
});

// Update alert
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasAlertAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const schema = z.object({
      name: z.string().min(1).optional(),
      conditionConfig: z.object({
        metric: z.string().optional(),
        operator: z.string().optional(),
        value: z.number().optional(),
        levelId: z.string().uuid().optional(),
        levelName: z.string().optional(),
        changeType: z.enum(['increase', 'decrease', 'any']).optional(),
        changePercent: z.number().optional(),
        changeValue: z.number().optional(),
      }).optional(),
      recipients: z.array(z.string().email()).optional(),
      isEnabled: z.boolean().optional(),
    });

    const params = schema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (params.name) updateData.name = params.name;
    if (params.conditionConfig) updateData.condition_config = params.conditionConfig;
    if (params.recipients) updateData.recipients = params.recipients;
    if (params.isEnabled !== undefined) updateData.is_enabled = params.isEnabled;

    const { data, error } = await supabaseClient
      .from('report_alerts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ alert: data });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update alert',
    });
  }
});

// Toggle alert enabled status
router.patch('/:id/toggle', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasAlertAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Get current state
    const { data: current, error: fetchError } = await supabaseClient
      .from('report_alerts')
      .select('is_enabled')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Toggle
    const { data, error } = await supabaseClient
      .from('report_alerts')
      .update({ is_enabled: !current.is_enabled })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ alert: data });
  } catch (error) {
    console.error('Toggle alert error:', error);
    res.status(500).json({ error: 'Failed to toggle alert' });
  }
});

// Delete alert
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasAlertAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const { error } = await supabaseClient
      .from('report_alerts')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Test alert (dry run evaluation)
router.post('/:id/test', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasAlertAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Get alert with report
    const { data: alert, error: fetchError } = await supabaseClient
      .from('report_alerts')
      .select('*, report:crm_reports(*)')
      .eq('id', id)
      .single();

    if (fetchError || !alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Simulate alert evaluation
    const conditionConfig = alert.condition_config || {};

    // For demo, just return what would happen
    res.json({
      alert: {
        id: alert.id,
        name: alert.name,
        conditionType: alert.condition_type,
      },
      testResult: {
        wouldTrigger: false,
        reason: 'Test mode - no actual data evaluated',
        conditionConfig,
        recipients: alert.recipients,
      },
    });
  } catch (error) {
    console.error('Test alert error:', error);
    res.status(500).json({ error: 'Failed to test alert' });
  }
});

export default router;
