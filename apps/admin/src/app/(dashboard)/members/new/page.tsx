import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { MemberForm } from '@/components/members/MemberForm';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

async function getAgents() {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return [];
  const { data: agents } = await (supabase
    .from('advisors')
    .select('id, first_name, last_name, email')
    .eq('organization_id', tenant.organizationId)
    .eq('status', 'active')
    .order('first_name', { ascending: true }) as any);

  return agents ?? [];
}

export default async function NewMemberPage() {
  const agents = await getAgents();

  return (
    <div className="space-y-6 max-w-3xl">
      <EntityPageHeader
        backHref="/members"
        backLabel="Members"
        title="Add new member"
        description="Create a new member record"
      />

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
