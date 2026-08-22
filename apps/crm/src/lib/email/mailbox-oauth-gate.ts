/**
 * Personal mailbox OAuth (Gmail / Microsoft 365 mail scopes) is Phase 3.
 * Fail closed until an approved SYNC slice implements it.
 */
export const MAILBOX_OAUTH_IMPLEMENTED = false;

export const MAILBOX_OAUTH_BLOCKED_CODE = 'MAILBOX_OAUTH_GATED';

export function mailboxOauthConnectDecision(flagEnabled: boolean): {
  allowed: false;
  status: 403 | 501;
  code: typeof MAILBOX_OAUTH_BLOCKED_CODE;
  error: string;
} {
  if (!flagEnabled) {
    return {
      allowed: false,
      status: 403,
      code: MAILBOX_OAUTH_BLOCKED_CODE,
      error: 'Personal mailbox OAuth is disabled (crm.comms.mailbox_oauth).',
    };
  }
  return {
    allowed: false,
    status: 501,
    code: MAILBOX_OAUTH_BLOCKED_CODE,
    error: 'Personal mailbox OAuth is not implemented. Calendar OAuth is not mail scopes.',
  };
}
