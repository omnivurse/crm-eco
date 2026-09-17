import {
  detectEnrollmentLocale,
  parseLandingEnrollmentMeta,
  type EnrollmentLegalDocument,
  type EnrollmentLocale,
} from '@crm-eco/enrollment';

export function resolveLandingLocale(
  meta: unknown,
  acceptLanguage?: string | null,
): EnrollmentLocale {
  const parsed = parseLandingEnrollmentMeta(meta);
  return detectEnrollmentLocale({
    stored: parsed.localeStored,
    acceptLanguage,
  });
}

export async function loadEnrollmentDocuments(
  supabase: { from: (table: string) => any },
  organizationId: string,
  landingDocumentIds: string[],
  planIds: string[],
): Promise<EnrollmentLegalDocument[]> {
  const query = supabase
    .from('legal_documents')
    .select('id, document_name, content_html, product_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(50);

  const { data, error } = await query;
  if (error || !data) return [];

  const wanted = new Set(landingDocumentIds);
  const plans = new Set(planIds);
  return (data as EnrollmentLegalDocument[]).filter(
    (doc) => wanted.has(doc.id) || (doc.product_id && plans.has(doc.product_id)),
  );
}
