/**
 * A sender address that the authenticated CRM profile may use.
 */
export interface AuthorizedSenderAddress {
  email: string;
  name: string | null;
}

export interface SenderAuthorizationResult {
  authorized: boolean;
  sender: AuthorizedSenderAddress | null;
}

interface SenderProfile {
  id: string;
  organization_id: string;
}

interface SenderAddressRow {
  email: string;
  name: string | null;
  domain_id: string | null;
}

interface UserEmailSettingsRow {
  allowed_domain_ids: string[] | null;
}

// The sender registry is not yet represented in the generated database types.
// Keep the untyped boundary local to this module.
interface SenderAuthorizationClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolve a client-requested From address against the authenticated profile's
 * verified sender registry and optional domain restrictions.
 *
 * An omitted address keeps the existing server-configured default. Any address
 * explicitly supplied by a client fails closed unless it is registered.
 */
export async function resolveAuthorizedSenderAddress(
  supabase: SenderAuthorizationClient,
  profile: SenderProfile,
  requestedEmail: unknown
): Promise<SenderAuthorizationResult> {
  if (requestedEmail === undefined || requestedEmail === null) {
    return { authorized: true, sender: null };
  }

  if (typeof requestedEmail !== 'string') {
    return { authorized: false, sender: null };
  }

  const normalizedEmail = requestedEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return { authorized: false, sender: null };
  }

  const [settingsResult, senderResult] = await Promise.all([
    supabase
      .from('user_email_settings')
      .select('allowed_domain_ids')
      .eq('profile_id', profile.id)
      .maybeSingle(),
    supabase
      .from('email_sender_addresses')
      .select(
        `
          email,
          name,
          domain_id,
          email_domains!inner (status)
        `
      )
      .eq('org_id', profile.organization_id)
      .eq('email', normalizedEmail)
      .eq('is_verified', true)
      .eq('email_domains.status', 'verified')
      .maybeSingle(),
  ]);

  if (settingsResult.error || senderResult.error) {
    throw new Error('Unable to verify sender address permissions');
  }

  const settings = settingsResult.data as UserEmailSettingsRow | null;
  const sender = senderResult.data as SenderAddressRow | null;
  if (!sender) {
    return { authorized: false, sender: null };
  }

  const allowedDomainIds = settings?.allowed_domain_ids ?? [];
  if (
    allowedDomainIds.length > 0 &&
    (!sender.domain_id || !allowedDomainIds.includes(sender.domain_id))
  ) {
    return { authorized: false, sender: null };
  }

  return {
    authorized: true,
    sender: {
      email: sender.email,
      name: sender.name,
    },
  };
}
