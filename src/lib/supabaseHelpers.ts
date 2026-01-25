/**
 * Supabase Query Helper Functions
 * Handles common type mismatches between Supabase queries and TypeScript types
 */

/**
 * Normalizes a Supabase relation that might be returned as an array or single object
 * Supabase foreign key relations sometimes return arrays instead of single objects
 */
export function normalizeRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] || null) : relation;
}

/**
 * Maps an array of items with relations, normalizing each relation field
 */
export function normalizeQueryResults<T extends Record<string, any>>(
  data: any[],
  relationFields: string[]
): T[] {
  return data.map((item) => {
    const normalized: any = { ...item };
    relationFields.forEach((field) => {
      if (item[field]) {
        normalized[field] = normalizeRelation(item[field]);
      }
    });
    return normalized as T;
  });
}
