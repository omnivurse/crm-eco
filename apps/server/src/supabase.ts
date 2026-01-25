import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Client instance for user authentication
export const supabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);