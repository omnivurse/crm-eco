/**
 * Safely extract options array from field.options
 * Handles cases where options might be a string, object, or undefined.
 * This prevents "map is not a function" errors when field.options
 * comes from the database in unexpected formats.
 * 
 * @param options - The options value from a field (can be array, string, or unknown)
 * @returns A string array that is safe to iterate over
 * 
 * @example
 * // All of these return a valid array:
 * getFieldOptions(['a', 'b'])     // ['a', 'b']
 * getFieldOptions('["a","b"]')    // ['a', 'b'] (JSON string)
 * getFieldOptions('a, b, c')      // ['a', 'b', 'c'] (comma-separated)
 * getFieldOptions(undefined)      // []
 * getFieldOptions(null)           // []
 * getFieldOptions({})             // []
 */
export function getFieldOptions(options: unknown): string[] {
  // If already an array, return it directly
  if (Array.isArray(options)) {
    return options.map(String); // Ensure all items are strings
  }
  
  // If it's a string, try to parse it
  if (typeof options === 'string') {
    const trimmed = options.trim();
    
    // Empty string
    if (!trimmed) {
      return [];
    }
    
    // Try parsing as JSON first (could be a JSON array string)
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
      } catch {
        // Not valid JSON, fall through to comma-separated handling
      }
    }
    
    // Treat as comma-separated values
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  
  // For any other type (null, undefined, object, etc.), return empty array
  return [];
}
