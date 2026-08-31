import { normalizeMailboxAddress } from '../../../../../supabase/functions/_shared/mailbox-address';

/**
 * Tag a compose-created thread with the From address so it appears under
 * that shared-mailbox folder and replies go out as the same identity.
 */
export function mailboxAddressForOutbound(fromEmail: string | null | undefined): string | null {
  return normalizeMailboxAddress(fromEmail);
}
