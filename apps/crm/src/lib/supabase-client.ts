/**
 * Singleton Supabase browser client
 *
 * IMPORTANT: All client-side components should import from here
 * instead of creating their own client with createBrowserClient.
 *
 * This prevents:
 * - Multiple WebSocket connections
 * - Duplicate auth state management
 * - Memory leaks from orphaned clients
 * - Request explosion from non-deduplicated queries
 */

import { createBrowserClient } from '@supabase/ssr';

// Singleton instance - created once, reused everywhere
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Get the singleton Supabase browser client
 * Safe to call multiple times - returns the same instance
 */
export function getSupabaseBrowserClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseInstance;
}

// Export a pre-created instance for convenience
// Use this in most cases: import { supabase } from '@/lib/supabase-client'
export const supabase = getSupabaseBrowserClient();
