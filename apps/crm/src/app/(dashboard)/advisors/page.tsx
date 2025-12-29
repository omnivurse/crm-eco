import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import { AddAdvisorDialog } from '@/components/advisors/add-advisor-dialog';
import type { Database } from '@crm-eco/lib/types';

type Advisor = Database['public']['Tables']['advisors']['Row'];

async function getAdvisors(): Promise<Advisor[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('advisors')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching advisors:', error);
    return [];
  }

  return (data ?? []) as Advisor[];
}

async function getMemberCounts(): Promise<Record<string, number>> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('members')
    .select('advisor_id')
    .not('advisor_id', 'is', null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  (data as { advisor_id: string | null }[]).forEach((member) => {
    if (member.advisor_id) {
      counts[member.advisor_id] = (counts[member.advisor_id] || 0) + 1;
    }
  });
  return counts;
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'active':
      return 'success';
    case 'pending':
      return 'warning';
    case 'inactive':
    case 'terminated':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default async function AdvisorsPage() {
  const [advisors, memberCounts] = await Promise.all([
    getAdvisors(),
    getMemberCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Advisors</h1>
          <p className="text-slate-600">Manage your advisor network</p>
        </div>
        <AddAdvisorDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Advisors</CardTitle>
        </CardHeader>
        <CardContent>
          {advisors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-2">No advisors found</p>
              <p className="text-sm">Click "Add Advisor" to create your first advisor</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>License States</TableHead>
                  <TableHead>Total Members</TableHead>
                  <TableHead>Commission Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advisors.map((advisor) => (
                  <TableRow key={advisor.id}>
                    <TableCell className="font-medium">
                      {advisor.first_name} {advisor.last_name}
                    </TableCell>
                    <TableCell>{advisor.email}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(advisor.status)}>
                        {advisor.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {advisor.license_states && advisor.license_states.length > 0
                        ? advisor.license_states.join(', ')
                        : '-'}
                    </TableCell>
                    <TableCell>{memberCounts[advisor.id] ?? 0}</TableCell>
                    <TableCell>{advisor.commission_tier ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
