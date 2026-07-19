import { Clock, Heart, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PublicEnrollmentWizard } from '../PublicEnrollmentWizard';

export const dynamic = 'force-dynamic';

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
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

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
    description: landingPage.subheadline || 'Start your enrollment.',
  };
}

export default async function PublicLandingEnrollPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

  // Resolve the published landing page (public data; service-role read avoids any
  // anon-RLS dependency on a domain with no session).
  const { data: landingPage, error: lpError } = (await (supabase as any)
    .from('landing_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()) as { data: LandingPageData | null; error: unknown };

  if (lpError || !landingPage) {
    notFound();
  }

  // Track the page view (landing_page_events is service-role only).
  await (supabase as any).from('landing_page_events').insert({
    landing_page_id: landingPage.id,
    organization_id: landingPage.organization_id,
    event_type: 'page_view',
  });

  try {
    await (supabase as any).rpc('increment_landing_page_views', { page_id: landingPage.id });
  } catch {
    // RPC might not exist — ignore.
  }

  // Plans: either the landing page's configured plan_ids, else the org's active plans.
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

  // Advisor branding.
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
              <img src={logoUrl} alt={landingPage.name} className="h-16 object-contain" />
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {landingPage.headline || 'Enroll Now'}
          </h1>

          {landingPage.subheadline && (
            <p className="text-lg max-w-2xl mx-auto opacity-90">{landingPage.subheadline}</p>
          )}

          {advisorName && <p className="mt-3 text-sm opacity-75">Your Advisor: {advisorName}</p>}

          <div className="flex flex-wrap justify-center gap-6 mt-6">
            {[
              { icon: Clock, text: 'Takes ~5 minutes' },
              { icon: ShieldCheck, text: 'Secure & private' },
              { icon: Heart, text: 'No obligation' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm opacity-80">
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
          <PublicEnrollmentWizard plans={plans} slug={landingPage.slug} />
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
