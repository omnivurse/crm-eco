export const COMMS_FLAGS = {
  foundation: 'crm.comms.foundation',
  outboxSend: 'crm.comms.outbox_send',
  closedLoop: 'crm.comms.closed_loop',
  killSwitch: 'crm.comms.kill_switch',
  mailboxOauth: 'crm.comms.mailbox_oauth',
  /**
   * Gates bulk campaign delivery specifically. Separate from `killSwitch` so
   * campaigns can stay closed while ordinary replies and transactional mail
   * keep flowing. Defaults closed; a single test send bypasses it.
   */
  campaignSend: 'crm.comms.campaign_send',
  /**
   * Gates automated sequence delivery. A sequence fires on a timer with nobody
   * watching, so it gets its own closed-by-default switch rather than riding on
   * the campaign flag.
   */
  sequenceSend: 'crm.comms.sequence_send',
} as const;

export type CommsFlagKey = (typeof COMMS_FLAGS)[keyof typeof COMMS_FLAGS];

type FlagClient = {
  from: (table: string) => any;
};

/**
 * Org row wins over global. Any read failure returns `fallback` (default false).
 */
export async function isCommsFlagEnabled(
  supabase: FlagClient,
  key: CommsFlagKey,
  organizationId: string | null | undefined,
  fallback = false,
): Promise<boolean> {
  try {
    const orgId = organizationId ?? null;
    const { data, error } = await supabase
      .from('crm_feature_flags')
      .select('organization_id, enabled')
      .eq('flag_key', key)
      .or(orgId ? `organization_id.eq.${orgId},organization_id.is.null` : 'organization_id.is.null');

    if (error) return fallback;
    const rows = (data ?? []) as Array<{ organization_id: string | null; enabled: boolean }>;
    const orgRow = rows.find((row) => row.organization_id === orgId && orgId !== null);
    if (orgRow) return orgRow.enabled;
    const globalRow = rows.find((row) => row.organization_id === null);
    if (globalRow) return globalRow.enabled;
  } catch {
    return fallback;
  }
  return fallback;
}
