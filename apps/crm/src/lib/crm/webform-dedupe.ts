/**
 * A concrete, non-empty value used to identify duplicate webform submissions.
 */
export type WebformDedupeFilter = {
  field: string;
  source: 'column' | 'data';
  value: string | number | boolean;
};

function isUsableDedupeValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'boolean';
}

/**
 * Resolve a complete composite dedupe key.
 *
 * Returning `null` prevents callers from issuing a tenant/module-only query
 * when a public submission omits one of the configured values. Such a broad
 * query would otherwise select an unrelated record and may overwrite it when
 * the webform uses the `update` dedupe strategy.
 */
export function resolveWebformDedupeFilters(
  configuredFields: string[],
  systemFields: ReadonlySet<string>,
  systemValues: Record<string, unknown>,
  dataValues: Record<string, unknown>,
  isSafeDataField: (field: string) => boolean,
): WebformDedupeFilter[] | null {
  if (configuredFields.length === 0) return null;

  const filters: WebformDedupeFilter[] = [];
  for (const field of configuredFields) {
    const isSystemField = systemFields.has(field);
    if (!isSystemField && !isSafeDataField(field)) return null;

    const source = isSystemField ? systemValues : dataValues;
    if (!Object.prototype.hasOwnProperty.call(source, field)) return null;

    const value = source[field];
    if (!isUsableDedupeValue(value)) return null;

    filters.push({
      field,
      source: isSystemField ? 'column' : 'data',
      value,
    });
  }

  return filters;
}
