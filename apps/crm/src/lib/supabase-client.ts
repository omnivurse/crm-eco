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
 * 
 * NOTE: This function is safe to call during SSR/build as it will
 * only create the client when running in a browser environment.
 */
export function getSupabaseBrowserClient() {
  // Guard against SSR/build time - only create client in browser
  if (typeof window === 'undefined') {
    // Return a placeholder that will throw if methods are called during SSR
    // This should never happen if code is properly guarded with 'use client'
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }
  
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error(
        'Missing Supabase environment variables. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
      );
    }
    
    supabaseInstance = createBrowserClient(url, key);
  }
  return supabaseInstance;
}

/**
 * Lazy-loaded singleton Supabase client
 * 
 * Uses a getter to ensure the client is only created when actually accessed,
 * preventing build-time errors when environment variables aren't available.
 */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient();
    return (client as Record<string, unknown>)[prop as string];
  },
});
