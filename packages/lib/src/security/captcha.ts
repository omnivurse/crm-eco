/**
 * Server-side bot-protection verifier shared by every public-facing form.
 *
 * Supports two providers:
 *   1. Cloudflare Turnstile (preferred — no privacy concerns, free, easy)
 *   2. Google reCAPTCHA v3   (legacy — kept for the enrollment wizard)
 *
 * Configuration is environment-driven:
 *   - TURNSTILE_SECRET            → enables Turnstile verification
 *   - RECAPTCHA_SECRET            → enables reCAPTCHA verification
 *   - CAPTCHA_MIN_SCORE (optional) → override the default reCAPTCHA threshold (0.5)
 *
 * If NEITHER secret is configured, verification is bypassed and the helper
 * returns `success: true` so local dev / preview deploys remain frictionless.
 * Production should always set at least one secret.
 */

export type CaptchaProvider = 'turnstile' | 'recaptcha';

export interface CaptchaResult {
  /** `true` if the token passed (or verification was bypassed in dev). */
  success: boolean;
  /** Provider that actually verified the token (null when bypassed). */
  provider: CaptchaProvider | null;
  /** reCAPTCHA score (0..1) — null for Turnstile or when bypassed. */
  score: number | null;
  /** Expected action name (reCAPTCHA only). */
  action?: string;
  /** Raw error codes returned by the provider, when failing. */
  errorCodes?: string[];
}

export interface VerifyCaptchaOptions {
  /** Token from the client (Turnstile or reCAPTCHA). */
  token: string | null | undefined;
  /** Expected reCAPTCHA action name (ignored for Turnstile). */
  expectedAction?: string;
  /** Caller IP — strongly recommended; both providers use it as a signal. */
  remoteIp?: string | null;
  /** Force a specific provider; default = autodetect from env. */
  provider?: CaptchaProvider;
}

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

/**
 * Verify a captcha token. Throws no errors — every failure path returns a
 * `CaptchaResult` so callers can branch on `.success` cleanly.
 */
export async function verifyCaptcha(
  opts: VerifyCaptchaOptions,
): Promise<CaptchaResult> {
  const turnstileSecret = process.env.TURNSTILE_SECRET;
  const recaptchaSecret = process.env.RECAPTCHA_SECRET;

  if (!turnstileSecret && !recaptchaSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[captcha] PRODUCTION misconfig: neither TURNSTILE_SECRET nor ' +
          'RECAPTCHA_SECRET is set. Public form requests are NOT being verified.',
      );
    } else {
      console.warn(
        '[captcha] No captcha secret configured — bypassing verification (dev mode).',
      );
    }
    return { success: true, provider: null, score: null };
  }

  const useProvider: CaptchaProvider =
    opts.provider ?? (turnstileSecret ? 'turnstile' : 'recaptcha');

  if (!opts.token) {
    return {
      success: false,
      provider: useProvider,
      score: null,
      errorCodes: ['missing-input-response'],
    };
  }

  if (useProvider === 'turnstile') {
    return verifyTurnstile(turnstileSecret!, opts.token, opts.remoteIp ?? null);
  }
  return verifyRecaptcha(
    recaptchaSecret!,
    opts.token,
    opts.expectedAction,
    opts.remoteIp ?? null,
  );
}

async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
): Promise<CaptchaResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = (await res.json()) as {
      success: boolean;
      'error-codes'?: string[];
    };
    return {
      success: !!data.success,
      provider: 'turnstile',
      score: null,
      errorCodes: data['error-codes'],
    };
  } catch (err) {
    console.error('[captcha] turnstile verification error:', err);
    return {
      success: false,
      provider: 'turnstile',
      score: null,
      errorCodes: ['verification-failed'],
    };
  }
}

async function verifyRecaptcha(
  secret: string,
  token: string,
  expectedAction: string | undefined,
  remoteIp: string | null,
): Promise<CaptchaResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  const minScore =
    Number(process.env.CAPTCHA_MIN_SCORE) || DEFAULT_RECAPTCHA_MIN_SCORE;

  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = (await res.json()) as {
      success: boolean;
      score?: number;
      action?: string;
      'error-codes'?: string[];
    };

    const score = typeof data.score === 'number' ? data.score : null;
    const actionOk = expectedAction
      ? data.action === expectedAction
      : true;
    const scoreOk = score === null ? true : score >= minScore;

    return {
      success: !!data.success && actionOk && scoreOk,
      provider: 'recaptcha',
      score,
      action: data.action,
      errorCodes: data['error-codes'],
    };
  } catch (err) {
    console.error('[captcha] recaptcha verification error:', err);
    return {
      success: false,
      provider: 'recaptcha',
      score: null,
      errorCodes: ['verification-failed'],
    };
  }
}

/**
 * Best-effort caller-IP extractor for Next.js route handlers.
 * Honors the typical Vercel / Cloudflare / Hostinger headers in priority order.
 */
export function getClientIp(req: { headers: Headers }): string | null {
  const h = req.headers;
  const candidates = [
    h.get('cf-connecting-ip'),
    h.get('x-real-ip'),
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  ];
  for (const c of candidates) {
    if (c && c.length > 0) return c;
  }
  return null;
}
