/**
 * Hydration ships to Deno (the email-intake edge function) but is pure
 * TypeScript, so it is imported directly rather than copied — one
 * implementation means intake and any future consumer cannot disagree.
 *
 * The behaviour under test is deliberately failure-biased: inbound mail must
 * still be filed when Resend's content API is unavailable, because a
 * subject-only thread is recoverable and a dropped webhook is not.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  fetchReceivedEmail,
  mergeHydratedEmail,
  normaliseResendHeaders,
  preferredRecipient,
  routeInboundRecipients,
  type HydratableEmail,
} from '../../../../../supabase/functions/_shared/resend-inbound';

const base: HydratableEmail = { subject: 'Re: enrollment question', body_text: '' };

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('normaliseResendHeaders', () => {
  it('lowercases keys from an object', () => {
    expect(normaliseResendHeaders({ 'Message-ID': '<a@b>' })).toEqual({ 'message-id': '<a@b>' });
  });

  it('accepts the array-of-pairs form Resend also uses', () => {
    expect(normaliseResendHeaders([{ name: 'Subject', value: 'Hi' }])).toEqual({ subject: 'Hi' });
  });

  it('treats null/undefined as no headers rather than throwing', () => {
    expect(normaliseResendHeaders(null)).toEqual({});
    expect(normaliseResendHeaders(undefined)).toEqual({});
  });
});

describe('mergeHydratedEmail', () => {
  it('fills in the body the webhook never carries', () => {
    const merged = mergeHydratedEmail(base, { text: 'tes reply', html: '<p>tes reply</p>' });
    expect(merged.body_text).toBe('tes reply');
    expect(merged.body_html).toBe('<p>tes reply</p>');
  });

  it('returns the original untouched when hydration failed', () => {
    expect(mergeHydratedEmail(base, null)).toEqual(base);
  });

  it('does not blank an existing body with an empty fetched one', () => {
    const withBody: HydratableEmail = { ...base, body_text: 'kept' };
    expect(mergeHydratedEmail(withBody, { text: '', html: null }).body_text).toBe('kept');
  });

  it('ignores whitespace-only fetched content', () => {
    const withBody: HydratableEmail = { ...base, body_text: 'kept' };
    expect(mergeHydratedEmail(withBody, { text: '   \n  ' }).body_text).toBe('kept');
  });

  it('lets signed webhook headers win over hydrated ones', () => {
    const withHeaders: HydratableEmail = { ...base, headers: { 'message-id': '<from-webhook>' } };
    const merged = mergeHydratedEmail(withHeaders, {
      headers: { 'Message-ID': '<from-api>', 'return-path': 'x@y.com' },
    });
    expect(merged.headers?.['message-id']).toBe('<from-webhook>');
    // Non-conflicting hydrated headers still fill in.
    expect(merged.headers?.['return-path']).toBe('x@y.com');
  });

  it('adopts reply_to only when the webhook supplied none', () => {
    expect(mergeHydratedEmail(base, { reply_to: ['a@b.com'] }).reply_to).toEqual(['a@b.com']);

    const preset: HydratableEmail = { ...base, reply_to: ['keep@b.com'] };
    expect(mergeHydratedEmail(preset, { reply_to: ['other@b.com'] }).reply_to).toEqual(['keep@b.com']);
  });

  it('adopts received_for so intake can prefer the original recipient', () => {
    expect(
      mergeHydratedEmail(base, { received_for: ['wendy@payitforwardhealth.com'] }).received_for,
    ).toEqual(['wendy@payitforwardhealth.com']);
  });

  it('records attachment metadata without downloading content', () => {
    const merged = mergeHydratedEmail(base, {
      attachments: [{ filename: 'eob.pdf', content_type: 'application/pdf', size: 1024 }],
    });
    expect(merged.attachments).toEqual([
      { filename: 'eob.pdf', content_type: 'application/pdf', size: 1024 },
    ]);
    // No base64 content is carried, so a large attachment cannot blow memory.
    expect(merged.attachments?.[0]).not.toHaveProperty('content');
  });

  it('defaults malformed attachment metadata instead of throwing', () => {
    const merged = mergeHydratedEmail(base, { attachments: [{}] });
    expect(merged.attachments).toEqual([
      { filename: 'attachment', content_type: 'application/octet-stream', size: 0 },
    ]);
  });
});

describe('preferredRecipient', () => {
  const owned = ['payitforwardhealth.com'];

  it('recovers the original recipient of forwarded mail', () => {
    expect(preferredRecipient(['billing@payitforwardhealth.com'], owned)).toBe(
      'billing@payitforwardhealth.com',
    );
  });

  it('ignores recipients on domains we do not own', () => {
    expect(preferredRecipient(['someone@gmail.com'], owned)).toBeNull();
  });

  it('is null when the field is absent', () => {
    expect(preferredRecipient(undefined, owned)).toBeNull();
    expect(preferredRecipient([], owned)).toBeNull();
  });
});

describe('routeInboundRecipients', () => {
  const owned = ['payitforwardhealth.com', 'mail.payitforwardhealth.com'];

  it('puts the original apex recipient first when a forward lands on mail.', () => {
    expect(
      routeInboundRecipients(
        ['wendy@mail.payitforwardhealth.com'],
        ['wendy@payitforwardhealth.com'],
        owned,
      ),
    ).toEqual(['wendy@payitforwardhealth.com', 'wendy@mail.payitforwardhealth.com']);
  });

  it('leaves envelope To unchanged when received_for is missing', () => {
    expect(
      routeInboundRecipients(['wendy@mail.payitforwardhealth.com'], undefined, owned),
    ).toEqual(['wendy@mail.payitforwardhealth.com']);
  });
});

describe('fetchReceivedEmail', () => {
  const noSleep = () => Promise.resolve();

  it('returns parsed content on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: 'hello' }));
    const result = await fetchReceivedEmail('abc', 'key', { fetchImpl, sleep: noSleep });
    expect(result).toEqual({ text: 'hello' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('calls the received-emails endpoint with bearer auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: 'hi' }));
    await fetchReceivedEmail('id-1', 'secret', { fetchImpl, sleep: noSleep });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails/receiving/id-1');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer secret' });
  });

  it('retries a 404 because the webhook can beat body availability', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ text: 'late' }));
    const result = await fetchReceivedEmail('abc', 'key', { fetchImpl, sleep: noSleep });
    expect(result).toEqual({ text: 'late' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry an auth failure that will never fix itself', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    expect(await fetchReceivedEmail('abc', 'key', { fetchImpl, sleep: noSleep })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null instead of throwing when the network fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    expect(await fetchReceivedEmail('abc', 'key', { fetchImpl, sleep: noSleep })).toBeNull();
  });

  it('short-circuits without an id or api key so no pointless call is made', async () => {
    const fetchImpl = vi.fn();
    expect(await fetchReceivedEmail('', 'key', { fetchImpl })).toBeNull();
    expect(await fetchReceivedEmail('abc', '', { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives up after the bounded attempt budget', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    expect(
      await fetchReceivedEmail('abc', 'key', { fetchImpl, sleep: noSleep, attempts: 3 }),
    ).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
