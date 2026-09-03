import { Eye, FileText, Tray } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { StatusBadge } from '@crm-eco/ui/components/status-badge';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

async function getEnrollments(status?: string) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return [];
  let query = supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      effective_date,
      start_date,
      created_at,
      primary_member:members!enrollments_primary_member_id_fkey(
        id, first_name, last_name, email
      ),
      plan:plans(id, name, code),
      advisor:advisors(id, first_name, last_name)
    `)
    .eq('organization_id', tenant.organizationId);

  if (status === 'future_active') {
    query = query.eq('status', 'approved').gt('start_date', new Date().toISOString());
  } else if (status) {
    query = query.eq('status', status);
  }

  const { data: enrollments } = await (query
    .order('created_at', { ascending: false })
    .limit(100) as any);

  return enrollments ?? [];
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

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const enrollments = await getEnrollments(params.status);
  const futureActive = params.status === 'future_active';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={futureActive ? 'Future Enrollments' : 'Enrollments'}
        description={
          futureActive
            ? 'Approved enrollments whose coverage has not started yet'
            : 'Manage enrollment applications'
        }
        icon={<FileText weight="light" className="w-6 h-6" />}
        actions={
          <Link href="/enrollments/queue" prefetch={false}>
            <Button variant="outline" size="sm">
              <Tray weight="light" className="h-4 w-4 mr-2" />
              Review Queue
            </Button>
          </Link>
        }
      />

      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <CardTitle>{futureActive ? 'Upcoming approved enrollments' : 'All Enrollments'}</CardTitle>
          <CardDescription>{enrollments.length} enrollments found</CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-center py-12">
              <FileText weight="light" className="h-12 w-12 mx-auto text-slate-300 mb-4" />
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
                    <th className="pb-3 font-medium text-slate-500 text-sm">Advisor</th>
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
                        <StatusBadge
                          status={enrollment.status}
                          label={getStatusLabel(enrollment.status)}
                        />
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
                        <Link href={`/enrollments/${enrollment.id}`} prefetch={false}>
                          <Button variant="ghost" size="sm">
                            <Eye weight="light" className="h-4 w-4" />
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
