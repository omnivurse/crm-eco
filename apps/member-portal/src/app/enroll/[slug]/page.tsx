import { Clock, Heart, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getMemberForUser, resolveEnrollmentPlansForLanding } from '@crm-eco/lib';
import { parseLandingEnrollmentMeta } from '@crm-eco/enrollment';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { PublicSlugEnrollmentWizard } from '@/components/enrollments/PublicSlugEnrollmentWizard';
import { loadEnrollmentDocuments, resolveLandingLocale } from '@/lib/enrollment-landing';

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
  sponsor_id: string | null;
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
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (user) {
    const context = await getMemberForUser(userClient, user.id);
    if (context?.member) {
      redirect('/shop?from=enroll-slug');
    }
  }

  const supabase = createServiceRoleClient();

  const { data: landingPage, error: lpError } = (await (supabase as any)
    .from('landing_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()) as { data: LandingPageData | null; error: unknown };

  if (lpError || !landingPage) {
    notFound();
  }

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

  const plans = await resolveEnrollmentPlansForLanding(supabase as any, landingPage);
  const requestHeaders = await headers();
  const landingMeta = parseLandingEnrollmentMeta((landingPage as { meta?: unknown }).meta);
  const locale = resolveLandingLocale((landingPage as { meta?: unknown }).meta, requestHeaders.get('accept-language'));
  const documents = await loadEnrollmentDocuments(
    supabase as any,
    landingPage.organization_id,
    landingMeta.documentIds,
    plans.map((plan) => plan.id),
  );

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
      <section
        className="py-12 text-white"
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

          <h1 className="mb-3 text-3xl font-bold md:text-4xl">
            {landingPage.headline || 'Enroll Now'}
          </h1>

          {landingPage.subheadline && (
            <p className="mx-auto max-w-2xl text-lg opacity-90">{landingPage.subheadline}</p>
          )}

          {advisorName && <p className="mt-3 text-sm opacity-75">Your Advisor: {advisorName}</p>}

          <div className="mt-6 flex flex-wrap justify-center gap-6">
            {[
              { icon: Clock, text: 'Takes ~5 minutes' },
              { icon: ShieldCheck, text: 'Secure & private' },
              { icon: Heart, text: 'No obligation' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm opacity-80">
                <item.icon className="h-4 w-4" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <PublicSlugEnrollmentWizard
            plans={plans}
            slug={landingPage.slug}
            locale={locale}
            documents={documents}
            landingDocumentIds={landingMeta.documentIds}
          />
        </div>
      </div>

      <section className="border-t bg-white py-8">
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
