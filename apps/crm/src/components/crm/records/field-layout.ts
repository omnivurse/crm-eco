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

/** Max columns for stacked inline-edit grids (hero + section bodies). */
export const INLINE_EDIT_GRID_CLASS =
  'grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2' as const;
