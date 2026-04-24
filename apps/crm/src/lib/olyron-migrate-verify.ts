import {
  OLYRON_NONCE_HEADER,
  OLYRON_SIGNATURE_HEADER,
  OLYRON_TIMESTAMP_HEADER,
  verifyRequest,
} from '@olyron/migrate-contract';

export function verifyOlyronMigrateRequest(request: Request, rawBody: string): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.OLYRON_MIGRATE_SIGNING_SECRET;
  if (!secret) return { ok: false, reason: 'missing_signing_secret' };

  const signature = request.headers.get(OLYRON_SIGNATURE_HEADER) ?? '';
  const timestamp = request.headers.get(OLYRON_TIMESTAMP_HEADER) ?? '';
  const nonce = request.headers.get(OLYRON_NONCE_HEADER) ?? '';
  const url = new URL(request.url);
  const path = url.pathname;

  return verifyRequest({
    secret,
    method: request.method,
    path,
    body: rawBody,
    signature,
    timestamp,
    nonce,
  });
}
