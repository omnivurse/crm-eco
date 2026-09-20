import { hrefAllowed, sanitizeRecordHits, speakableFields, type GizmoRecordHit } from '@crm-eco/lib/gizmo';
import {
  GLOBAL_SEARCH_DEFAULT_THRESHOLD,
  resolveSearchRows,
  searchRowDisplayTitle,
} from '@/lib/crm/record-search';

/** Same resolver as ⌘K / `/api/crm/search`. Cap 8. CRM hrefs only. */
export async function searchCrmGizmoRecords(
  supabase: Parameters<typeof resolveSearchRows>[0],
  orgId: string,
  query: string,
  moduleFilter?: string | null,
): Promise<GizmoRecordHit[]> {
  const rows = await resolveSearchRows(supabase, orgId, {
    query,
    moduleFilter: moduleFilter?.trim() || null,
    limit: 8,
    threshold: GLOBAL_SEARCH_DEFAULT_THRESHOLD,
  });
  return sanitizeRecordHits(
    'crm',
    rows.map((record) => {
      const subtitle = [record.email, record.phone, record.status].filter(Boolean).join(' · ');
      const data =
        record.data && typeof record.data === 'object' && !Array.isArray(record.data)
          ? (record.data as Record<string, unknown>)
          : null;
      return {
        title: searchRowDisplayTitle(record),
        subtitle: subtitle || undefined,
        href: `/crm/r/${record.id}`,
        module: record.module_name_plural || record.module_name || record.module_key,
        phone: record.phone,
        email: record.email,
        fields: speakableFields({
          email: record.email,
          phone: record.phone,
          status: record.status,
          title: record.title,
          data,
        }),
      };
    }).filter((r) => hrefAllowed('crm', r.href)),
    8,
  );
}
