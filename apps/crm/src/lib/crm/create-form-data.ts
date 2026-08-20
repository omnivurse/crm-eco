import type { FieldType } from './types';

export type CrmCreateFieldTypes = Readonly<Record<string, FieldType>>;

/**
 * Convert the native FormData posted by the embedded dynamic create form back
 * into CRM JSON values. Native forms only carry strings, so controlled boolean
 * and multiselect fields need explicit coercion before record creation.
 */
export function buildCrmCreateDataFromFormData(
  formData: FormData,
  fieldTypes: CrmCreateFieldTypes,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    if (
      key.startsWith('$ACTION') ||
      key === '_action' ||
      key === '_force' ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      return;
    }

    const fieldType = fieldTypes[key];
    if (fieldType === 'boolean') {
      data[key] = value === 'true' || value === '1' || value === 'on';
      return;
    }

    if (fieldType === 'multiselect') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
          data[key] = parsed;
        }
      } catch {
        // Ignore malformed client serialization instead of storing a JSON
        // string where callers expect an array.
      }
      return;
    }

    data[key] = value;
  });

  return data;
}
