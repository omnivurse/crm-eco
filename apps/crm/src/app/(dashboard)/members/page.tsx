import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import { AddMemberDialog } from '@/components/members/add-member-dialog';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';

type Member = Database['public']['Tables']['members']['Row'];

interface MemberWithAdvisor extends Member {
  advisors?: { first_name: string; last_name: string } | null;
}

async function getMembers(): Promise<MemberWithAdvisor[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('members')
    .select('*, advisors(first_name, last_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching members:', error);
    return [];
  }

  return (data ?? []) as MemberWithAdvisor[];
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

export default async function MembersPage() {
  const members = await getMembers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="text-slate-600">Manage your healthshare members</p>
        </div>
        <AddMemberDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-2">No members found</p>
              <p className="text-sm">Click "Add Member" to create your first member</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Effective Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.first_name} {member.last_name}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(member.status)}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{member.state ?? '-'}</TableCell>
                    <TableCell>
                      {member.advisors
                        ? `${member.advisors.first_name} ${member.advisors.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {member.effective_date
                        ? format(new Date(member.effective_date), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
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
