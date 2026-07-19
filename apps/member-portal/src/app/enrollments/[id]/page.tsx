import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { 
  getMemberForUser, 
  getEnrollmentForMember,
  getEnrollmentSteps,
  getEnrollmentAuditLog,
  getMembershipForEnrollment,
} from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent } from '@crm-eco/ui';
import { ArrowLeft, FileDashed } from '@phosphor-icons/react/dist/ssr';
import {
  EnrollmentStatusCard,
  EnrollmentStepsTimeline,
  EnrollmentDetailsCard,
  EnrollmentActivityCard,
  MoreInfoPanel,
} from '@/components/enrollments';
import { getApplicantReviews } from '@/lib/data/moreInfo';
import { PageHeader } from '@/components/PageHeader';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EnrollmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Resolve member from profile
  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    redirect('/');
  }

  const { member } = context;

  // Fetch enrollment with ownership check
  if (!member.organization_id) {
    redirect('/');
  }

  const enrollment = await getEnrollmentForMember(
    supabase,
    id,
    member.id,
    member.organization_id
  );

  // If not found or doesn't belong to this member
  if (!enrollment) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(11,109,133,0.08)]">
          <FileDashed weight="light" className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="mb-4 text-2xl font-bold tracking-[-0.03em] text-[var(--mp-ink)]">
          Enrollment Not Found
        </h1>
        <p className="mb-8 text-slate-600">
          This enrollment doesn&apos;t exist or you don&apos;t have access to view it.
        </p>
        <Link href="/">
          <Button className="gap-2 bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)]">
            <ArrowLeft weight="light" className="h-4 w-4" />
            Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Fetch related data in parallel. getApplicantReviews re-verifies ownership and
  // reads only applicant-visible review rows via service-role; it degrades to an
  // empty payload (the enrollment_reviews draft table may be absent on prod), so
  // allSettled keeps the page resilient if that read rejects.
  const needsMoreInfoPanel = enrollment.status === 'more_info';
  const [steps, auditLog, membership, applicantReviewsResult] = await Promise.all([
    getEnrollmentSteps(supabase, enrollment.id),
    getEnrollmentAuditLog(supabase, enrollment.id, 20),
    getMembershipForEnrollment(
      supabase,
      member.id,
      enrollment.selected_plan_id,
      member.organization_id
    ),
    needsMoreInfoPanel
      ? Promise.allSettled([getApplicantReviews(enrollment.id)])
      : Promise.resolve(null),
  ]);

  const applicantReviews =
    applicantReviewsResult &&
    applicantReviewsResult[0]?.status === 'fulfilled'
      ? applicantReviewsResult[0].value.reviews
      : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Enrollment"
        description={enrollment.enrollment_number ? `#${enrollment.enrollment_number}` : undefined}
        kicker="Membership"
        backHref="/"
        backLabel="Back to Dashboard"
      />

      <EnrollmentStatusCard
        enrollment={{
          id: enrollment.id,
          enrollment_number: enrollment.enrollment_number,
          status: enrollment.status,
          requested_effective_date: enrollment.requested_effective_date,
          effective_date: enrollment.effective_date,
          has_mandate_warning: enrollment.has_mandate_warning || false,
          has_age65_warning: enrollment.has_age65_warning || false,
          updated_at: enrollment.updated_at,
          plans: enrollment.plans,
        }}
        membership={membership}
      />

      {needsMoreInfoPanel && (
        <MoreInfoPanel enrollmentId={enrollment.id} reviews={applicantReviews} />
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <EnrollmentStepsTimeline steps={steps} />

        <EnrollmentDetailsCard
          enrollment={{
            snapshot: enrollment.snapshot as any,
            rx_medications: enrollment.rx_medications as any,
            rx_pricing_result: enrollment.rx_pricing_result as any,
          }}
          plan={enrollment.plans}
          primaryMember={{
            first_name: member.first_name,
            last_name: member.last_name,
            email: member.email,
            phone: member.phone,
            state: member.state,
          }}
        />
      </div>

      <EnrollmentActivityCard auditLog={auditLog} />

      {(enrollment.status === 'draft' || enrollment.status === 'in_progress') && (
        <Card className="border-[rgba(11,109,133,0.15)] bg-[rgba(11,109,133,0.06)]">
          <CardContent className="pt-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h4 className="font-medium text-[var(--mp-ink)]">Continue Your Enrollment</h4>
                <p className="text-sm text-[var(--mp-teal)]">
                  Pick up where you left off and complete your application.
                </p>
              </div>
              <Link href={`/enroll?resume=${enrollment.id}`}>
                <Button className="bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)]">Resume Enrollment</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
