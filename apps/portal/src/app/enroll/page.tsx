import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import type { QuestionnaireTemplate } from '@crm-eco/enrollment';
import { redirect } from 'next/navigation';
import { SelfServeEnrollmentWizard } from '@/components/SelfServeEnrollmentWizard';
import { getDefaultQuestionnaireTemplate } from '@/lib/enroll/questionnaire';

interface PageProps {
  searchParams: Promise<{ resume?: string }>;
}

export default async function EnrollPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerSupabaseClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Resolve member context (may be null for new users)
  const context = user ? await getMemberForUser(supabase, user.id) : null;

  // Get available plans
  const organizationId = context?.member?.organization_id;
  let plans: Array<{
    id: string;
    name: string;
    code: string;
    monthly_share: number;
    description: string | null;
  }> = [];

  if (organizationId) {
    const { data: plansData } = await (supabase as any)
      .from('plans')
      .select('id, name, code, monthly_share, description')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('monthly_share');

    plans = plansData || [];
  } else {
    // For new users, get plans from first available org
    const { data: plansData } = await (supabase as any)
      .from('plans')
      .select('id, name, code, monthly_share, description')
      .eq('is_active', true)
      .order('monthly_share')
      .limit(10);

    plans = plansData || [];
  }

  // Load the org's DEFAULT, PUBLISHED questionnaire template (if any). The
  // questionnaire step runs before plan selection, so it loads the org default
  // (not a plan-keyed template). When none exists this is undefined and the
  // wizard leaves the step inert/skipped — unchanged behavior. Requires an org
  // context; RLS on the questionnaire tables scopes the read to the caller's org.
  let questionnaireTemplate: QuestionnaireTemplate | undefined;
  if (organizationId) {
    questionnaireTemplate = await getDefaultQuestionnaireTemplate(organizationId);
  }

  // If resuming an enrollment, get the data
  let existingEnrollment = null;
  let enrollmentSteps: Array<{ step_key: string; status: string; data: unknown }> = [];

  if (resolvedSearchParams.resume) {
    const { data: enrollment } = await (supabase as any)
      .from('enrollments')
      .select('*')
      .eq('id', resolvedSearchParams.resume)
      .single();

    if (enrollment) {
      // Verify ownership
      if (!context?.member || enrollment.primary_member_id === context.member.id) {
        existingEnrollment = enrollment;

        const { data: rawSteps } = await (supabase as any)
          .from('enrollment_steps')
          .select('step_key, is_completed, payload')
          .eq('enrollment_id', resolvedSearchParams.resume);

        // Adapt DB shape to wizard's expected {status, data} shape.
        enrollmentSteps = (rawSteps ?? []).map(
          (s: { step_key: string; is_completed: boolean; payload: unknown }) => ({
            step_key: s.step_key,
            status: s.is_completed ? 'completed' : 'pending',
            data: s.payload,
          })
        );
      }
    }
  }

  // Pre-fill data from member if available
  const prefillData = context?.member ? {
    email: context.member.email || '',
    phone: context.member.phone || '',
    address_line1: context.member.address_line1 || '',
    address_line2: context.member.address_line2 || '',
    city: context.member.city || '',
    state: context.member.state || '',
    zip_code: context.member.postal_code || '',
    first_name: context.member.first_name || '',
    last_name: context.member.last_name || '',
    date_of_birth: context.member.date_of_birth || '',
  } : undefined;

  // Resolve the eligibility-enforcement flag server-side so the env var never
  // ships to the client bundle. Default OFF -> eligibility findings are advisory
  // only; flipping to 'true' makes blocking findings hard-gate plan selection.
  const eligibilityEnforce = process.env.ELIGIBILITY_ENFORCE === 'true';

  return (
    <div className="max-w-4xl mx-auto">
      <SelfServeEnrollmentWizard
        existingEnrollmentId={existingEnrollment?.id}
        existingSnapshot={existingEnrollment?.snapshot}
        completedSteps={enrollmentSteps
          .filter((s) => s.status === 'completed')
          .map((s) => s.step_key)}
        plans={plans}
        prefillData={prefillData}
        isAuthenticated={!!user}
        eligibilityEnforce={eligibilityEnforce}
        questionnaireTemplate={questionnaireTemplate}
      />
    </div>
  );
}

