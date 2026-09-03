import { describe, expect, it } from 'vitest';
import { authenticateEmailIntakeRequest } from '../../../../../supabase/functions/_shared/email-intake-auth';

const NOW_MS = Date.parse('2026-09-03T11:00:00.000Z');
const SVIX_TIMESTAMP = String(Math.floor(NOW_MS / 1000));
const WEBHOOK_SECRET = `whsec_${btoa('test-webhook-secret')}`;

async function signatureFor(body: string, id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('test-webhook-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${SVIX_TIMESTAMP}.${body}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;
}

async function signedRequest(body: string, id: string): Promise<Request> {
  return new Request('https://example.test/email-intake', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': SVIX_TIMESTAMP,
      'svix-signature': await signatureFor(body, id),
    },
    body,
  });
}

describe('authenticateEmailIntakeRequest', () => {
  it('returns the exact authenticated body for a trusted bearer caller', async () => {
    const body = '{"type":"internal"}';
    const request = new Request('https://example.test/email-intake', {
      method: 'POST',
      headers: { authorization: 'Bearer edge-secret' },
      body,
    });

    await expect(
      authenticateEmailIntakeRequest(request, { bearerSecret: 'edge-secret' }),
    ).resolves.toEqual({ authorized: true, rawBody: body });
  });

  it('keeps concurrently authenticated webhook bodies request-local', async () => {
    const firstBody = '{"data":{"email_id":"email-first"}}';
    const secondBody = '{"data":{"email_id":"email-second"}}';
    const [firstRequest, secondRequest] = await Promise.all([
      signedRequest(firstBody, 'msg-first'),
      signedRequest(secondBody, 'msg-second'),
    ]);

    const [first, second] = await Promise.all([
      authenticateEmailIntakeRequest(firstRequest, {
        webhookSecrets: [WEBHOOK_SECRET],
        now: () => NOW_MS,
      }),
      authenticateEmailIntakeRequest(secondRequest, {
        webhookSecrets: [WEBHOOK_SECRET],
        now: () => NOW_MS,
      }),
    ]);

    expect(first).toEqual({ authorized: true, rawBody: firstBody });
    expect(second).toEqual({ authorized: true, rawBody: secondBody });
  });

  it('rejects a body that does not match the supplied signature', async () => {
    const signed = await signedRequest('{"safe":true}', 'msg-tampered');
    const tampered = new Request(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: '{"safe":false}',
    });

    await expect(
      authenticateEmailIntakeRequest(tampered, {
        webhookSecrets: [WEBHOOK_SECRET],
        now: () => NOW_MS,
      }),
    ).resolves.toEqual({ authorized: false, rawBody: '{"safe":false}' });
  });

  it('rejects signed requests outside the replay window', async () => {
    const body = '{"type":"email.received"}';
    const request = await signedRequest(body, 'msg-stale');

    await expect(
      authenticateEmailIntakeRequest(request, {
        webhookSecrets: [WEBHOOK_SECRET],
        now: () => NOW_MS + 301_000,
      }),
    ).resolves.toEqual({ authorized: false, rawBody: body });
  });
});
