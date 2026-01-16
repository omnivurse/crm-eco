import { NextRequest, NextResponse } from 'next/server';
import { testConnection, getConnection, createLog } from '@/lib/integrations';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/integrations/[id]/test
 * Test an integration connection
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const startTime = Date.now();
    
    // Get the connection first
    const connection = await getConnection(id);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }
    
    // Test the connection
    const result = await testConnection(id);
    const duration = Date.now() - startTime;
    
    // Log the test
    await createLog({
      connection_id: id,
      event_type: 'api_call',
      provider: connection.provider,
      direction: 'outbound',
      method: 'POST',
      endpoint: '/test',
      status: result.success ? 'success' : 'error',
      error_message: result.success ? undefined : result.message,
      duration_ms: duration,
      metadata: { test_result: result },
    });
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('Error in POST /api/integrations/[id]/test:', error);
    return NextResponse.json(
      { error: 'Failed to test integration' },
      { status: 500 }
    );
  }
}
