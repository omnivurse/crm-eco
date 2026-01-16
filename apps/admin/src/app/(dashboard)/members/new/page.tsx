import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { MemberForm } from '@/components/members/MemberForm';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

async function getAgents() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return [];

  const { data: agents } = await (supabase
    .from('advisors')
    .select('id, first_name, last_name, email')
    .eq('organization_id', profile.organization_id)
    .eq('status', 'active')
    .order('first_name', { ascending: true }) as any);

  return agents ?? [];
}

export default async function NewMemberPage() {
  const agents = await getAgents();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/members">
          <button className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add New Member</h1>
          <p className="text-slate-500">Create a new member record</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
          <CardDescription>
            Enter the member&apos;s personal and contact information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm agents={agents} />
        </CardContent>
      </Card>
    </div>
  );
}
