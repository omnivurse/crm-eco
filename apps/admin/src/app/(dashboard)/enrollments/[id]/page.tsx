import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { ArrowLeft, Calendar, Users, FileText, CheckCircle, XCircle, Clock, ShieldCheck, MessageSquare, DollarSign, ClipboardList, CreditCard, AlertTriangle, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { EnrollmentActions } from '@/components/enrollments/EnrollmentActions';
import { getActiveTenant } from '@/lib/tenant';

async function getEnrollment(id: string) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: enrollment } = await (supabase
    .from('enrollments')
    .select(`
      *,
      primary_member:members!enrollments_primary_member_id_fkey(
        id, first_name, last_name, email, phone, date_of_birth, status,
        address_line1, address_line2, city, state, postal_code
      ),
      plan:plans!enrollments_selected_plan_id_fkey(id, name, code, monthly_share, iua_amount),
      advisor:advisors(id, first_name, last_name, email)
    `)
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
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

/**
 * Open / most-recent PARALLEL-BINDING approval row (enrollment_approvals).
 * RLS-scoped (admin org policies in
 * supabase/drafts/202606240005_enrollment_approvals_parallel_binding.sql).
 * Returns the latest row so a resolved decision still shows. Degrades to null
 * if the table is not yet provisioned (this is an additive slice).
 */
async function getEnrollmentApproval(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await (supabase as any)
    .from('enrollment_approvals')
    .select('id, status, rule_id, process_id, decision_reason, requested_by, decided_by, decided_at, resolved_at, created_at, context')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/**
 * The review thread (enrollment_reviews) — decision notes (internal) + more-info
 * requests (applicant-visible). The admin page shows ALL rows; the portal member
 * view shows only visibility='applicant'. RLS-scoped via the admin org policies.
 */
async function getEnrollmentReviews(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await (supabase as any)
    .from('enrollment_reviews')
    .select(`
      id, kind, visibility, body, requested_fields, created_at, author_profile_id,
      author:profiles!enrollment_reviews_author_profile_id_fkey(full_name)
    `)
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(50);

  return data ?? [];
}

/**
 * Dependents attached to this enrollment (enrollment_dependents -> dependents).
 * RLS-scoped via the admin org policies; .eq on enrollment_id only. Degrades to
 * [] if the table/rows are absent (additive slice safety).
 */
async function getEnrollmentDependents(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('enrollment_dependents')
    .select(`
      id, relationship, is_primary, is_smoker, has_pre_existing_conditions,
      additional_cost, dependent_product_fee, status, coverage_start_date, coverage_end_date,
      dependent:dependents!enrollment_dependents_dependent_id_fkey(
        id, first_name, last_name, date_of_birth, gender, relationship
      )
    `)
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });

  return data ?? [];
}

/**
 * Questionnaire responses for this enrollment with their per-question answers
 * (questionnaire_responses -> questionnaire_answers). These tables are NOT in the
 * generated Database type yet (D-slice drafts), so we use the (supabase as any)
 * cast convention. Degrades to [] if not yet provisioned.
 */
async function getEnrollmentQuestionnaire(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await (supabase as any)
    .from('questionnaire_responses')
    .select(`
      id, status, submitted_at, created_at,
      answers:questionnaire_answers(*)
    `)
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

/**
 * All billing schedules tied to this enrollment (read-only). RLS-scoped via the
 * admin org policies; .eq on enrollment_id only. Degrades to [] if absent.
 */
async function getEnrollmentBilling(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('billing_schedules')
    .select('id, amount, frequency, status, next_billing_date, start_date, end_date, last_billed_date, billing_day, created_at')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });

  return data ?? [];
}

/**
 * Latest quote snapshot for this enrollment (priced breakdown). RLS-scoped;
 * .eq on enrollment_id only. Degrades to null if absent.
 */
async function getEnrollmentQuote(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('quote_snapshots')
    .select('id, quote_number, status, base_rate, tier_modifier, tier_adjustment, tobacco_multiplier, final_monthly_premium, annual_premium, plan_name, plan_code, benefit_tier_name, breakdown, created_at')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'submitted':
    case 'in_progress':
    case 'pending_review':
      return 'secondary';
    case 'more_info':
      return 'outline';
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
    case 'pending_review':
      return 'Pending Review';
    case 'more_info':
      return 'More Info Needed';
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
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Render a questionnaire_answers value for display, preferring the typed columns
 * (value_text/number/boolean/date) and falling back to the jsonb `value`.
 */
function formatAnswerValue(answer: any): string {
  if (answer.value_text !== null && answer.value_text !== undefined && answer.value_text !== '') {
    return String(answer.value_text);
  }
  if (answer.value_number !== null && answer.value_number !== undefined) {
    return String(answer.value_number);
  }
  if (answer.value_boolean !== null && answer.value_boolean !== undefined) {
    return answer.value_boolean ? 'Yes' : 'No';
  }
  if (answer.value_date) {
    return format(new Date(answer.value_date), 'MMM d, yyyy');
  }
  if (answer.value !== null && answer.value !== undefined) {
    return typeof answer.value === 'string' ? answer.value : JSON.stringify(answer.value);
  }
  return '—';
}

export default async function EnrollmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enrollment = await getEnrollment(id);

  if (!enrollment) {
    notFound();
  }

  const [
    stepsResult,
    auditLogResult,
    approvalResult,
    reviewsResult,
    dependentsResult,
    questionnaireResult,
    billingResult,
    quoteResult,
  ] = await Promise.allSettled([
    getEnrollmentSteps(id),
    getEnrollmentAuditLog(id),
    getEnrollmentApproval(id),
    getEnrollmentReviews(id),
    getEnrollmentDependents(id),
    getEnrollmentQuestionnaire(id),
    getEnrollmentBilling(id),
    getEnrollmentQuote(id),
  ]);
  const steps = stepsResult.status === 'fulfilled' ? stepsResult.value : [];
  const auditLog = auditLogResult.status === 'fulfilled' ? auditLogResult.value : [];
  const approval = approvalResult.status === 'fulfilled' ? approvalResult.value : null;
  const reviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value : [];
  const dependents = dependentsResult.status === 'fulfilled' ? dependentsResult.value : [];
  const questionnaires = questionnaireResult.status === 'fulfilled' ? questionnaireResult.value : [];
  const billingSchedules = billingResult.status === 'fulfilled' ? billingResult.value : [];
  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/enrollments" prefetch={false}>
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
                        {enrollment.primary_member.postal_code}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <Link
                      href={`/members/${enrollment.primary_member.id}`}
                      prefetch={false}
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

          {/* Pricing / Quote */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing &amp; Quote
              </CardTitle>
              <CardDescription>
                Recorded fees on the enrollment{quote ? ' and the latest quote breakdown' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enrollment-recorded fees (read-only; never written here) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Base Monthly Cost</p>
                  <p className="text-xl font-bold">{formatCurrency(enrollment.base_monthly_cost)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Monthly Cost</p>
                  <p className="text-xl font-bold">{formatCurrency(enrollment.total_monthly_cost)}</p>
                </div>
                {enrollment.tobacco_surcharge != null && enrollment.tobacco_surcharge !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Tobacco Surcharge</p>
                    <p className="font-medium">{formatCurrency(enrollment.tobacco_surcharge)}</p>
                  </div>
                )}
                {enrollment.setup_fee != null && enrollment.setup_fee !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Setup Fee</p>
                    <p className="font-medium">{formatCurrency(enrollment.setup_fee)}</p>
                  </div>
                )}
                {enrollment.annual_fee != null && enrollment.annual_fee !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Annual Fee</p>
                    <p className="font-medium">{formatCurrency(enrollment.annual_fee)}</p>
                  </div>
                )}
                {enrollment.administration_fee != null && enrollment.administration_fee !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Administration Fee</p>
                    <p className="font-medium">{formatCurrency(enrollment.administration_fee)}</p>
                  </div>
                )}
                {enrollment.association_fee != null && enrollment.association_fee !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Association Fee</p>
                    <p className="font-medium">{formatCurrency(enrollment.association_fee)}</p>
                  </div>
                )}
                {enrollment.product_fee != null && enrollment.product_fee !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Product Fee</p>
                    <p className="font-medium">{formatCurrency(enrollment.product_fee)}</p>
                  </div>
                )}
                {enrollment.iua_fee != null && enrollment.iua_fee !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">IUA Fee</p>
                    <p className="font-medium">{formatCurrency(enrollment.iua_fee)}</p>
                  </div>
                )}
                {enrollment.monthly_contribution_fee != null && enrollment.monthly_contribution_fee !== 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Monthly Contribution Fee</p>
                    <p className="font-medium">{formatCurrency(enrollment.monthly_contribution_fee)}</p>
                  </div>
                )}
              </div>

              {/* Latest quote snapshot breakdown */}
              {quote && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700">
                      Latest Quote{quote.quote_number ? ` · ${quote.quote_number}` : ''}
                    </p>
                    {quote.status && (
                      <Badge variant="outline" className="capitalize">
                        {(quote.status as string).replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {quote.plan_name && (
                      <div>
                        <p className="text-sm text-slate-500">Quoted Plan</p>
                        <p className="font-medium">
                          {quote.plan_name}
                          {quote.plan_code ? ` (${quote.plan_code})` : ''}
                        </p>
                      </div>
                    )}
                    {quote.benefit_tier_name && (
                      <div>
                        <p className="text-sm text-slate-500">Benefit Tier</p>
                        <p className="font-medium">{quote.benefit_tier_name}</p>
                      </div>
                    )}
                    {quote.base_rate != null && (
                      <div>
                        <p className="text-sm text-slate-500">Base Rate</p>
                        <p className="font-medium">{formatCurrency(quote.base_rate)}</p>
                      </div>
                    )}
                    {quote.tier_adjustment != null && quote.tier_adjustment !== 0 && (
                      <div>
                        <p className="text-sm text-slate-500">Tier Adjustment</p>
                        <p className="font-medium">{formatCurrency(quote.tier_adjustment)}</p>
                      </div>
                    )}
                    {quote.tobacco_multiplier != null && quote.tobacco_multiplier !== 1 && (
                      <div>
                        <p className="text-sm text-slate-500">Tobacco Multiplier</p>
                        <p className="font-medium">×{quote.tobacco_multiplier}</p>
                      </div>
                    )}
                    {quote.final_monthly_premium != null && (
                      <div>
                        <p className="text-sm text-slate-500">Final Monthly Premium</p>
                        <p className="text-xl font-bold">{formatCurrency(quote.final_monthly_premium)}</p>
                      </div>
                    )}
                    {quote.annual_premium != null && (
                      <div>
                        <p className="text-sm text-slate-500">Annual Premium</p>
                        <p className="font-medium">{formatCurrency(quote.annual_premium)}</p>
                      </div>
                    )}
                  </div>
                  {quote.created_at && (
                    <p className="text-xs text-slate-400 mt-3">
                      Quoted {format(new Date(quote.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dependents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Dependents
              </CardTitle>
              <CardDescription>Household members covered under this enrollment</CardDescription>
            </CardHeader>
            <CardContent>
              {dependents.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No dependents on this enrollment</p>
              ) : (
                <div className="space-y-3">
                  {dependents.map((d: any) => (
                    <div key={d.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">
                          {d.dependent
                            ? `${d.dependent.first_name ?? ''} ${d.dependent.last_name ?? ''}`.trim() || 'Dependent'
                            : 'Dependent'}
                        </p>
                        <Badge variant="outline" className="capitalize">
                          {(d.relationship || d.dependent?.relationship || '—').replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div>
                          <span className="text-slate-500">Date of Birth: </span>
                          <span>
                            {d.dependent?.date_of_birth
                              ? format(new Date(d.dependent.date_of_birth), 'MMM d, yyyy')
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Status: </span>
                          <span className="capitalize">{(d.status || '—').replace(/_/g, ' ')}</span>
                        </div>
                        {(d.additional_cost != null && d.additional_cost !== 0) && (
                          <div>
                            <span className="text-slate-500">Additional Cost: </span>
                            <span>{formatCurrency(d.additional_cost)}</span>
                          </div>
                        )}
                        {(d.dependent_product_fee != null && d.dependent_product_fee !== 0) && (
                          <div>
                            <span className="text-slate-500">Product Fee: </span>
                            <span>{formatCurrency(d.dependent_product_fee)}</span>
                          </div>
                        )}
                      </div>
                      {(d.is_smoker || d.has_pre_existing_conditions) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {d.is_smoker && (
                            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                              Tobacco user
                            </Badge>
                          )}
                          {d.has_pre_existing_conditions && (
                            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                              Pre-existing conditions
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Questionnaire Answers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Questionnaire Answers
              </CardTitle>
              <CardDescription>Applicant responses captured during enrollment</CardDescription>
            </CardHeader>
            <CardContent>
              {questionnaires.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No questionnaire responses</p>
              ) : (
                <div className="space-y-4">
                  {questionnaires.map((resp: any) => (
                    <div key={resp.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge variant="outline" className="capitalize">
                          {(resp.status || 'response').replace(/_/g, ' ')}
                        </Badge>
                        {resp.submitted_at && (
                          <span className="text-xs text-slate-400">
                            Submitted {format(new Date(resp.submitted_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        )}
                      </div>
                      {Array.isArray(resp.answers) && resp.answers.length > 0 ? (
                        <div className="space-y-2">
                          {resp.answers.map((a: any) => (
                            <div key={a.id} className="flex justify-between gap-4 text-sm">
                              <span className="text-slate-500 capitalize">
                                {(a.question_key || 'Answer').replace(/_/g, ' ')}
                              </span>
                              <span className="font-medium text-right">{formatAnswerValue(a)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No answers recorded</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing Schedule
              </CardTitle>
              <CardDescription>Recurring billing tied to this enrollment (read-only)</CardDescription>
            </CardHeader>
            <CardContent>
              {billingSchedules.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No billing schedule</p>
              ) : (
                <div className="space-y-3">
                  {billingSchedules.map((b: any) => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{formatCurrency(b.amount)}</p>
                        <p className="text-xs text-slate-500 capitalize">
                          {(b.frequency || '—').replace(/_/g, ' ')}
                          {b.next_billing_date && (
                            <> · Next: {format(new Date(b.next_billing_date), 'MMM d, yyyy')}</>
                          )}
                        </p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(b.status)} className="capitalize">
                        {(b.status || '—').replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Eligibility Findings (from enrollment flags only — NOT vendor_eligibility_runs) */}
          {(() => {
            const findings: string[] = [];
            if (enrollment.has_age65_warning) findings.push('Applicant is age 65 or older.');
            if (enrollment.has_mandate_warning) findings.push('State mandate warning applies.');
            if (enrollment.has_pre_existing_conditions) findings.push('Pre-existing conditions disclosed.');
            if (enrollment.primary_is_smoker) findings.push('Primary applicant is a tobacco user.');
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Eligibility Findings
                  </CardTitle>
                  <CardDescription>Flags recorded on the enrollment</CardDescription>
                </CardHeader>
                <CardContent>
                  {findings.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No eligibility flags</p>
                  ) : (
                    <div className="space-y-2">
                      {findings.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700"
                        >
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                      {enrollment.has_pre_existing_conditions && enrollment.pre_existing_conditions_details && (
                        <div className="mt-2">
                          <p className="text-sm text-slate-500">Pre-existing condition details</p>
                          <p className="text-sm">{enrollment.pre_existing_conditions_details}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

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

          {/* Approval Record (parallel-binding enrollment_approvals row) */}
          {approval && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Approval
                </CardTitle>
                <CardDescription>
                  Review record for this enrollment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Approval Status</p>
                    <Badge
                      variant={getStatusBadgeVariant(approval.status)}
                      className="mt-1 capitalize"
                    >
                      {(approval.status as string).replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Triggered By Rule</p>
                    <p className="font-medium">
                      {(approval.context as any)?.rule_name || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Opened</p>
                    <p className="font-medium">
                      {format(new Date(approval.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Decided</p>
                    <p className="font-medium">
                      {approval.decided_at
                        ? format(new Date(approval.decided_at), 'MMM d, yyyy h:mm a')
                        : '—'}
                    </p>
                  </div>
                  {approval.decision_reason && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500">Reason</p>
                      <p className="font-medium">{approval.decision_reason}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review Thread (enrollment_reviews: decision notes + more-info requests) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Review Notes
              </CardTitle>
              <CardDescription>
                Decision notes (internal) and more-info requests (applicant-visible)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No review notes</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r: any) => (
                    <div key={r.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize text-sm">
                          {(r.kind as string).replace(/_/g, ' ')}
                        </span>
                        <Badge variant={r.visibility === 'applicant' ? 'secondary' : 'outline'}>
                          {r.visibility === 'applicant' ? 'Applicant-visible' : 'Internal'}
                        </Badge>
                      </div>
                      {r.body && <p className="text-sm mt-1">{r.body}</p>}
                      {Array.isArray(r.requested_fields) && r.requested_fields.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          Requested: {r.requested_fields.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {r.author?.full_name || 'System'} •{' '}
                        {format(new Date(r.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
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

          {/* Advisor */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned Advisor</CardTitle>
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
