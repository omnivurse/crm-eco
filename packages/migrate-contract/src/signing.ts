import { createHmac, timingSafeEqual } from "node:crypto";

export const OLYRON_SIGNATURE_HEADER = "x-olyron-signature";
export const OLYRON_TIMESTAMP_HEADER = "x-olyron-timestamp";
export const OLYRON_NONCE_HEADER = "x-olyron-nonce";

export interface SignRequestOptions {
  secret: string;
  method: string;
  path: string;
  body: string;
  timestampMs?: number;
  nonce?: string;
}

/**
 * HMAC-SHA256 over `method\npath\ntimestamp\nnonce\nbody`
 */
export function signRequest(opts: SignRequestOptions): {
  signature: string;
  timestamp: string;
  nonce: string;
} {
  const timestamp = String(opts.timestampMs ?? Date.now());
  const nonce =
    opts.nonce ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now()}`);
  const payload = [opts.method.toUpperCase(), opts.path, timestamp, nonce, opts.body].join("\n");
  const signature = createHmac("sha256", opts.secret).update(payload).digest("hex");
  return { signature, timestamp, nonce };
}

export function verifyRequest(opts: {
  secret: string;
  method: string;
  path: string;
  body: string;
  signature: string;
  timestamp: string;
  nonce: string;
  /** Max skew in ms (default 5 min) */
  maxSkewMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  const maxSkew = opts.maxSkewMs ?? 5 * 60 * 1000;
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxSkew) {
    return { ok: false, reason: "timestamp_out_of_range" };
  }
  const expected = signRequest({
    secret: opts.secret,
    method: opts.method,
    path: opts.path,
    body: opts.body,
    timestampMs: ts,
    nonce: opts.nonce,
  });
  try {
    const a = Buffer.from(expected.signature, "hex");
    const b = Buffer.from(opts.signature, "hex");
    if (a.length === 0 || b.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_signature" };
    }
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}

export function signingHeaders(sig: ReturnType<typeof signRequest>): Record<string, string> {
  return {
    [OLYRON_SIGNATURE_HEADER]: sig.signature,
    [OLYRON_TIMESTAMP_HEADER]: sig.timestamp,
    [OLYRON_NONCE_HEADER]: sig.nonce,
  };
}
