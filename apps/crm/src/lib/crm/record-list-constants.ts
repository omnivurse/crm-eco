/** Allowed page sizes for CRM module lists and `/api/crm/records`. */
export const CRM_RECORD_PAGE_SIZES = [25, 50, 100] as const;

export type CrmRecordPageSize = (typeof CRM_RECORD_PAGE_SIZES)[number];

export function parseCrmRecordPageSize(raw: string | null | undefined): CrmRecordPageSize {
  const n = parseInt(raw || '25', 10);
  return CRM_RECORD_PAGE_SIZES.includes(n as CrmRecordPageSize)
    ? (n as CrmRecordPageSize)
    : 25;
}
