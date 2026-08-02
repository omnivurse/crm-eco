/**
 * Shared shape for loading enrollment contribution settings from Supabase-like clients.
 * Kept dependency-free so apps can pass any client with a matching `.from().select()` chain.
 */

export type SettingsRow = { setting_key: string; setting_value: string | null };

/**
 * Accept opaque clients (Supabase) via unknown + narrow cast so we don't trigger
 * deep generic instantiation on PostgrestFilterBuilder.
 */
export async function fetchEnrollmentContributionSettings(
  supabase: unknown,
  organizationId: string
): Promise<Record<string, string>> {
  const client = supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          like: (
            col: string,
            pattern: string
          ) => PromiseLike<{ data: SettingsRow[] | null }>;
        };
      };
    };
  };

  const { data } = await client
    .from('system_settings')
    .select('setting_key, setting_value')
    .eq('organization_id', organizationId)
    .like('setting_key', 'enrollment_contribution_%');

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.setting_key) map[row.setting_key] = row.setting_value ?? '';
  }
  return map;
}
