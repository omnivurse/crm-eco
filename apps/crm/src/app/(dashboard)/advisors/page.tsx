import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Input, Button } from '@crm-eco/ui';
import { AddAdvisorDialog } from '@/components/advisors/add-advisor-dialog';
import { Search, UserCheck, Download } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { AdvisorStatusBadge } from '@/components/shared/status-badge';

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

export default async function AdvisorsPage() {
  const [advisors, memberCounts] = await Promise.all([
    getAdvisors(),
    getMemberCounts(),
  ]);
  
  const activeCount = advisors.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500">Manage your advisor network</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <AddAdvisorDialog />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{advisors.length}</div>
            <p className="text-sm text-slate-500">Total Advisors</p>
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
              {advisors.filter(a => a.status === 'pending').length}
            </div>
            <p className="text-sm text-slate-500">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">
              {Object.values(memberCounts).reduce((a, b) => a + b, 0)}
            </div>
            <p className="text-sm text-slate-500">Total Members Assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Advisors Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-slate-400" />
            All Advisors
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search advisors..." 
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {advisors.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <UserCheck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No advisors found</p>
              <p className="text-sm text-slate-400 mt-1">Click &quot;Add Advisor&quot; to create your first advisor</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>License States</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Channel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advisors.map((advisor) => (
                  <TableRow 
                    key={advisor.id} 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => window.location.href = `/advisors/${advisor.id}`}
                  >
                    <TableCell>
                      <Link 
                        href={`/advisors/${advisor.id}`}
                        className="block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="font-medium text-blue-600 hover:underline">
                          {advisor.first_name} {advisor.last_name}
                        </div>
                        <div className="text-xs text-slate-400">{advisor.email}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {advisor.agency_name || '—'}
                    </TableCell>
                    <TableCell>
                      <AdvisorStatusBadge status={advisor.status} />
                    </TableCell>
                    <TableCell>
                      {advisor.license_states && advisor.license_states.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {advisor.license_states.slice(0, 3).map((state) => (
                            <Badge key={state} variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                              {state}
                            </Badge>
                          ))}
                          {advisor.license_states.length > 3 && (
                            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                              +{advisor.license_states.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-900">
                        {memberCounts[advisor.id] ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 capitalize">
                      {advisor.primary_channel || '—'}
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
