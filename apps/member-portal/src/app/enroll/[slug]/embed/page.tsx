import { headers } from 'next/headers';
import { resolveEnrollmentPlansForLanding } from '@crm-eco/lib';
import { parseLandingEnrollmentMeta } from '@crm-eco/enrollment';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PublicSlugEnrollmentWizard } from '@/components/enrollments/PublicSlugEnrollmentWizard';
import { EmbedHeightReporter } from '@/components/enrollments/EmbedHeightReporter';
import { loadEnrollmentDocuments, resolveLandingLocale } from '@/lib/enrollment-landing';

export const dynamic = 'force-dynamic';

export default async function EmbedEnrollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();
  const { data: landing } = await (supabase as any)
    .from('landing_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!landing) notFound();

  const plans = await resolveEnrollmentPlansForLanding(supabase as any, landing);
  const requestHeaders = await headers();
  const landingMeta = parseLandingEnrollmentMeta(landing.meta);
  const locale = resolveLandingLocale(landing.meta, requestHeaders.get('accept-language'));
  const documents = await loadEnrollmentDocuments(
    supabase as any,
    landing.organization_id,
    landingMeta.documentIds,
    plans.map((plan) => plan.id),
  );

  return (
    <div className="min-h-screen bg-white p-4">
      <EmbedHeightReporter />
      <PublicSlugEnrollmentWizard
        plans={plans}
        slug={landing.slug}
        locale={locale}
        documents={documents}
        landingDocumentIds={landingMeta.documentIds}
      />
    </div>
  );
}
