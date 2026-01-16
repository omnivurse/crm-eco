import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { ArrowLeft, Edit, Users, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';

async function getMember(id: string) {
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

  const { data: member } = await (supabase
    .from('members')
    .select(`
      *,
      advisor:advisors(id, first_name, last_name, email)
    `)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single() as any);

  return member;
}

async function getDependents(memberId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: dependents } = await supabase
    .from('dependents')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: true });

  return dependents ?? [];
}

async function getEnrollments(memberId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      effective_date,
      created_at,
      plan:plans(id, name, code)
    `)
    .eq('primary_member_id', memberId)
    .order('created_at', { ascending: false });

  return enrollments ?? [];
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
    case 'approved':
      return 'default';
    case 'pending':
    case 'in_progress':
      return 'secondary';
    case 'inactive':
    case 'terminated':
    case 'rejected':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const member = await getMember(params.id);

  if (!member) {
    notFound();
  }

  const [dependents, enrollments] = await Promise.all([
    getDependents(params.id),
    getEnrollments(params.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/members">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {member.first_name} {member.last_name}
            </h1>
            <p className="text-slate-500">{member.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(member.status)}>
            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
          </Badge>
          <Link href={`/members/${member.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Member
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Full Name</p>
                <p className="font-medium">{member.first_name} {member.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Date of Birth</p>
                <p className="font-medium">
                  {member.date_of_birth
                    ? format(new Date(member.date_of_birth), 'MMMM d, yyyy')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Gender</p>
                <p className="font-medium">{member.gender || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Pre-existing Conditions</p>
                <p className="font-medium">
                  {member.existing_condition ? 'Yes' : 'No'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{member.email}</span>
              </div>
              {member.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{member.phone}</span>
                </div>
              )}
              {member.address_line1 && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <p>{member.address_line1}</p>
                    {member.address_line2 && <p>{member.address_line2}</p>}
                    <p>
                      {member.city}, {member.state} {member.zip_code}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dependents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Dependents
              </CardTitle>
              <CardDescription>
                {dependents.length} dependent(s) on file
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dependents.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No dependents registered
                </p>
              ) : (
                <div className="divide-y">
                  {dependents.map((dep: any) => (
                    <div key={dep.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {dep.first_name} {dep.last_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {dep.relationship} •{' '}
                          {dep.date_of_birth
                            ? format(new Date(dep.date_of_birth), 'MMM d, yyyy')
                            : '—'}
                        </p>
                      </div>
                      <Badge variant="outline">{dep.relationship}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Agent */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned Agent</CardTitle>
            </CardHeader>
            <CardContent>
              {member.advisor ? (
                <div>
                  <p className="font-medium">
                    {member.advisor.first_name} {member.advisor.last_name}
                  </p>
                  <p className="text-sm text-slate-500">{member.advisor.email}</p>
                  <Link
                    href={`/agents/${member.advisor.id}`}
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

          {/* Plan Info */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Plan Name</p>
                <p className="font-medium">{member.plan_name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Plan Type</p>
                <p className="font-medium">{member.plan_type || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Effective Date</p>
                <p className="font-medium">
                  {member.effective_date
                    ? format(new Date(member.effective_date), 'MMM d, yyyy')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Monthly Share</p>
                <p className="font-medium">
                  {member.monthly_share
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(member.monthly_share)
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Enrollments */}
          <Card>
            <CardHeader>
              <CardTitle>Enrollments</CardTitle>
              <CardDescription>
                {enrollments.length} enrollment(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <p className="text-sm text-slate-500">No enrollments</p>
              ) : (
                <div className="space-y-3">
                  {enrollments.map((enrollment: any) => (
                    <Link
                      key={enrollment.id}
                      href={`/enrollments/${enrollment.id}`}
                      className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">
                          {enrollment.enrollment_number || enrollment.id.slice(0, 8)}
                        </p>
                        <Badge variant={getStatusBadgeVariant(enrollment.status)} className="text-xs">
                          {enrollment.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {enrollment.plan?.name || 'No plan'}
                      </p>
                    </Link>
                  ))}
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
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-4 w-4" />
                <span>
                  Created {format(new Date(member.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <p className="text-slate-400 font-mono text-xs">{member.id}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
