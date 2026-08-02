'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { ImportWizard } from '@/components/imports';
import { PageHeader } from '@/components/ui/PageHeader';

export default function AgentsImportPage() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single() as { data: { id: string; organization_id: string } | null };

      if (profile) {
        setOrganizationId(profile.organization_id);
        setProfileId(profile.id);
      }
      setLoading(false);
    }

    getProfile();
  }, [supabase, router]);

  if (loading || !organizationId || !profileId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-[#0891b2] rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/agents"
        backLabel="Agents"
        title="Import agents"
        description="Upload and import agent data from CSV"
      />

      <ImportWizard
        importType="agent"
        organizationId={organizationId}
        profileId={profileId}
        onComplete={() => router.push('/agents')}
        onCancel={() => router.push('/agents')}
      />
    </div>
  );
}
