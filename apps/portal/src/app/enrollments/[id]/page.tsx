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
import { ArrowLeft, FileQuestion } from 'lucide-react';
import {
  EnrollmentStatusCard,
  EnrollmentStepsTimeline,
  EnrollmentDetailsCard,
  EnrollmentActivityCard,
} from '@/components/enrollments';

interface PageProps {
  params: { id: string };
}

export default async function EnrollmentDetailPage({ params }: PageProps) {
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
  const enrollment = await getEnrollmentForMember(
    supabase,
    params.id,
    member.id,
    member.organization_id
  );

  // If not found or doesn't belong to this member
  if (!enrollment) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Enrollment Not Found
        </h1>
        <p className="text-slate-600 mb-8">
          This enrollment doesn&apos;t exist or you don&apos;t have access to view it.
        </p>
        <Link href="/">
          <Button className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Fetch related data in parallel
  const [steps, auditLog, membership] = await Promise.all([
    getEnrollmentSteps(supabase, enrollment.id),
    getEnrollmentAuditLog(supabase, enrollment.id, 20),
    getMembershipForEnrollment(
      supabase,
      member.id,
      enrollment.selected_plan_id,
      member.organization_id
    ),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Status Card - Full Width */}
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

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Steps Timeline */}
        <EnrollmentStepsTimeline steps={steps} />

        {/* Right Column - Details */}
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

      {/* Activity History - Full Width */}
      <EnrollmentActivityCard auditLog={auditLog} />

      {/* Resume Enrollment CTA (if draft/in_progress) */}
      {(enrollment.status === 'draft' || enrollment.status === 'in_progress') && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-blue-900">Continue Your Enrollment</h4>
                <p className="text-sm text-blue-700">
                  Pick up where you left off and complete your application.
                </p>
              </div>
              <Link href={`/enroll?resume=${enrollment.id}`}>
                <Button>Resume Enrollment</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

