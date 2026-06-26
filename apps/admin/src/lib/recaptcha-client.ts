'use client';

/**
 * Client-side reCAPTCHA v3 token generation for the public (anon) enrollment
 * submit. Mirrors the verify side in @crm-eco/lib/enroll (verifyRecaptchaToken):
 * when NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not configured we resolve to `null`
 * (no token) so the wizard stays usable in dev/staging — the server then sees
 * RECAPTCHA_SECRET unset and bypasses verification. In production both keys are
 * set and a real v3 token is produced for the 'enrollment_submit' action.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const SCRIPT_ID = 'recaptcha-v3-script';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Lazily inject the reCAPTCHA v3 script exactly once and resolve when ready. */
function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('recaptcha_script_error')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('recaptcha_script_error'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Produce a reCAPTCHA v3 token for the given action. Returns `null` when no site
 * key is configured (dev bypass) or when the script/grecaptcha is unavailable —
 * the caller still submits, and the server-side verify decides (it bypasses when
 * RECAPTCHA_SECRET is unset, and rejects a missing token when it is set).
 */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await loadRecaptchaScript(SITE_KEY);
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) return null;
    await new Promise<void>((resolve) => grecaptcha.ready(() => resolve()));
    return await grecaptcha.execute(SITE_KEY, { action });
  } catch {
    return null;
  }
}
