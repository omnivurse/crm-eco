import { NextRequest, NextResponse } from 'next/server';
import { 
  getConnection, 
  updateConnection, 
  deleteConnection,
  connectIntegration,
  disconnectIntegration,
  type UpdateConnectionParams,
} from '@/lib/integrations';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/integrations/[id]
 * Get a single integration connection
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const connection = await getConnection(id);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(connection);
  } catch (error) {
    console.error('Error in GET /api/integrations/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/integrations/[id]
 * Update an integration connection
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if this is a connect/disconnect action
    const action = body.action;
    
    if (action === 'connect') {
      const connection = await connectIntegration(id, {
        api_key: body.api_key,
        api_secret: body.api_secret,
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: body.expires_at,
        external_account_id: body.external_account_id,
        external_account_name: body.external_account_name,
        external_account_email: body.external_account_email,
        settings: body.settings,
      });
      return NextResponse.json(connection);
    }
    
    if (action === 'disconnect') {
      const connection = await disconnectIntegration(id);
      return NextResponse.json(connection);
    }
    
    // Standard update
    const updateParams: UpdateConnectionParams = {};
    
    if (body.name !== undefined) updateParams.name = body.name;
    if (body.description !== undefined) updateParams.description = body.description;
    if (body.status !== undefined) updateParams.status = body.status;
    if (body.settings !== undefined) updateParams.settings = body.settings;
    if (body.api_key !== undefined) updateParams.api_key_enc = body.api_key;
    if (body.api_secret !== undefined) updateParams.api_secret_enc = body.api_secret;
    if (body.health_status !== undefined) updateParams.health_status = body.health_status;
    
    const connection = await updateConnection(id, updateParams);
    
    return NextResponse.json(connection);
  } catch (error) {
    console.error('Error in PUT /api/integrations/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update integration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/[id]
 * Delete an integration connection
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    await deleteConnection(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/integrations/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to delete integration' },
      { status: 500 }
    );
  }
}
