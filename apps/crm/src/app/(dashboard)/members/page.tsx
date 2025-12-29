import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Input, Button } from '@crm-eco/ui';
import { AddMemberDialog } from '@/components/members/add-member-dialog';
import { format } from 'date-fns';
import { Search, Users, Download } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext } from '@/lib/auth';

type Member = Database['public']['Tables']['members']['Row'];

interface MemberWithAdvisor extends Member {
  advisors?: { first_name: string; last_name: string } | null;
}

async function getMembers(): Promise<MemberWithAdvisor[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) {
    console.error('No role context found');
    return [];
  }
  
  let query = supabase
    .from('members')
    .select('*, advisors(first_name, last_name)')
    .order('created_at', { ascending: false });

  // Filter by advisor if user is an advisor
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    query = query.eq('advisor_id', context.advisorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching members:', error);
    return [];
  }

  return (data ?? []) as MemberWithAdvisor[];
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  prospect: 'bg-blue-100 text-blue-700 border-blue-200',
  paused: 'bg-slate-100 text-slate-600 border-slate-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
  terminated: 'bg-red-100 text-red-700 border-red-200',
};

export default async function MembersPage() {
  const members = await getMembers();
  const activeCount = members.filter(m => m.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500">Manage your healthshare members</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <AddMemberDialog />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{members.length}</div>
            <p className="text-sm text-slate-500">Total Members</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
            <p className="text-sm text-slate-500">Active</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">
              {members.filter(m => m.status === 'pending').length}
            </div>
            <p className="text-sm text-slate-500">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">
              {members.filter(m => m.status === 'terminated').length}
            </div>
            <p className="text-sm text-slate-500">Terminated</p>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            All Members
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search members..." 
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No members found</p>
              <p className="text-sm text-slate-400 mt-1">Click &quot;Add Member&quot; to create your first member</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Effective Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="cursor-pointer hover:bg-slate-50">
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {member.first_name} {member.last_name}
                      </div>
                      {member.member_number && (
                        <div className="text-xs text-slate-400">#{member.member_number}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{member.email}</TableCell>
                    <TableCell>
                      <span className="text-slate-600">{member.state ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={statusColors[member.status] || statusColors.inactive}
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {member.advisors
                        ? `${member.advisors.first_name} ${member.advisors.last_name}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {member.effective_date
                        ? format(new Date(member.effective_date), 'MMM d, yyyy')
                        : '—'}
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
