import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getEnrollmentWizardData } from '@/app/crm/enrollment/actions';
import {
  EnrollmentWizardShell,
  firstIncompleteWizardStep,
  type EnrollmentWizardBootstrap,
  type EnrollmentWizardResumeData,
} from '@/components/enrollment/EnrollmentWizardShell';
import type { WizardStep, StepStatus } from '@/components/enrollment/wizard';

interface ProfileContext {
  id: string;
  organization_id: string;
  crm_role?: string | null;
  advisor_id?: string | null;
}

export async function loadEnrollmentWizardBootstrap(
  profile: ProfileContext
): Promise<EnrollmentWizardBootstrap> {
  const supabase = await createServerSupabaseClient();
  const orgId = profile.organization_id;
  const crmRole = profile.crm_role || 'advisor';

  const [membersResult, leadsResult, advisorsResult, plansResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, first_name, last_name, email, state, date_of_birth')
      .eq('organization_id', orgId)
      .order('last_name')
      .limit(200),
    supabase
      .from('leads')
      .select('id, first_name, last_name, email')
      .eq('organization_id', orgId)
      .not('status', 'in', '(converted,lost,inactive)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('advisors')
      .select('id, first_name, last_name')
      .eq('organization_id', orgId)
      .order('last_name')
      .limit(100),
    supabase
      .from('plans')
      .select('id, name, code, description, tier, monthly_share, iua_amount, enrollment_fee')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
  ]);

  return {
    members: membersResult.data ?? [],
    leads: leadsResult.data ?? [],
    advisors: advisorsResult.data ?? [],
    plans: plansResult.data ?? [],
    isAdvisorRole: crmRole === 'advisor',
    userRole: crmRole as EnrollmentWizardBootstrap['userRole'],
    currentAdvisorId: profile.advisor_id ?? null,
  };
}

export async function loadEnrollmentWizardResume(
  enrollmentId: string
): Promise<EnrollmentWizardResumeData | null> {
  const result = await getEnrollmentWizardData(enrollmentId);
  if (!result.success || !result.data) return null;

  const { enrollment, stepStatuses } = result.data;
  const normalizedSteps = {} as Record<WizardStep, StepStatus>;
  for (const key of Object.keys(stepStatuses) as WizardStep[]) {
    normalizedSteps[key] = {
      isCompleted: stepStatuses[key]?.isCompleted ?? false,
      completedAt: stepStatuses[key]?.completedAt,
    };
  }

  return {
    enrollmentId: enrollment.id,
    snapshot: enrollment.snapshot,
    stepStatuses: normalizedSteps,
    initialStep: firstIncompleteWizardStep(stepStatuses),
  };
}

export { EnrollmentWizardShell };
