/**
 * Field-cell layout helpers for DynamicRecordForm.
 *
 * Dense label|value rows are only safe when the value is static text.
 * Inline-edit mode must stack label → value so click-to-edit controls
 * never collide in auto-fit grids.
 */

export function shouldUseDenseFieldRow(options: {
  row?: boolean;
  readOnly?: boolean;
  inlineEditable?: boolean;
}): boolean {
  return Boolean(options.row) && Boolean(options.readOnly) && !options.inlineEditable;
}

/**
 * Stacked inline-edit grids (hero + section bodies). Reps want as much data
 * at a glance as possible, so the grid packs 2 → 3 → 4 columns as the
 * viewport widens; label→value cells stay stacked so click-to-edit controls
 * never collide.
 */
export const INLINE_EDIT_GRID_CLASS =
  'grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' as const;

/**
 * Whether a field should take a whole grid row. `crm_fields.width = 'full'`
 * was mass-imported onto plain text/date/select fields (175 of 258 contact
 * fields on PIFH), which forced one field per row and left the record page
 * mostly empty. Only genuinely long values earn a full row.
 */
export function fieldSpansFullRow(field: { type: string; width?: string | null }): boolean {
  return field.type === 'textarea' || field.type === 'multiselect';
}

/** Span class for {@link fieldSpansFullRow} fields inside any of the grids above. */
export const FULL_ROW_SPAN_CLASS = 'md:col-span-full' as const;
