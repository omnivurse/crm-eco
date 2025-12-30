import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui';
import { ClipboardCheck, User, Building2, FileText, AlertTriangle, UserPlus, CheckCircle, Circle, ArrowLeft, History } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { EnrollmentStatusSelect } from './enrollment-status-select';

interface EnrollmentDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const ENROLLMENT_STEPS = [
  { key: 'intake', label: 'Intake', description: 'Basic information collection' },
  { key: 'household', label: 'Household', description: 'Family members and dependents' },
  { key: 'plan_selection', label: 'Plan Selection', description: 'Choose coverage plan' },
  { key: 'compliance', label: 'Compliance', description: 'Eligibility verification' },
  { key: 'payment', label: 'Payment', description: 'Payment method setup' },
  { key: 'confirmation', label: 'Confirmation', description: 'Review and confirm' },
];

const auditEventColors: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  status_changed: 'bg-blue-100 text-blue-700',
  step_completed: 'bg-purple-100 text-purple-700',
  field_updated: 'bg-slate-100 text-slate-700',
  warning_flagged: 'bg-amber-100 text-amber-700',
  note_added: 'bg-slate-100 text-slate-700',
};

export default async function EnrollmentDetailPage({ params }: EnrollmentDetailPageProps) {
  const { id } = await params;
  const context = await getRoleQueryContext();
  
  if (!context) {
    redirect('/login');
  }
  
  const supabase = await createServerSupabaseClient();
  
  // Fetch enrollment with related data
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select(`
      *,
      members:primary_member_id (id, first_name, last_name, email, phone, state, date_of_birth),
      advisors:advisor_id (id, first_name, last_name, email),
      plans:selected_plan_id (id, name, code, monthly_share, iua_amount),
      leads:lead_id (id, first_name, last_name)
    `)
    .eq('id', id)
    .eq('organization_id', context.organizationId)
    .single();
  
  if (enrollmentError || !enrollment) {
    notFound();
  }
  
  // Fetch enrollment steps
  const { data: steps } = await supabase
    .from('enrollment_steps')
    .select('*')
    .eq('enrollment_id', id)
    .order('created_at');
  
  // Fetch audit log
  const { data: auditLogs } = await supabase
    .from('enrollment_audit_log')
    .select(`
      *,
      profiles:actor_profile_id (full_name)
    `)
    .eq('enrollment_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  const member = enrollment.members as { id: string; first_name: string; last_name: string; email: string; phone: string | null; state: string | null; date_of_birth: string | null } | null;
  const advisor = enrollment.advisors as { id: string; first_name: string; last_name: string; email: string } | null;
  const plan = enrollment.plans as { id: string; name: string; code: string; monthly_share: number | null; iua_amount: number | null } | null;

  // Build step completion map
  const stepMap = new Map(steps?.map(s => [s.step_key, s]) || []);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/enrollments"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Enrollments
      </Link>
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Enrollment {enrollment.enrollment_number || enrollment.id.slice(0, 8)}
            </h1>
            <Badge
              variant="secondary"
              className={statusColors[enrollment.status] || 'bg-slate-100'}
            >
              {enrollment.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Created {formatDistanceToNow(new Date(enrollment.created_at), { addSuffix: true })}
          </p>
        </div>
        <EnrollmentStatusSelect
          enrollmentId={enrollment.id}
          currentStatus={enrollment.status}
          organizationId={context.organizationId}
        />
      </div>

      {/* Warning Badges */}
      {(enrollment.has_mandate_warning || enrollment.has_age65_warning) && (
        <div className="flex gap-2">
          {enrollment.has_mandate_warning && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Mandate State Warning
            </div>
          )}
          {enrollment.has_age65_warning && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
              <UserPlus className="w-4 h-4" />
              Age 65+ Warning
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Member Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-slate-400" />
                  Primary Member
                </CardTitle>
              </CardHeader>
              <CardContent>
                {member ? (
                  <div className="space-y-3">
                    <div>
                      <Link
                        href={`/members/${member.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {member.first_name} {member.last_name}
                      </Link>
                    </div>
                    <div className="text-sm text-slate-500">
                      <p>{member.email}</p>
                      {member.phone && <p>{member.phone}</p>}
                      {member.state && <p>State: {member.state}</p>}
                      {member.date_of_birth && (
                        <p>DOB: {format(new Date(member.date_of_birth), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No member selected</p>
                )}
              </CardContent>
            </Card>

            {/* Advisor Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  Advisor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {advisor ? (
                  <div className="space-y-3">
                    <div>
                      <Link
                        href={`/advisors/${advisor.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {advisor.first_name} {advisor.last_name}
                      </Link>
                    </div>
                    <div className="text-sm text-slate-500">
                      <p>{advisor.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No advisor assigned</p>
                )}
              </CardContent>
            </Card>

            {/* Plan Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-slate-400" />
                  Selected Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plan ? (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-sm text-slate-500 font-mono">{plan.code}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Monthly Share</p>
                        <p className="font-medium">{formatCurrency(plan.monthly_share)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">IUA</p>
                        <p className="font-medium">{formatCurrency(plan.iua_amount)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No plan selected</p>
                )}
              </CardContent>
            </Card>

            {/* Enrollment Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardCheck className="w-5 h-5 text-slate-400" />
                  Enrollment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Source</span>
                    <span className="capitalize">{enrollment.enrollment_source || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Channel</span>
                    <span>{enrollment.channel || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Household Size</span>
                    <span>{enrollment.household_size || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Requested Date</span>
                    <span>
                      {enrollment.requested_effective_date
                        ? format(new Date(enrollment.requested_effective_date), 'MMM d, yyyy')
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Effective Date</span>
                    <span>
                      {enrollment.effective_date
                        ? format(new Date(enrollment.effective_date), 'MMM d, yyyy')
                        : '—'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Steps Tab */}
        <TabsContent value="steps">
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ENROLLMENT_STEPS.map((stepDef, index) => {
                  const step = stepMap.get(stepDef.key);
                  const isCompleted = step?.is_completed || false;
                  
                  return (
                    <div
                      key={stepDef.key}
                      className={`flex items-start gap-4 p-4 rounded-lg border ${
                        isCompleted ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <Circle className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stepDef.label}</span>
                          <span className="text-xs text-slate-400">Step {index + 1}</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{stepDef.description}</p>
                        {step?.completed_at && (
                          <p className="text-xs text-green-600 mt-2">
                            Completed {format(new Date(step.completed_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!auditLogs || auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p>No audit events yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => {
                      const profile = log.profiles as { full_name: string } | null;
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-slate-500">
                            {format(new Date(log.created_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={auditEventColors[log.event_type] || 'bg-slate-100'}
                            >
                              {log.event_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.message || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.old_status && log.new_status ? (
                              <span>
                                <span className="text-slate-400">{log.old_status}</span>
                                <span className="mx-1">→</span>
                                <span className="font-medium">{log.new_status}</span>
                              </span>
                            ) : log.new_status ? (
                              <span className="font-medium">{log.new_status}</span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {profile?.full_name || 'System'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

