'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AdminProfile {
  organization_id: string;
  full_name: string | null;
}

const supabase = createClient();

export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!mounted || !u) { setLoading(false); return; }
      setUser(u);

      const { data: p } = await supabase
        .from('profiles')
        .select('organization_id, full_name')
        .eq('user_id', u.id)
        .single();

      if (mounted) {
        setProfile(p as AdminProfile | null);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { user, profile, loading, supabase };
}

export { supabase };
