/**
 * Shared shape for loading enrollment contribution settings from Supabase-like clients.
 * Kept dependency-free so apps can pass any client with a matching `.from().select()` chain.
 */

export type SettingsRow = { setting_key: string; setting_value: string | null };

interface SettingsQueryClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        like: (
          col: string,
          pattern: string
        ) => Promise<{ data: SettingsRow[] | null }>;
      };
    };
  };
}

export async function fetchEnrollmentContributionSettings(
  supabase: SettingsQueryClient,
  organizationId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
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
