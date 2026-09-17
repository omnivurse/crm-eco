export interface EnrollmentLegalDocument {
  id: string;
  document_name: string;
  content_html: string;
  product_id?: string | null;
}

export function parseLandingEnrollmentMeta(meta: unknown): {
  localeStored: 'en' | 'es' | null;
  documentIds: string[];
} {
  if (!meta || typeof meta !== 'object') {
    return { localeStored: null, documentIds: [] };
  }
  const record = meta as Record<string, unknown>;
  const locale = typeof record.locale === 'string' ? record.locale.toLowerCase() : '';
  const rawIds = record.document_ids;
  const documentIds = Array.isArray(rawIds)
    ? rawIds.map((id) => String(id).trim()).filter(Boolean)
    : typeof rawIds === 'string'
      ? rawIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];
  return {
    localeStored: locale === 'es' || locale === 'en' ? locale : null,
    documentIds,
  };
}

/** Sponsor-matched enroll uses the landing/sponsor pack; retail uses plan docs, then landing. */
export function resolveEnrollmentDocumentIds(input: {
  landingDocumentIds?: string[];
  planDocumentIds?: string[];
  sponsorMatched?: boolean;
}): string[] {
  const landing = uniqueIds(input.landingDocumentIds);
  const plan = uniqueIds(input.planDocumentIds);
  if (input.sponsorMatched && landing.length) return landing;
  if (plan.length) return plan;
  return landing;
}

export function selectEnrollmentDocuments(
  documents: EnrollmentLegalDocument[],
  ids: string[],
): EnrollmentLegalDocument[] {
  const wanted = new Set(ids);
  return documents.filter((doc) => wanted.has(doc.id));
}

function uniqueIds(ids?: string[]): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}
