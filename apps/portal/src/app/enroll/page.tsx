import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { redirect } from 'next/navigation';
import { SelfServeEnrollmentWizard } from '@/components/SelfServeEnrollmentWizard';

interface PageProps {
  searchParams: { resume?: string };
}

export default async function EnrollPage({ searchParams }: PageProps) {
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

  // If resuming an enrollment, get the data
  let existingEnrollment = null;
  let enrollmentSteps: Array<{ step_key: string; status: string; data: unknown }> = [];

  if (searchParams.resume) {
    const { data: enrollment } = await (supabase as any)
      .from('enrollments')
      .select('*')
      .eq('id', searchParams.resume)
      .single();

    if (enrollment) {
      // Verify ownership
      if (!context?.member || enrollment.primary_member_id === context.member.id) {
        existingEnrollment = enrollment;

        const { data: steps } = await (supabase as any)
          .from('enrollment_steps')
          .select('step_key, status, data')
          .eq('enrollment_id', searchParams.resume);

        enrollmentSteps = steps || [];
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
      />
    </div>
  );
}

