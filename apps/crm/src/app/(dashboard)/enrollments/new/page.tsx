import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent } from '@crm-eco/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { EnrollmentWizardClient } from './wizard-client';

export default async function NewEnrollmentPage() {
  const context = await getRoleQueryContext();
  
  if (!context) {
    redirect('/login');
  }

  // Only owner, admin, and advisor can create enrollments
  if (!['owner', 'admin', 'advisor'].includes(context.role)) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p>You don&apos;t have permission to create enrollments.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  // Fetch data needed for the wizard
  const [membersResult, leadsResult, plansResult, advisorsResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, first_name, last_name, email, state, date_of_birth')
      .eq('organization_id', context.organizationId)
      .order('last_name'),
    supabase
      .from('leads')
      .select('id, first_name, last_name, email')
      .eq('organization_id', context.organizationId)
      .order('last_name'),
    supabase
      .from('plans')
      .select('id, name, code, description, tier, monthly_share, iua_amount, enrollment_fee')
      .eq('organization_id', context.organizationId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('advisors')
      .select('id, first_name, last_name')
      .eq('organization_id', context.organizationId)
      .eq('status', 'active')
      .order('last_name'),
  ]);

  // Get current user's advisor ID if they are an advisor
  let currentAdvisorId: string | null = null;
  if (context.role === 'advisor' && context.advisorId) {
    currentAdvisorId = context.advisorId;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/enrollments"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Enrollments
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Enrollment</h1>
        <p className="text-slate-500 mt-1">
          Complete each step to submit a new enrollment application
        </p>
      </div>

      {/* Wizard */}
      <EnrollmentWizardClient
        members={membersResult.data || []}
        leads={leadsResult.data || []}
        plans={plansResult.data || []}
        advisors={advisorsResult.data || []}
        currentAdvisorId={currentAdvisorId}
        isAdvisorRole={context.role === 'advisor'}
      />
    </div>
  );
}

