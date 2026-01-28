import { NextRequest, NextResponse } from 'next/server';
import { getLogs, getLogStats, type LogFilters } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/logs
 * Get integration logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const filters: LogFilters = {};
    
    const connectionId = searchParams.get('connection_id');
    if (connectionId) {
      filters.connection_id = connectionId;
    }
    
    const provider = searchParams.get('provider');
    if (provider) {
      filters.provider = provider;
    }
    
    const eventType = searchParams.get('event_type');
    if (eventType) {
      filters.event_type = eventType as LogFilters['event_type'];
    }
    
    const status = searchParams.get('status');
    if (status) {
      filters.status = status as LogFilters['status'];
    }
    
    const direction = searchParams.get('direction');
    if (direction) {
      filters.direction = direction as LogFilters['direction'];
    }
    
    const entityType = searchParams.get('entity_type');
    if (entityType) {
      filters.entity_type = entityType;
    }
    
    const entityId = searchParams.get('entity_id');
    if (entityId) {
      filters.entity_id = entityId;
    }
    
    const fromDate = searchParams.get('from_date');
    if (fromDate) {
      filters.from_date = fromDate;
    }
    
    const toDate = searchParams.get('to_date');
    if (toDate) {
      filters.to_date = toDate;
    }
    
    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    
    // Check if requesting stats
    const includeStats = searchParams.get('include_stats') === 'true';
    
    const result = await getLogs(filters, page, limit);
    
    let response: Record<string, unknown> = {
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore,
      page,
      limit,
    };
    
    if (includeStats) {
      const periodDays = parseInt(searchParams.get('stats_period_days') || '7', 10);
      const stats = await getLogStats(periodDays);
      response.stats = stats;
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/integrations/logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
