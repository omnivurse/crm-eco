export interface EmailIntakeAuthOptions {
  /** Secret accepted by trusted server-to-server callers. */
  bearerSecret?: string | null;
  /** Svix signing secrets accepted for inbound webhook rotation. */
  webhookSecrets?: Array<string | null | undefined>;
  /** Injectable clock for deterministic replay-window tests. */
  now?: () => number;
  maxSignatureAgeSeconds?: number;
}

export interface EmailIntakeAuthResult {
  authorized: boolean;
  /** The exact bytes authenticated by Svix and later parsed by intake. */
  rawBody: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
  now: () => number,
  maxAgeSeconds: number,
): Promise<boolean> {
  const timestampSec = Number.parseInt(svixTimestamp, 10);
  if (!Number.isFinite(timestampSec)) return false;
  if (Math.abs(Math.floor(now() / 1000) - timestampSec) > maxAgeSeconds) return false;

  try {
    const secretBytes = Uint8Array.from(
      atob(secret.startsWith("whsec_") ? secret.slice(6) : secret),
      (character) => character.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedContent),
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    return svixSignature.split(" ").some((signature) => {
      const [version, value, ...rest] = signature.split(",");
      return rest.length === 0 && version === "v1" && constantTimeEqual(value || "", expected);
    });
  } catch {
    return false;
  }
}

/**
 * Authenticate an intake request and return its body as one request-local
 * value. The same bytes are used for Svix verification and JSON parsing, so
 * concurrent edge requests can never exchange bodies through module state.
 */
export async function authenticateEmailIntakeRequest(
  request: Request,
  options: EmailIntakeAuthOptions,
): Promise<EmailIntakeAuthResult> {
  const rawBody = await request.text();
  const bearerSecret = options.bearerSecret || "";
  const authorization = request.headers.get("Authorization") || "";

  if (bearerSecret && constantTimeEqual(authorization, `Bearer ${bearerSecret}`)) {
    return { authorized: true, rawBody };
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { authorized: false, rawBody };
  }

  const now = options.now ?? Date.now;
  const maxAgeSeconds = options.maxSignatureAgeSeconds ?? 300;
  for (const secret of options.webhookSecrets ?? []) {
    if (
      secret &&
      await verifySvixSignature(
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature,
        secret,
        now,
        maxAgeSeconds,
      )
    ) {
      return { authorized: true, rawBody };
    }
  }

  return { authorized: false, rawBody };
}
