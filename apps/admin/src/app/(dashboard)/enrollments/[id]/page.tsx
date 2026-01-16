import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { ArrowLeft, Calendar, Users, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { EnrollmentActions } from '@/components/enrollments/EnrollmentActions';

async function getEnrollment(id: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const { data: enrollment } = await (supabase
    .from('enrollments')
    .select(`
      *,
      primary_member:members!enrollments_primary_member_id_fkey(
        id, first_name, last_name, email, phone, date_of_birth, status,
        address_line1, address_line2, city, state, zip_code
      ),
      plan:plans(id, name, code, monthly_share, iua_amount),
      advisor:advisors(id, first_name, last_name, email)
    `)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single() as any);

  return enrollment;
}

async function getEnrollmentSteps(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('enrollment_steps')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });

  return data ?? [];
}

async function getEnrollmentAuditLog(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('enrollment_audit_log')
    .select(`
      *,
      actor:profiles!enrollment_audit_log_actor_profile_id_fkey(full_name)
    `)
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(20);

  return data ?? [];
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

function formatCurrency(amount: number | null): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default async function EnrollmentDetailPage({ params }: { params: { id: string } }) {
  const enrollment = await getEnrollment(params.id);

  if (!enrollment) {
    notFound();
  }

  const [steps, auditLog] = await Promise.all([
    getEnrollmentSteps(params.id),
    getEnrollmentAuditLog(params.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/enrollments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Enrollment {enrollment.enrollment_number || enrollment.id.slice(0, 8)}
            </h1>
            <p className="text-slate-500">
              {enrollment.primary_member?.first_name} {enrollment.primary_member?.last_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(enrollment.status)} className="text-sm">
            {getStatusLabel(enrollment.status)}
          </Badge>
          <EnrollmentActions enrollmentId={enrollment.id} currentStatus={enrollment.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Primary Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enrollment.primary_member ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Full Name</p>
                    <p className="font-medium">
                      {enrollment.primary_member.first_name} {enrollment.primary_member.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium">{enrollment.primary_member.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium">{enrollment.primary_member.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Date of Birth</p>
                    <p className="font-medium">
                      {enrollment.primary_member.date_of_birth
                        ? format(new Date(enrollment.primary_member.date_of_birth), 'MMM d, yyyy')
                        : '—'}
                    </p>
                  </div>
                  {enrollment.primary_member.address_line1 && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500">Address</p>
                      <p className="font-medium">
                        {enrollment.primary_member.address_line1}
                        {enrollment.primary_member.address_line2 && (
                          <>, {enrollment.primary_member.address_line2}</>
                        )}
                        <br />
                        {enrollment.primary_member.city}, {enrollment.primary_member.state}{' '}
                        {enrollment.primary_member.zip_code}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <Link
                      href={`/members/${enrollment.primary_member.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Full Member Profile →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No member data available</p>
              )}
            </CardContent>
          </Card>

          {/* Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Plan Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enrollment.plan ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Plan Name</p>
                    <p className="font-medium">{enrollment.plan.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Plan Code</p>
                    <p className="font-mono font-medium">{enrollment.plan.code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Monthly Share</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(enrollment.plan.monthly_share)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">IUA Amount</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(enrollment.plan.iua_amount)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Link
                      href={`/products/${enrollment.plan.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Product Details →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No plan selected</p>
              )}
            </CardContent>
          </Card>

          {/* Enrollment Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Steps</CardTitle>
              <CardDescription>Progress through the enrollment process</CardDescription>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No step data available</p>
              ) : (
                <div className="space-y-3">
                  {steps.map((step: any) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      {step.is_completed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-slate-300" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium capitalize">
                          {step.step_key.replace(/_/g, ' ')}
                        </p>
                        {step.completed_at && (
                          <p className="text-xs text-slate-500">
                            Completed {format(new Date(step.completed_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        )}
                      </div>
                      <Badge variant={step.is_completed ? 'default' : 'outline'}>
                        {step.is_completed ? 'Complete' : 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent changes and events</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No activity recorded</p>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((entry: any) => (
                    <div key={entry.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-slate-300 mt-2 shrink-0" />
                      <div className="flex-1">
                        <p>
                          <span className="font-medium">{entry.event_type}</span>
                          {entry.message && <span className="text-slate-500"> — {entry.message}</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {entry.actor?.full_name || 'System'} •{' '}
                          {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  {enrollment.status === 'approved' ? (
                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-2" />
                  ) : enrollment.status === 'rejected' || enrollment.status === 'cancelled' ? (
                    <XCircle className="h-16 w-16 text-red-600 mx-auto mb-2" />
                  ) : (
                    <Clock className="h-16 w-16 text-amber-600 mx-auto mb-2" />
                  )}
                  <Badge variant={getStatusBadgeVariant(enrollment.status)} className="text-lg px-4 py-1">
                    {getStatusLabel(enrollment.status)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Important Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Enrollment Date</p>
                <p className="font-medium">
                  {format(new Date(enrollment.created_at), 'MMMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Requested Effective Date</p>
                <p className="font-medium">
                  {enrollment.requested_effective_date
                    ? format(new Date(enrollment.requested_effective_date), 'MMMM d, yyyy')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Effective Date</p>
                <p className="font-medium">
                  {enrollment.effective_date
                    ? format(new Date(enrollment.effective_date), 'MMMM d, yyyy')
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Agent */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned Agent</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollment.advisor ? (
                <div>
                  <p className="font-medium">
                    {enrollment.advisor.first_name} {enrollment.advisor.last_name}
                  </p>
                  <p className="text-sm text-slate-500">{enrollment.advisor.email}</p>
                  <Link
                    href={`/agents/${enrollment.advisor.id}`}
                    className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                  >
                    View Agent Profile →
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No agent assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Household Info */}
          <Card>
            <CardHeader>
              <CardTitle>Household</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Household Size</span>
                <span className="font-medium">{enrollment.household_size || 1}</span>
              </div>
              {enrollment.has_age65_warning && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                  Age 65+ warning applies
                </div>
              )}
              {enrollment.has_mandate_warning && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                  Mandate warning applies
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Record Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-slate-500">Source: </span>
                <span>{enrollment.enrollment_source || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Channel: </span>
                <span>{enrollment.channel || '—'}</span>
              </div>
              <p className="text-slate-400 font-mono text-xs pt-2">{enrollment.id}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
