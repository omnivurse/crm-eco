import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@crm-eco/ui';
import { ClipboardCheck, AlertTriangle, UserPlus } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CreateEnrollmentDialog } from '@/components/enrollments/create-enrollment-dialog';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export default async function EnrollmentsPage() {
  const context = await getRoleQueryContext();
  
  if (!context) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Not authenticated</p>
      </div>
    );
  }
  
  // Note: Using type assertion due to @supabase/ssr 0.5.x type inference limitations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerSupabaseClient() as any;
  
  // Build query based on role
  let query = supabase
    .from('enrollments')
    .select(`
      *,
      members:primary_member_id (id, first_name, last_name, state, date_of_birth),
      advisors:advisor_id (id, first_name, last_name),
      plans:selected_plan_id (id, name, code)
    `)
    .eq('organization_id', context.organizationId)
    .order('created_at', { ascending: false })
    .limit(50);
  
  // If advisor, filter to their enrollments or their members' enrollments
  if (context.role === 'advisor' && context.advisorId) {
    query = query.or(`advisor_id.eq.${context.advisorId},primary_member_id.in.(select id from members where advisor_id='${context.advisorId}')`);
  }
  
  // Type definition for enrollment data
  interface EnrollmentData {
    id: string;
    enrollment_number: string | null;
    status: string;
    requested_effective_date: string | null;
    has_mandate_warning: boolean;
    has_age65_warning: boolean;
    created_at: string;
    members: { id: string; first_name: string; last_name: string } | null;
    advisors: { id: string; first_name: string; last_name: string } | null;
    plans: { id: string; name: string; code: string } | null;
  }
  const { data: enrollmentsData, error } = await query;
  const enrollments = enrollmentsData as EnrollmentData[] | null;
  
  if (error) {
    console.error('Error fetching enrollments:', error);
  }
  
  // Fetch members and plans for the create dialog
  const [membersResult, plansResult, advisorsResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, first_name, last_name, state, date_of_birth')
      .eq('organization_id', context.organizationId)
      .order('last_name'),
    supabase
      .from('plans')
      .select('id, name, code')
      .eq('organization_id', context.organizationId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('advisors')
      .select('id, first_name, last_name')
      .eq('organization_id', context.organizationId)
      .eq('status', 'active')
      .order('last_name'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enrollments</h1>
          <p className="text-slate-500">Manage member enrollment journeys</p>
        </div>
        <CreateEnrollmentDialog 
          members={membersResult.data || []}
          plans={plansResult.data || []}
          advisors={advisorsResult.data || []}
        />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-slate-400" />
            Active Enrollments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!enrollments || enrollments.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No enrollments yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Create your first enrollment to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enrollment #</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested Date</TableHead>
                  <TableHead>Warnings</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enrollment: any) => {
                  const member = enrollment.members as { id: string; first_name: string; last_name: string } | null;
                  const advisor = enrollment.advisors as { id: string; first_name: string; last_name: string } | null;
                  const plan = enrollment.plans as { id: string; name: string; code: string } | null;
                  
                  return (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/enrollments/${enrollment.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {enrollment.enrollment_number || enrollment.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {member ? (
                          <Link
                            href={`/members/${member.id}`}
                            className="font-medium hover:text-blue-600"
                          >
                            {member.first_name} {member.last_name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {advisor ? (
                          <Link
                            href={`/advisors/${advisor.id}`}
                            className="hover:text-blue-600"
                          >
                            {advisor.first_name} {advisor.last_name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {plan ? (
                          <span className="text-sm">{plan.name}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">Not selected</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[enrollment.status] || 'bg-slate-100'}
                        >
                          {enrollment.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {enrollment.requested_effective_date || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {enrollment.has_mandate_warning && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Mandate
                            </Badge>
                          )}
                          {enrollment.has_age65_warning && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                              <UserPlus className="w-3 h-3 mr-1" />
                              65+
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDistanceToNow(new Date(enrollment.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

