import { NextRequest, NextResponse } from 'next/server';
import { 
  getConnections, 
  createConnection, 
  getHealthSummary,
  type CreateConnectionParams,
  type ConnectionFilters,
} from '@/lib/integrations';

/**
 * GET /api/integrations
 * List all integration connections with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: ConnectionFilters = {};
    
    const connectionType = searchParams.get('connection_type');
    if (connectionType) {
      filters.connection_type = connectionType as ConnectionFilters['connection_type'];
    }
    
    const provider = searchParams.get('provider');
    if (provider) {
      filters.provider = provider as ConnectionFilters['provider'];
    }
    
    const status = searchParams.get('status');
    if (status) {
      filters.status = status as ConnectionFilters['status'];
    }
    
    const healthStatus = searchParams.get('health_status');
    if (healthStatus) {
      filters.health_status = healthStatus as ConnectionFilters['health_status'];
    }
    
    // Check if requesting summary
    const includeSummary = searchParams.get('include_summary') === 'true';
    
    const result = await getConnections(filters);
    
    let response: Record<string, unknown> = {
      connections: result.connections,
      total: result.total,
    };
    
    if (includeSummary) {
      const summary = await getHealthSummary();
      response.summary = summary;
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations
 * Create a new integration connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const params: CreateConnectionParams = {
      provider: body.provider,
      connection_type: body.connection_type,
      name: body.name,
      description: body.description,
      api_key_enc: body.api_key,
      api_secret_enc: body.api_secret,
      settings: body.settings,
    };
    
    // Validate required fields
    if (!params.provider || !params.connection_type || !params.name) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, connection_type, name' },
        { status: 400 }
      );
    }
    
    const connection = await createConnection(params);
    
    return NextResponse.json(connection, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/integrations:', error);
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create integration' },
      { status: 500 }
    );
  }
}
