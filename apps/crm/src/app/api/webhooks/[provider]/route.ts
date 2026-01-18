/**
 * Unified Webhook Route
 * Handles webhooks from all integration providers
 *
 * POST /api/webhooks/[provider]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  processWebhook,
  extractHeaders,
  hasWebhookHandler,
} from '@/lib/integrations/webhooks/router';
import type { WebhookContext } from '@/lib/integrations/webhooks/types';

// Import webhook handlers to register them
import '@/lib/integrations/webhooks/handlers/stripe';

// Use service role for webhook processing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
  params: Promise<{ provider: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;

  // Check if we have a handler for this provider
  if (!hasWebhookHandler(provider)) {
    console.warn(`No webhook handler for provider: ${provider}`);
    return NextResponse.json(
      { error: `Unknown provider: ${provider}` },
      { status: 400 }
    );
  }

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Extract headers
    const headers = extractHeaders(request.headers);

    // Create context
    const context: WebhookContext = {
      supabase,
    };

    // Try to find the connection for this provider to get org context
    // This is optional - some webhooks may not be org-specific
    const { data: connections } = await supabase
      .from('integration_connections')
      .select('id, org_id')
      .eq('provider', provider)
      .eq('status', 'connected')
      .limit(1);

    if (connections && connections.length > 0) {
      context.orgId = connections[0].org_id;
      context.connectionId = connections[0].id;
    }

    // Process the webhook
    const result = await processWebhook(provider, rawBody, headers, context);

    // Log the webhook event
    await supabase.from('integration_logs').insert({
      org_id: context.orgId,
      connection_id: context.connectionId,
      provider,
      event_type: 'webhook_received',
      event_type_detail: result.eventType,
      direction: 'inbound',
      status: result.success ? 'success' : 'error',
      request_body: rawBody.length < 10000 ? JSON.parse(rawBody) : { truncated: true },
      error_message: result.error,
      entity_type: result.entityType,
      entity_id: result.entityId,
      metadata: result.data,
    });

    if (!result.success) {
      console.error(`Webhook processing failed for ${provider}:`, result.error);
      // Still return 200 to acknowledge receipt
      // Most providers will retry on non-200 responses
    }

    return NextResponse.json({
      received: true,
      processed: result.success,
      eventType: result.eventType,
    });
  } catch (error) {
    console.error(`Webhook error for ${provider}:`, error);

    // Log the error
    await supabase.from('integration_logs').insert({
      provider,
      event_type: 'webhook_received',
      event_type_detail: 'error',
      direction: 'inbound',
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return 200 to prevent retries for unrecoverable errors
    return NextResponse.json({
      received: true,
      processed: false,
      error: 'Processing failed',
    });
  }
}

// Some providers use GET for webhook verification
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);

  // Handle Zoom webhook verification
  if (provider === 'zoom') {
    const challenge = searchParams.get('challenge');
    if (challenge) {
      return NextResponse.json({ challenge });
    }
  }

  // Handle Slack URL verification
  if (provider === 'slack') {
    // Slack sends challenge in POST body, but adding GET support just in case
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ status: 'webhook endpoint active' });
}
