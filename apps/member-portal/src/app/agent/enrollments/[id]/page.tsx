import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  User,
  Envelope,
  Phone,
  Calendar,
  CurrencyDollar,
  Hash,
  ClipboardText,
  CreditCard,
} from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getEnrollmentDetails(
  supabase: any,
  enrollmentId: string,
  agentId: string,
  organizationId: string,
) {
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      primary_member:members!primary_member_id (
        id,
        first_name,
        last_name,
        email,
        phone
      ),
      plans:selected_plan_id (
        id,
        name,
        description
      )
    `)
    .eq('id', enrollmentId)
    .eq('advisor_id', agentId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !enrollment) {
    return null;
  }

  return enrollment;
}

async function getAgentInfo(supabase: any, userId: string) {
  // Get profile first
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single() as { data: { id: string } | null };

  if (!profile) return null;

  // Get advisor using profile_id
  const { data: advisor } = await supabase
    .from('advisors')
    .select('id, organization_id')
    .eq('profile_id', profile.id)
    .single() as { data: { id: string; organization_id: string } | null };
  return advisor;
}

export default async function AgentEnrollmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const agent = await getAgentInfo(supabase, user.id);
  if (!agent) redirect('/access-denied');

  const enrollment = await getEnrollmentDetails(supabase, id, agent.id, agent.organization_id);
  if (!enrollment) notFound();

  const member = enrollment.primary_member;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'future active': return 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)]';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'inactive': return 'bg-slate-100 text-slate-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : '-';

  const formatCurrency = (value: number | null) =>
    value || value === 0
      ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agent/enrollments">
          <Button variant="ghost" size="icon">
            <ArrowLeft weight="light" className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {enrollment.plans?.name || enrollment.product_label || 'Enrollment'}
          </h1>
          <p className="text-slate-500">
            {enrollment.enrollment_number
              ? `Enrollment #${enrollment.enrollment_number}`
              : `Enrollment ID: ${enrollment.id}`}
          </p>
        </div>
        <Badge className={getStatusColor(enrollment.status)}>
          {enrollment.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Enrollment Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardText weight="light" className="h-5 w-5" />
              Enrollment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-500">Plan</label>
                <p className="text-slate-900">{enrollment.plans?.name || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Plan Type</label>
                <p className="text-slate-900">{enrollment.plan_type || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Status</label>
                <p className="text-slate-900">{enrollment.status || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Household Size</label>
                <p className="text-slate-900">{enrollment.household_size ?? '-'}</p>
              </div>
            </div>

            {enrollment.plans?.description && (
              <>
                <hr />
                <div>
                  <label className="text-sm font-medium text-slate-500">Plan Description</label>
                  <p className="text-slate-900">{enrollment.plans.description}</p>
                </div>
              </>
            )}

            <hr />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">Effective Date</label>
                  <p className="text-slate-900">{formatDate(enrollment.effective_date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">Enrollment Date</label>
                  <p className="text-slate-900">{formatDate(enrollment.enrollment_date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">End Date</label>
                  <p className="text-slate-900">{formatDate(enrollment.end_date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">Next Billing Date</label>
                  <p className="text-slate-900">{formatDate(enrollment.next_billing_date)}</p>
                </div>
              </div>
            </div>

            {enrollment.notes && (
              <>
                <hr />
                <div className="flex items-start gap-3">
                  <FileText weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <label className="text-sm font-medium text-slate-500">Notes</label>
                    <p className="text-slate-900 whitespace-pre-wrap">{enrollment.notes}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar: Member + Pricing */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User weight="light" className="h-5 w-5" />
                Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member ? (
                <div className="space-y-3">
                  <Link
                    href={`/agent/members/${member.id}`}
                    className="font-medium text-slate-900 hover:text-[var(--mp-teal)]"
                  >
                    {member.first_name} {member.last_name}
                  </Link>
                  {member.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Envelope weight="light" className="h-4 w-4 text-slate-400" />
                      {member.email}
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone weight="light" className="h-4 w-4 text-slate-400" />
                      {member.phone}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No member linked</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CurrencyDollar weight="light" className="h-5 w-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Base Monthly Cost</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(enrollment.base_monthly_cost)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Total Monthly Cost</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(enrollment.total_monthly_cost)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Setup Fee</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(enrollment.setup_fee)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard weight="light" className="h-5 w-5" />
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Payment Status</span>
                <span className="font-medium text-slate-900">
                  {enrollment.payment_status || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Last Payment</span>
                <span className="font-medium text-slate-900">
                  {formatDate(enrollment.last_payment_date)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash weight="light" className="h-5 w-5" />
                References
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-500">Enrollment Number</label>
                <p className="text-slate-900">{enrollment.enrollment_number || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Created</label>
                <p className="text-slate-900">{formatDate(enrollment.created_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Contact Actions */}
      {member && (member.email || member.phone) && (
        <div className="flex gap-4">
          {member.email && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={`mailto:${member.email}`}>
                <Envelope weight="light" className="h-4 w-4" />
                Send Email
              </a>
            </Button>
          )}
          {member.phone && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={`tel:${member.phone}`}>
                <Phone weight="light" className="h-4 w-4" />
                Call Member
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
