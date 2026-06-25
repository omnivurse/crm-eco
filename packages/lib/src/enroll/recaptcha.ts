/**
 * Verify a reCAPTCHA v3 token against Google's verification endpoint.
 *
 * Returns the score (0..1) and success flag. If RECAPTCHA_SECRET is not
 * configured, returns success=true with score=null so the wizard remains
 * usable in non-production environments.
 */
export interface RecaptchaResult {
  success: boolean;
  score: number | null;
  action?: string;
  errorCodes?: string[];
}

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;

export async function verifyRecaptchaToken(
  token: string | null | undefined,
  expectedAction: string,
): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET;

  // No secret configured → bypass (allowed in dev / staging)
  if (!secret) {
    console.warn('[reCAPTCHA] RECAPTCHA_SECRET not configured — bypassing verification');
    return { success: true, score: null };
  }

  if (!token) {
    return { success: false, score: null, errorCodes: ['missing-input-response'] };
  }

  const params = new URLSearchParams({ secret, response: token });

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    const score: number | null = typeof data.score === 'number' ? data.score : null;
    const success: boolean = !!data.success
      && (data.action ? data.action === expectedAction : true)
      && (score === null ? true : score >= MIN_SCORE);

    return {
      success,
      score,
      action: data.action,
      errorCodes: data['error-codes'],
    };
  } catch (err) {
    console.error('[reCAPTCHA] Verification error:', err);
    return { success: false, score: null, errorCodes: ['verification-failed'] };
  }
}
