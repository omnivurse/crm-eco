import { Router } from 'express';
import { z } from 'zod';
import { supabaseClient } from '../supabase.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Roles that can access segments
const SEGMENT_ROLES = ['staff', 'agent', 'admin', 'super_admin'];

function hasSegmentAccess(role?: string): boolean {
  return SEGMENT_ROLES.includes(role || '');
}

// ============================================================================
// SEGMENTS CRUD
// ============================================================================

// Get all segments
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasSegmentAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { entity_type } = req.query;

    let query = supabaseClient
      .from('report_segments')
      .select('*, report:crm_reports(name)')
      .order('created_at', { ascending: false });

    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ segments: data || [] });
  } catch (error) {
    console.error('Get segments error:', error);
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
});

// Get single segment
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasSegmentAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const { data, error } = await supabaseClient
      .from('report_segments')
      .select('*, report:crm_reports(name, data_source, columns, filters)')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    res.json({ segment: data });
  } catch (error) {
    console.error('Get segment error:', error);
    res.status(500).json({ error: 'Failed to fetch segment' });
  }
});

// Create segment
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasSegmentAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      entityType: z.enum(['members', 'advisors']),
      reportId: z.string().uuid().optional(),
      filterSnapshot: z.array(z.any()).optional(),
      recordCount: z.number().default(0),
      isDynamic: z.boolean().default(false),
    });

    const params = schema.parse(req.body);

    const { data, error } = await supabaseClient
      .from('report_segments')
      .insert({
        name: params.name,
        description: params.description,
        entity_type: params.entityType,
        report_id: params.reportId,
        filter_snapshot: params.filterSnapshot,
        record_count: params.recordCount,
        is_dynamic: params.isDynamic,
        created_by: req.user?.id,
        last_refreshed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ segment: data });
  } catch (error) {
    console.error('Create segment error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create segment',
    });
  }
});

// Refresh segment (recalculate count for dynamic segments)
router.post('/:id/refresh', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasSegmentAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Get segment
    const { data: segment, error: fetchError } = await supabaseClient
      .from('report_segments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    if (!segment.is_dynamic) {
      return res.status(400).json({ error: 'Only dynamic segments can be refreshed' });
    }

    // Re-run the filter query to get updated count
    const filters = segment.filter_snapshot || [];
    // Cast to any to avoid TypeScript deep type instantiation error
    let query: any = supabaseClient
      .from(segment.entity_type)
      .select('id', { count: 'exact', head: true });

    for (const filter of filters) {
      const column = filter.column?.replace('.', '_');
      if (column && filter.operator === 'eq') {
        query = query.eq(column, filter.value);
      } else if (column && filter.operator === 'in' && Array.isArray(filter.value)) {
        query = query.in(column, filter.value);
      }
    }

    const { count, error: countError } = await query;

    if (countError) {
      return res.status(400).json({ error: countError.message });
    }

    // Update segment with new count
    const { data, error: updateError } = await supabaseClient
      .from('report_segments')
      .update({
        record_count: count || 0,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ segment: data });
  } catch (error) {
    console.error('Refresh segment error:', error);
    res.status(500).json({ error: 'Failed to refresh segment' });
  }
});

// Delete segment
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasSegmentAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const { error } = await supabaseClient
      .from('report_segments')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete segment error:', error);
    res.status(500).json({ error: 'Failed to delete segment' });
  }
});

// Get segment members/records
router.get('/:id/records', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasSegmentAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);

    // Get segment
    const { data: segment, error: fetchError } = await supabaseClient
      .from('report_segments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    // Query records
    const filters = segment.filter_snapshot || [];
    // Cast to any to avoid TypeScript deep type instantiation error
    let query: any = supabaseClient
      .from(segment.entity_type)
      .select('*', { count: 'exact' });

    for (const filter of filters) {
      const column = filter.column?.replace('.', '_');
      if (column && filter.operator === 'eq') {
        query = query.eq(column, filter.value);
      } else if (column && filter.operator === 'in' && Array.isArray(filter.value)) {
        query = query.in(column, filter.value);
      }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      records: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    console.error('Get segment records error:', error);
    res.status(500).json({ error: 'Failed to fetch segment records' });
  }
});

export default router;
