import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { MemberTable } from '@/components/members/MemberTable';

async function getMembers() {
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

  const { data: members } = await (supabase
    .from('members')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
      state,
      plan_name,
      effective_date,
      created_at,
      advisor:advisors(id, first_name, last_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(100) as any);

  return members ?? [];
}

export default async function MembersPage() {
  const members = await getMembers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="text-slate-500">Manage member accounts and information</p>
        </div>
        <Link href="/members/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </Link>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>{members.length} members found</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberTable members={members} />
        </CardContent>
      </Card>
    </div>
  );
}
