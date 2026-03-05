'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import { Loader2 } from 'lucide-react';
import { BuilderShell } from '@/components/landing-pages/BuilderShell';

export default function LandingPageBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useClientAuth();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile || !params.id) return;
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error || !data) {
        router.push('/crm/settings/landing-pages');
        return;
      }
      setPage(data);
      setLoading(false);
    }
    load();
  }, [profile, params.id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!page) return null;

  return <BuilderShell page={page} />;
}
