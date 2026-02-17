import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { WebsiteEnrollmentWizard } from '@/components/WebsiteEnrollmentWizard';
import { Heart, Shield, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Enroll Now',
  description:
    'Start your enrollment with Pay It Forward Health. Complete our simple 6-step process to join the health sharing community.',
};

interface PageProps {
  searchParams: Promise<{ resume?: string; plan?: string }>;
}

export default async function EnrollPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerSupabaseClient();

  // Get current user (may not be authenticated on public website)
  const { data: { user } } = await supabase.auth.getUser();

  // Resolve member context if authenticated
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

  if (resolvedSearchParams.resume) {
    const { data: enrollment } = await (supabase as any)
      .from('enrollments')
      .select('*')
      .eq('id', resolvedSearchParams.resume)
      .single();

    if (enrollment) {
      if (!context?.member || enrollment.primary_member_id === context.member.id) {
        existingEnrollment = enrollment;

        const { data: steps } = await (supabase as any)
          .from('enrollment_steps')
          .select('step_key, status, data')
          .eq('enrollment_id', resolvedSearchParams.resume);

        enrollmentSteps = steps || [];
      }
    }
  }

  // Pre-fill data from member if available
  const prefillData = context?.member
    ? {
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
      }
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-teal-600 to-emerald-600 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Join Pay It Forward Health
          </h1>
          <p className="text-teal-100 text-lg max-w-2xl mx-auto">
            Complete the enrollment process below. It only takes a few minutes to
            join our health sharing community.
          </p>

          {/* Quick benefits strip */}
          <div className="flex flex-wrap justify-center gap-6 mt-6">
            {[
              { icon: Clock, text: 'Takes ~5 minutes' },
              { icon: Shield, text: 'Secure & private' },
              { icon: Heart, text: 'No obligation' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-teal-100">
                <item.icon className="w-4 h-4" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enrollment Wizard */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <WebsiteEnrollmentWizard
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
      </div>

      {/* Trust indicators */}
      <section className="bg-white border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-slate-500">
            <span>256-bit SSL Encryption</span>
            <span>HIPAA Compliant</span>
            <span>No hidden fees</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </section>
    </div>
  );
}
