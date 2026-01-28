'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { ImportWizard } from '@/components/imports';
import { Button } from '@crm-eco/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function MembersImportPage() {
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

      const result = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      const profile = result.data as { id: string; organization_id: string } | null;
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
        <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-[#047474] rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Members</h1>
          <p className="text-slate-500">Upload and import member data from CSV</p>
        </div>
      </div>

      <ImportWizard
        importType="member"
        organizationId={organizationId}
        profileId={profileId}
        onComplete={() => router.push('/members')}
        onCancel={() => router.push('/members')}
      />
    </div>
  );
}
