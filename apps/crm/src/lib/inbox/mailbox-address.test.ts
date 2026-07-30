/**
 * The resolver under test ships to Deno (the email-intake edge function) but is
 * pure TypeScript, so it is imported directly rather than copied into the app.
 * Keeping one implementation means intake and inbox can never disagree about
 * which shared mailbox owns a thread.
 */
import { describe, expect, it } from 'vitest';
import {
  canonicalizeMailbox,
  mailboxDomain,
  normalizeMailboxAddress,
  resolveMailboxAddress,
} from '../../../../../supabase/functions/_shared/mailbox-address';

const REGISTERED = [
  'billing@payitforwardhealth.com',
  'support@payitforwardhealth.com',
  'enrollment@payitforwardhealth.com',
];

const OWNED = [
  'payitforwardhealth.com',
  'mail.payitforwardhealth.com',
  'info.payitforwardhealth.com',
];

describe('normalizeMailboxAddress', () => {
  it('unwraps a display-name address and lowercases it', () => {
    expect(normalizeMailboxAddress('PIFH Billing <Billing@PayItForwardHealth.com>')).toBe(
      'billing@payitforwardhealth.com',
    );
  });

  it('accepts a bare address', () => {
    expect(normalizeMailboxAddress('  Support@PayItForwardHealth.com ')).toBe(
      'support@payitforwardhealth.com',
    );
  });

  it('rejects values that are not addresses', () => {
    expect(normalizeMailboxAddress('undisclosed-recipients')).toBeNull();
    expect(normalizeMailboxAddress('')).toBeNull();
    expect(normalizeMailboxAddress(null)).toBeNull();
  });
});

describe('mailboxDomain', () => {
  it('extracts the domain', () => {
    expect(mailboxDomain('billing@payitforwardhealth.com')).toBe('payitforwardhealth.com');
  });

  it('returns empty for a malformed address', () => {
    expect(mailboxDomain('nope')).toBe('');
  });
});

describe('resolveMailboxAddress', () => {
  it('files a direct message to the addressed mailbox', () => {
    // Real inbound seen in Resend: Zintego estimate → hello@
    expect(
      resolveMailboxAddress(['hello@payitforwardhealth.com'], [], OWNED),
    ).toBe('hello@payitforwardhealth.com');
  });

  it('prefers an owned To recipient over an external one', () => {
    expect(
      resolveMailboxAddress(
        ['member@gmail.com', 'enrollment@payitforwardhealth.com'],
        [],
        OWNED,
      ),
    ).toBe('enrollment@payitforwardhealth.com');
  });

  it('prefers an owned To over an owned Cc', () => {
    // Being Cc'd must not steal the thread into the billing queue.
    expect(
      resolveMailboxAddress(
        ['support@payitforwardhealth.com'],
        ['billing@payitforwardhealth.com'],
        OWNED,
      ),
    ).toBe('support@payitforwardhealth.com');
  });

  it('falls back to an owned Cc when no To belongs to the org', () => {
    expect(
      resolveMailboxAddress(
        ['someone-else@gmail.com'],
        ['compliance@payitforwardhealth.com'],
        OWNED,
      ),
    ).toBe('compliance@payitforwardhealth.com');
  });

  it('matches owned subdomains', () => {
    expect(
      resolveMailboxAddress(['intake@mail.payitforwardhealth.com'], [], OWNED),
    ).toBe('intake@mail.payitforwardhealth.com');
  });

  it('files an address not in the sender registry rather than dropping it', () => {
    // Real inbound seen in Resend: Owens@ is not a configured sender, but the
    // domain is catch-all so the mail must still land somewhere visible.
    expect(
      resolveMailboxAddress(['Owens@payitforwardhealth.com'], [], OWNED),
    ).toBe('owens@payitforwardhealth.com');
  });

  it('falls back to the first To when the org owns no recipient', () => {
    expect(resolveMailboxAddress(['a@elsewhere.com'], [], OWNED)).toBe('a@elsewhere.com');
  });

  it('returns null when there is no usable recipient', () => {
    expect(resolveMailboxAddress([], [], OWNED)).toBeNull();
    expect(resolveMailboxAddress([undefined, ''], [], OWNED)).toBeNull();
  });

  it('does not crash when the org has no verified domains', () => {
    expect(resolveMailboxAddress(['hello@payitforwardhealth.com'], [], [])).toBe(
      'hello@payitforwardhealth.com',
    );
  });

  it('collapses forwarded subdomain mail onto the registered queue', () => {
    // Liberation forwards billing@apex -> billing@mail.apex. Both must land in
    // the single registered billing@ queue, not two separate ones.
    expect(
      resolveMailboxAddress(
        ['billing@mail.payitforwardhealth.com'],
        [],
        OWNED,
        REGISTERED,
      ),
    ).toBe('billing@payitforwardhealth.com');
  });
});

describe('canonicalizeMailbox', () => {
  it('leaves a registered address untouched', () => {
    expect(canonicalizeMailbox('billing@payitforwardhealth.com', REGISTERED)).toBe(
      'billing@payitforwardhealth.com',
    );
  });

  it('prefers the apex over a receiving subdomain', () => {
    expect(canonicalizeMailbox('support@mail.payitforwardhealth.com', REGISTERED)).toBe(
      'support@payitforwardhealth.com',
    );
  });

  it('keeps an unregistered local part as-is rather than misfiling it', () => {
    // owens@ has no registered counterpart; inventing one would hide the mail.
    expect(canonicalizeMailbox('owens@mail.payitforwardhealth.com', REGISTERED)).toBe(
      'owens@mail.payitforwardhealth.com',
    );
  });

  it('is a no-op when the registry is empty', () => {
    expect(canonicalizeMailbox('billing@mail.payitforwardhealth.com', [])).toBe(
      'billing@mail.payitforwardhealth.com',
    );
  });
});
