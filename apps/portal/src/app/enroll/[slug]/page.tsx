import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { PublicEnrollmentPage } from './client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface LandingPage {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_style: string;
  form_fields: unknown[];
  required_fields: string[];
  plan_ids: string[];
  default_plan_id: string | null;
  default_advisor_id: string | null;
  advisor_selection_enabled: boolean;
  is_published: boolean;
}

interface Plan {
  id: string;
  name: string;
  code: string;
  monthly_share: number;
  description: string | null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: landingPage } = await supabase
    .from('landing_pages')
    .select('name, headline')
    .eq('slug', slug)
    .eq('is_published', true)
    .single() as { data: { name: string; headline: string | null } | null };

  if (!landingPage) {
    return { title: 'Enrollment' };
  }

  return {
    title: landingPage.name || 'Enrollment',
    description: landingPage.headline || 'Start your enrollment today',
  };
}

export default async function EnrollmentLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  // Get the landing page configuration
  const { data: landingPage, error } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !landingPage) {
    notFound();
  }

  const typedLandingPage = landingPage as LandingPage;

  // Track page view
  await (supabase as any).from('landing_page_events').insert({
    landing_page_id: typedLandingPage.id,
    organization_id: typedLandingPage.organization_id,
    event_type: 'view',
  });

  // Get plans
  let plans: Plan[] = [];
  if (typedLandingPage.plan_ids && typedLandingPage.plan_ids.length > 0) {
    const { data: plansData } = await supabase
      .from('plans')
      .select('id, name, code, monthly_share, description')
      .in('id', typedLandingPage.plan_ids)
      .eq('is_active', true)
      .order('monthly_share');

    plans = (plansData || []) as Plan[];
  } else {
    // Get all active plans for the org
    const { data: plansData } = await supabase
      .from('plans')
      .select('id, name, code, monthly_share, description')
      .eq('organization_id', typedLandingPage.organization_id)
      .eq('is_active', true)
      .order('monthly_share')
      .limit(10);

    plans = (plansData || []) as Plan[];
  }

  return (
    <PublicEnrollmentPage
      landingPage={typedLandingPage}
      plans={plans}
    />
  );
}
