import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { FileText, Eye } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';

async function getEnrollments() {
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

  const { data: enrollments } = await (supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      effective_date,
      created_at,
      primary_member:members!enrollments_primary_member_id_fkey(
        id, first_name, last_name, email
      ),
      plan:plans(id, name, code),
      advisor:advisors(id, first_name, last_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(100) as any);

  return enrollments ?? [];
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'submitted':
    case 'in_progress':
      return 'secondary';
    case 'rejected':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'in_progress':
      return 'In Progress';
    case 'submitted':
      return 'Submitted';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export default async function EnrollmentsPage() {
  const enrollments = await getEnrollments();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enrollments</h1>
          <p className="text-slate-500">Manage enrollment applications</p>
        </div>
      </div>

      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Enrollments</CardTitle>
          <CardDescription>{enrollments.length} enrollments found</CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No enrollments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-slate-500 text-sm">Enrollment #</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Member</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Plan</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Agent</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Effective Date</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Created</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment: any) => (
                    <tr key={enrollment.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 text-sm font-mono">
                        {enrollment.enrollment_number || enrollment.id.slice(0, 8)}
                      </td>
                      <td className="py-3">
                        {enrollment.primary_member ? (
                          <div>
                            <p className="text-sm font-medium">
                              {enrollment.primary_member.first_name}{' '}
                              {enrollment.primary_member.last_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {enrollment.primary_member.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        {enrollment.plan?.name || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 text-sm">
                        {enrollment.advisor ? (
                          `${enrollment.advisor.first_name} ${enrollment.advisor.last_name}`
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={getStatusBadgeVariant(enrollment.status)}>
                          {getStatusLabel(enrollment.status)}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm">
                        {enrollment.effective_date
                          ? format(new Date(enrollment.effective_date), 'MMM d, yyyy')
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 text-sm text-slate-500">
                        {format(new Date(enrollment.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3">
                        <Link href={`/enrollments/${enrollment.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
