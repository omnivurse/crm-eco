/**
 * Server-side MFA step-up evaluation.
 *
 * Supabase issues a session at AAL1 after a password sign-in even when the user
 * has a verified TOTP factor; reaching AAL2 requires an explicit
 * challenge/verify. Enforcing that only in the login UI is not enforcement at
 * all — a client can navigate straight past it. These helpers let middleware
 * make the same decision server-side on every request.
 *
 * Everything here is pure so the decision can be unit-tested without a browser,
 * a database, or a live Supabase session.
 */

/** Where an AAL1 session with a verified factor is sent to step up. */
export const MFA_STEP_UP_PATH = '/crm-login/mfa';

export type AssuranceLevel = 'aal1' | 'aal2';

/**
 * Enforcement is opt-in via env so the behaviour can be switched on
 * deliberately (and switched off instantly) without a code deploy.
 *
 * When enabled, only users who already hold a *verified* TOTP factor are
 * affected — users without MFA enrolled keep signing in exactly as before.
 */
export function isMfaEnforcementEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CRM_ENFORCE_MFA === 'true';
}

export interface MfaFactorLike {
  factor_type?: string | null;
  status?: string | null;
}

/**
 * True when the user has finished enrolling at least one TOTP factor.
 * Unverified factors are ignored: a half-finished enrollment must never be able
 * to lock someone out of their own account.
 */
export function hasVerifiedTotpFactor(
  factors: readonly MfaFactorLike[] | null | undefined,
): boolean {
  if (!factors || factors.length === 0) return false;
  return factors.some(
    (factor) => factor?.factor_type === 'totp' && factor?.status === 'verified',
  );
}

function base64UrlDecode(segment: string): string | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    return atob(padded);
  } catch {
    return null;
  }
}

/**
 * Read the `aal` claim out of a Supabase access token.
 *
 * The token is NOT verified here — callers must already have authenticated the
 * request (e.g. via `supabase.auth.getUser()`, which validates against the auth
 * server). This only reads a claim out of that already-verified token, so a
 * forged token can never reach this function with a trusted identity attached.
 */
export function readAalFromAccessToken(
  accessToken: string | null | undefined,
): AssuranceLevel | null {
  if (!accessToken) return null;

  const parts = accessToken.split('.');
  if (parts.length < 2) return null;

  const payloadJson = base64UrlDecode(parts[1]!);
  if (!payloadJson) return null;

  try {
    const payload = JSON.parse(payloadJson) as { aal?: unknown };
    return payload.aal === 'aal2' ? 'aal2' : payload.aal === 'aal1' ? 'aal1' : null;
  } catch {
    return null;
  }
}

export interface MfaStepUpInput {
  /** Result of `isMfaEnforcementEnabled()`. */
  enforced: boolean;
  /** Result of `hasVerifiedTotpFactor(user.factors)`. */
  hasVerifiedFactor: boolean;
  /** Result of `readAalFromAccessToken(session.access_token)`. */
  aal: AssuranceLevel | null;
}

/**
 * Decide whether this request must be diverted to the MFA step-up screen.
 *
 * Deliberately conservative: when the assurance level cannot be read at all we
 * do NOT force step-up, because a claim-parsing regression should degrade to
 * current behaviour rather than lock every MFA user out of the product.
 */
export function isMfaStepUpRequired({
  enforced,
  hasVerifiedFactor,
  aal,
}: MfaStepUpInput): boolean {
  if (!enforced) return false;
  if (!hasVerifiedFactor) return false;
  if (aal === null) return false;
  return aal !== 'aal2';
}
