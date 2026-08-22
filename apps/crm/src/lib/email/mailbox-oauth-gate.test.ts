import { describe, expect, it } from 'vitest';
import { MAILBOX_OAUTH_IMPLEMENTED, mailboxOauthConnectDecision } from './mailbox-oauth-gate';

describe('mailbox oauth gate', () => {
  it('is fail-closed even when the flag is on', () => {
    expect(MAILBOX_OAUTH_IMPLEMENTED).toBe(false);
    expect(mailboxOauthConnectDecision(false).status).toBe(403);
    expect(mailboxOauthConnectDecision(true).status).toBe(501);
    expect(mailboxOauthConnectDecision(true).allowed).toBe(false);
  });
});
