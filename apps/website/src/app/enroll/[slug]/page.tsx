import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { notFound } from 'next/navigation';
import { LandingPageEnrollmentWizard } from './LandingPageEnrollmentWizard';
import { Shield, Heart, Clock } from 'lucide-react';

interface LandingPageData {
  id: string;
  name: string;
  slug: string;
  organization_id: string;
  headline: string | null;
  subheadline: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_style: string;
  default_advisor_id: string | null;
  plan_ids: string[];
  default_plan_id: string | null;
  is_published: boolean;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ resume?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: landingPage } = await (supabase as any)
    .from('landing_pages')
    .select('name, headline, subheadline')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!landingPage) {
    return { title: 'Enrollment' };
  }

  return {
    title: landingPage.headline || landingPage.name || 'Enroll Now',
    description:
      landingPage.subheadline ||
      'Start your enrollment with Pay It Forward Health.',
  };
}

export default async function AdvisorLandingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerSupabaseClient();

  // Fetch the landing page by slug
  const { data: landingPage, error: lpError } = await (supabase as any)
    .from('landing_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single() as { data: LandingPageData | null; error: unknown };

  if (lpError || !landingPage) {
    notFound();
  }

  // Track page view
  await (supabase as any)
    .from('landing_page_events')
    .insert({
      landing_page_id: landingPage.id,
      organization_id: landingPage.organization_id,
      event_type: 'page_view',
    });

  // Increment views count
  try {
    await (supabase as any).rpc('increment_landing_page_views', {
      page_id: landingPage.id,
    });
  } catch {
    // RPC might not exist, ignore
  }

  // Get current user (may not be authenticated)
  const { data: { user } } = await supabase.auth.getUser();
  const context = user ? await getMemberForUser(supabase, user.id) : null;

  // Fetch plans - either specific plan_ids from landing page or all active plans
  let plans: Array<{
    id: string;
    name: string;
    code: string;
    monthly_share: number;
    description: string | null;
  }> = [];

  if (landingPage.plan_ids && landingPage.plan_ids.length > 0) {
    const { data: plansData } = await (supabase as any)
      .from('plans')
      .select('id, name, code, monthly_share, description')
      .in('id', landingPage.plan_ids)
      .eq('is_active', true)
      .order('monthly_share');

    plans = plansData || [];
  } else {
    const { data: plansData } = await (supabase as any)
      .from('plans')
      .select('id, name, code, monthly_share, description')
      .eq('organization_id', landingPage.organization_id)
      .eq('is_active', true)
      .order('monthly_share');

    plans = plansData || [];
  }

  // Get advisor info for branding
  let advisorName = '';
  let advisorLogoUrl = '';
  if (landingPage.default_advisor_id) {
    const { data: advisor } = await (supabase as any)
      .from('advisors')
      .select('first_name, last_name, logo_url, company_name')
      .eq('id', landingPage.default_advisor_id)
      .single();

    if (advisor) {
      advisorName = `${advisor.first_name} ${advisor.last_name}`;
      advisorLogoUrl = advisor.logo_url || '';
    }
  }

  // Resuming an enrollment
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

  // Pre-fill data
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

  const primaryColor = landingPage.primary_color || '#0d9488';
  const secondaryColor = landingPage.secondary_color || '#1e3a5f';
  const logoUrl = landingPage.logo_url || advisorLogoUrl;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Branded Hero */}
      <section
        className="text-white py-12"
        style={{
          background:
            landingPage.background_style === 'gradient'
              ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
              : primaryColor,
        }}
      >
        <div className="container mx-auto px-4 text-center">
          {logoUrl && (
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={landingPage.name}
                className="h-16 object-contain"
              />
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {landingPage.headline || 'Join Pay It Forward Health'}
          </h1>

          {landingPage.subheadline && (
            <p className="text-lg max-w-2xl mx-auto opacity-90">
              {landingPage.subheadline}
            </p>
          )}

          {advisorName && (
            <p className="mt-3 text-sm opacity-75">
              Your Advisor: {advisorName}
            </p>
          )}

          {/* Quick benefits strip */}
          <div className="flex flex-wrap justify-center gap-6 mt-6">
            {[
              { icon: Clock, text: 'Takes ~5 minutes' },
              { icon: Shield, text: 'Secure & private' },
              { icon: Heart, text: 'No obligation' },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-2 text-sm opacity-80"
              >
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
          <LandingPageEnrollmentWizard
            existingEnrollmentId={existingEnrollment?.id}
            existingSnapshot={existingEnrollment?.snapshot}
            completedSteps={enrollmentSteps
              .filter((s) => s.status === 'completed')
              .map((s) => s.step_key)}
            plans={plans}
            prefillData={prefillData}
            isAuthenticated={!!user}
            advisorId={landingPage.default_advisor_id || undefined}
            landingPageId={landingPage.id}
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
