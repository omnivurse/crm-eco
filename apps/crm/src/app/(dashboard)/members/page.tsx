import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Button } from '@crm-eco/ui';
import { AddMemberDialog } from '@/components/members/add-member-dialog';
import { format } from 'date-fns';
import { Search, Users, Download } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext } from '@/lib/auth';
import { MemberStatusBadge } from '@/components/shared/status-badge';

type Member = Database['public']['Tables']['members']['Row'];

interface MemberWithAdvisor extends Member {
  advisors?: { id: string; first_name: string; last_name: string } | null;
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
    .select('*, advisors(id, first_name, last_name)')
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
                  <TableRow 
                    key={member.id} 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => window.location.href = `/members/${member.id}`}
                  >
                    <TableCell>
                      <Link 
                        href={`/members/${member.id}`}
                        className="block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="font-medium text-blue-600 hover:underline">
                          {member.first_name} {member.last_name}
                        </div>
                        {member.member_number && (
                          <div className="text-xs text-slate-400">#{member.member_number}</div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-600">{member.email}</TableCell>
                    <TableCell>
                      <span className="text-slate-600">{member.state ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <MemberStatusBadge status={member.status} />
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {member.advisors ? (
                        <Link 
                          href={`/advisors/${member.advisors.id}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {member.advisors.first_name} {member.advisors.last_name}
                        </Link>
                      ) : '—'}
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
