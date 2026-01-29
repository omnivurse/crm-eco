/**
 * Realtime Broadcast Utilities
 *
 * Provides server-side broadcasting to replace postgres_changes subscriptions.
 * This eliminates WAL polling overhead by using explicit broadcasts.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton admin client for server-side broadcasting
let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for broadcast');
    }

    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}

/**
 * Broadcast a change event to all subscribers for an organization
 */
export async function broadcastChangeEvent(event: {
  id: string;
  org_id: string;
  source_type: string;
  source_name?: string;
  change_type: string;
  entity_type: string;
  entity_id: string;
  entity_title?: string;
  severity: string;
  requires_review?: boolean;
  title: string;
  description?: string;
  sync_status?: string;
  actor_id?: string;
  actor_name?: string;
  created_at: string;
}): Promise<void> {
  try {
    const client = getAdminClient();
    const channelName = `change-events:${event.org_id}`;

    const channel = client.channel(channelName);

    await channel.send({
      type: 'broadcast',
      event: 'change_event',
      payload: event,
    });

    // Clean up channel after sending
    await client.removeChannel(channel);
  } catch (error) {
    // Log but don't throw - broadcast failure shouldn't break the main operation
    console.error('Failed to broadcast change event:', error);
  }
}

/**
 * Broadcast an admin notification to a specific user
 */
export async function broadcastAdminNotification(notification: {
  id: string;
  user_id: string;
  title: string;
  body?: string;
  href?: string;
  icon?: string;
  type?: string;
  meta?: Record<string, unknown>;
  created_at: string;
}): Promise<void> {
  try {
    const client = getAdminClient();
    const channelName = `admin-notifications:${notification.user_id}`;

    const channel = client.channel(channelName);

    await channel.send({
      type: 'broadcast',
      event: 'notification',
      payload: notification,
    });

    // Clean up channel after sending
    await client.removeChannel(channel);
  } catch (error) {
    console.error('Failed to broadcast admin notification:', error);
  }
}
