import { Router } from 'express';
import { z } from 'zod';
import { supabaseClient } from '../supabase.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  buildQuery,
  DATA_SOURCES,
  FilterSchema,
  SortingSchema,
  GroupingSchema,
  AggregationSchema,
  REPORT_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  TEMPLATE_CATEGORIES,
} from '@crm-eco/shared';

const router = Router();

// Roles that can access reports
const REPORT_ROLES = ['staff', 'agent', 'admin', 'super_admin'];

function hasReportAccess(role?: string): boolean {
  return REPORT_ROLES.includes(role || '');
}

// ============================================================================
// REPORT EXECUTION
// ============================================================================

const ExecuteReportSchema = z.object({
  dataSource: z.enum(DATA_SOURCES),
  columns: z.array(z.string()),
  filters: z.array(FilterSchema).default([]),
  grouping: z.array(GroupingSchema).default([]),
  aggregations: z.array(AggregationSchema).default([]),
  sorting: z.array(SortingSchema).default([]),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(50),
});

// Execute a report query
router.post('/execute', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const params = ExecuteReportSchema.parse(req.body);
    const orgId = req.body.orgId || '00000000-0000-0000-0000-000000000001'; // Default org

    // Build and execute query
    const { sql, countSql } = buildQuery(
      {
        dataSource: params.dataSource,
        columns: params.columns,
        filters: params.filters,
        grouping: params.grouping,
        aggregations: params.aggregations,
        sorting: params.sorting,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      },
      orgId
    );

    // Execute via Supabase RPC or direct query
    // For now, use simple Supabase queries
    let query = supabaseClient
      .from(params.dataSource)
      .select('*', { count: 'exact' });

    // Apply filters
    for (const filter of params.filters) {
      const column = filter.column.replace('.', '_');
      switch (filter.operator) {
        case 'eq':
          query = query.eq(column, filter.value);
          break;
        case 'neq':
          query = query.neq(column, filter.value);
          break;
        case 'gt':
          query = query.gt(column, filter.value);
          break;
        case 'gte':
          query = query.gte(column, filter.value);
          break;
        case 'lt':
          query = query.lt(column, filter.value);
          break;
        case 'lte':
          query = query.lte(column, filter.value);
          break;
        case 'like':
        case 'ilike':
          query = query.ilike(column, `%${filter.value}%`);
          break;
        case 'in':
          if (Array.isArray(filter.value)) {
            query = query.in(column, filter.value);
          }
          break;
        case 'is_null':
          query = query.is(column, null);
          break;
        case 'is_not_null':
          query = query.not(column, 'is', null);
          break;
      }
    }

    // Apply sorting
    if (params.sorting.length > 0) {
      for (const sort of params.sorting) {
        query = query.order(sort.column, { ascending: sort.direction === 'asc' });
      }
    }

    // Apply pagination
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      data: data || [],
      total: count || 0,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil((count || 0) / params.pageSize),
    });
  } catch (error) {
    console.error('Report execute error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to execute report',
    });
  }
});

// Preview report (limited to 100 rows)
router.post('/preview', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Force limit for preview
    req.body.pageSize = Math.min(req.body.pageSize || 100, 100);
    req.body.page = 1;

    // Reuse execute logic
    const params = ExecuteReportSchema.parse(req.body);

    let query = supabaseClient
      .from(params.dataSource)
      .select('*', { count: 'exact' });

    // Apply filters
    for (const filter of params.filters) {
      const column = filter.column.replace('.', '_');
      switch (filter.operator) {
        case 'eq':
          query = query.eq(column, filter.value);
          break;
        case 'neq':
          query = query.neq(column, filter.value);
          break;
        case 'ilike':
        case 'like':
          query = query.ilike(column, `%${filter.value}%`);
          break;
        case 'in':
          if (Array.isArray(filter.value)) {
            query = query.in(column, filter.value);
          }
          break;
      }
    }

    query = query.limit(100);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      data: data || [],
      total: count || 0,
      preview: true,
    });
  } catch (error) {
    console.error('Report preview error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to preview report',
    });
  }
});

// ============================================================================
// SAVED REPORTS CRUD
// ============================================================================

// Get all saved reports
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabaseClient
      .from('crm_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ reports: data || [] });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get single report
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const { data, error } = await supabaseClient
      .from('crm_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report: data });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Create report
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      dataSource: z.enum(DATA_SOURCES),
      columns: z.array(z.string()),
      filters: z.array(z.any()).default([]),
      grouping: z.array(z.any()).default([]),
      aggregations: z.array(z.any()).default([]),
      sorting: z.array(z.any()).default([]),
      isTemplate: z.boolean().default(false),
      templateCategory: z.string().optional(),
    });

    const params = schema.parse(req.body);

    const { data, error } = await supabaseClient
      .from('crm_reports')
      .insert({
        name: params.name,
        description: params.description,
        data_source: params.dataSource,
        columns: params.columns,
        filters: params.filters,
        grouping: params.grouping,
        aggregations: params.aggregations,
        sorting: params.sorting,
        is_template: params.isTemplate,
        template_category: params.templateCategory,
        created_by: req.user?.id,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ report: data });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create report',
    });
  }
});

// Update report
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      columns: z.array(z.string()).optional(),
      filters: z.array(z.any()).optional(),
      grouping: z.array(z.any()).optional(),
      aggregations: z.array(z.any()).optional(),
      sorting: z.array(z.any()).optional(),
    });

    const params = schema.parse(req.body);

    const { data, error } = await supabaseClient
      .from('crm_reports')
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ report: data });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update report',
    });
  }
});

// Delete report
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const { error } = await supabaseClient
      .from('crm_reports')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// ============================================================================
// TEMPLATES ENDPOINTS
// ============================================================================

// Get all templates
router.get('/templates', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { category } = req.query;

    let templates = REPORT_TEMPLATES;
    if (category && typeof category === 'string' && category !== 'all') {
      templates = getTemplatesByCategory(category as any);
    }

    res.json({
      templates,
      categories: TEMPLATE_CATEGORIES,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/templates/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const template = getTemplateById(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// ============================================================================
// FAVORITE & HISTORY ENDPOINTS
// ============================================================================

// Toggle favorite
router.patch('/:id/favorite', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Get current favorite status
    const { data: report, error: fetchError } = await supabaseClient
      .from('crm_reports')
      .select('is_favorite')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Toggle favorite
    const { data, error } = await supabaseClient
      .from('crm_reports')
      .update({ is_favorite: !report.is_favorite })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ report: data });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get report run history
router.get('/:id/history', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const { data, error } = await supabaseClient
      .from('report_run_history')
      .select('*')
      .eq('report_id', id)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ history: data || [] });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Log report run (called after executing a report)
router.post('/:id/log-run', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const schema = z.object({
      durationMs: z.number().optional(),
      rowCount: z.number().optional(),
      status: z.enum(['completed', 'failed']).default('completed'),
      errorMessage: z.string().optional(),
      filtersUsed: z.array(z.any()).optional(),
      exportFormat: z.string().optional(),
    });

    const params = schema.parse(req.body);
    const orgId = req.body.orgId || '00000000-0000-0000-0000-000000000001';

    // Insert history record
    const { data, error } = await supabaseClient
      .from('report_run_history')
      .insert({
        report_id: id,
        organization_id: orgId,
        executed_by: req.user?.id,
        duration_ms: params.durationMs,
        row_count: params.rowCount,
        status: params.status,
        error_message: params.errorMessage,
        filters_used: params.filtersUsed || [],
        export_format: params.exportFormat,
      })
      .select()
      .single();

    if (error) {
      console.error('Log run error:', error);
      // Don't fail the request if logging fails
      return res.json({ logged: false, error: error.message });
    }

    // Update report run count and last_run_at
    if (params.status === 'completed') {
      await supabaseClient
        .from('crm_reports')
        .update({
          run_count: supabaseClient.rpc('increment', { x: 1 }),
          last_run_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    res.json({ logged: true, history: data });
  } catch (error) {
    console.error('Log run error:', error);
    res.json({ logged: false, error: 'Failed to log run' });
  }
});

// Export report data
router.post('/:id/export', async (req: AuthenticatedRequest, res) => {
  try {
    if (!hasReportAccess(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { format } = req.body;

    if (!['csv', 'excel', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid export format' });
    }

    // Get report configuration
    const { data: report, error: reportError } = await supabaseClient
      .from('crm_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Execute the report to get data
    let query = supabaseClient
      .from(report.data_source)
      .select('*');

    // Apply filters
    for (const filter of report.filters || []) {
      const column = filter.column.replace('.', '_');
      switch (filter.operator) {
        case 'eq':
          query = query.eq(column, filter.value);
          break;
        case 'neq':
          query = query.neq(column, filter.value);
          break;
        case 'ilike':
          query = query.ilike(column, `%${filter.value}%`);
          break;
        case 'in':
          if (Array.isArray(filter.value)) {
            query = query.in(column, filter.value);
          }
          break;
      }
    }

    const { data, error } = await query.limit(10000);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the export
    await supabaseClient.from('report_run_history').insert({
      report_id: id,
      organization_id: report.organization_id,
      executed_by: req.user?.id,
      row_count: data?.length || 0,
      status: 'completed',
      export_format: format,
    });

    res.json({
      data: data || [],
      columns: report.columns,
      format,
      rowCount: data?.length || 0,
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

export default router;
