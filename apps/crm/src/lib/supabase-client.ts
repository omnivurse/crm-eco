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

// Type for the Supabase client
type SupabaseClient = ReturnType<typeof createBrowserClient>;

// Singleton instance - created once, reused everywhere
let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the singleton Supabase browser client
 * Safe to call multiple times - returns the same instance
 * 
 * NOTE: This function is safe to call during SSR/build as it will
 * only create the client when running in a browser environment.
 * Returns null during SSR - callers should check for browser environment.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  // Guard against SSR/build time - only create client in browser
  if (typeof window === 'undefined') {
    return null;
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
 * Uses a Proxy to ensure the client is only created when actually accessed
 * in a browser environment, preventing build-time errors when environment
 * variables aren't available.
 * 
 * During SSR/build, accessing methods will throw a clear error message.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // During SSR/build time, return a function that throws for method calls
    // or undefined for property access to prevent build failures
    if (typeof window === 'undefined') {
      // For 'then' property, return undefined to prevent Promise detection issues
      if (prop === 'then') {
        return undefined;
      }
      // Return a function that throws a clear error for method calls
      return () => {
        throw new Error(
          `Supabase client method "${String(prop)}" was called during SSR/build. ` +
          'Supabase browser client is only available in the browser. ' +
          'Ensure this code runs in a client component with "use client".'
        );
      };
    }
    
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error('Failed to initialize Supabase client');
    }
    return (client as unknown as Record<string, unknown>)[prop as string];
  },
});
