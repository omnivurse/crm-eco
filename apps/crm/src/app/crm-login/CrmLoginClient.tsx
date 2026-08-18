'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import {
  AuthSplitLayout,
  AuthHeroPanel,
  AuthFormError,
  TenantBrandLogo,
  authForm,
} from '@crm-eco/ui';
import {
  Shield,
  Activity,
  Stethoscope,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Square,
} from 'lucide-react';
import type { LoginBrandingContext } from '@/lib/login-branding-types';
import { ACTIVE_ORG_COOKIE } from '@/lib/login-branding-types';
import { resolveBrandDisplay } from '@crm-eco/ui/lib/branding';
import { MFAChallenge } from '@/components/auth';
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';
import styles from '@/styles/crm-auth.module.css';

export interface CrmLoginClientProps {
  brandingContext: LoginBrandingContext | null;
  redirectTo: string;
  initialError?: string | null;
  /**
   * Mirrors the server-side CRM_ENFORCE_MFA flag. While false the login form
   * behaves exactly as before, so enabling MFA enforcement is a single
   * atomic switch across both the UI challenge and the middleware gate.
   */
  enforceMfa?: boolean;
}

function persistActiveOrgCookie(organizationId: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${ACTIVE_ORG_COOKIE}=${encodeURIComponent(organizationId)}; path=/; max-age=${maxAge}; samesite=lax`;
}

/**
 * VISUAL REDESIGN ONLY.
 *
 * Unchanged, deliberately and in full: `signInWithPassword`, the `profiles`
 * select with its `.not('crm_role','is',null)` filter, the `signOut` on a
 * missing profile, `persistActiveOrgCookie`, `logAuthEvent` and every action
 * name it posts, the AAL1/AAL2 assurance check behind `enforceMfa`, the
 * `MFAChallenge` hand-off and its cancel-then-signOut, the
 * `window.location.href = redirectTo` navigation, every error string, the
 * field ids, `required`, both `autoComplete` values, and all trust/assurance
 * copy (it is a compliance claim, not decoration).
 *
 * The diff is: tokens instead of Tailwind colour literals, `AuthFormError`
 * so a failed sign-in is announced, 44px hit areas on the two controls that
 * were ~20px, and a mobile identity (the shell's AuthBrandBar, fed the
 * tenant name) where the brand side used to simply vanish below 1024px.
 */
export function CrmLoginClient({
  brandingContext,
  redirectTo,
  initialError = null,
  enforceMfa = false,
}: CrmLoginClientProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  const { companyName } = resolveBrandDisplay(
    brandingContext?.branding,
    brandingContext?.orgName,
  );
  const tenantLabel = companyName ?? brandingContext?.orgName ?? null;

  const logAuthEvent = async (action: string, details?: Record<string, unknown>) => {
    try {
      await fetch('/api/auth/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email, details }),
      });
    } catch (err) {
      console.error('Failed to log auth event:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        await logAuthEvent('login_failed', { reason: authError.message });
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        await logAuthEvent('login_failed', { reason: 'No user returned' });
        setError('Authentication failed');
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, crm_role, organization_id')
        .eq('user_id', authData.user.id)
        .not('crm_role', 'is', null)
        .single();

      if (profileError || !profile) {
        await logAuthEvent('login_failed', {
          reason: 'No CRM access',
          profileError: profileError?.message,
        });
        await supabase.auth.signOut();
        setError('You do not have access to the CRM. Please contact your administrator.');
        setLoading(false);
        return;
      }

      if (profile.organization_id) {
        persistActiveOrgCookie(profile.organization_id);
      }

      await logAuthEvent('login_success', { role: profile.crm_role });

      // A password alone leaves the session at AAL1. If this user has enrolled
      // a TOTP factor, Supabase reports nextLevel === 'aal2' and the session is
      // not fully assured until the code is verified — so challenge here rather
      // than dropping them into the CRM. Middleware enforces the same rule on
      // every request, so skipping this screen cannot bypass the factor.
      if (enforceMfa) {
        const { data: assurance } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
          setMfaRequired(true);
          setLoading(false);
          return;
        }
      }

      window.location.href = redirectTo;
    } catch {
      await logAuthEvent('login_failed', { reason: 'Unexpected error' });
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleMfaCancel = async () => {
    // Backing out of the challenge must not leave a half-assured session behind.
    await supabase.auth.signOut();
    setMfaRequired(false);
    setPassword('');
    setLoading(false);
  };

  if (mfaRequired) {
    return (
      <MFAChallenge
        email={email}
        onSuccess={() => {
          window.location.href = redirectTo;
        }}
        onCancel={() => {
          void handleMfaCancel();
        }}
      />
    );
  }

  const heroSubtitle = tenantLabel
    ? `Pipelines and workqueues for ${tenantLabel} — purpose-built for benefits.`
    : 'Pipelines, modules, and automations purpose-built for benefits advisors.';

  const formSubtitle = tenantLabel
    ? `Sign in to the ${tenantLabel} CRM workspace`
    : 'Sign in to your pipeline, modules, and workqueue.';

  return (
    <AuthSplitLayout
      variant="crm"
      // Below lg the shell now renders AuthBrandBar instead of nothing. The
      // masthead carries the org when we know it and the platform otherwise;
      // the product wordline is the form's own eyebrow, just beneath it.
      brandLabel={tenantLabel ?? 'Double Helix'}
      toolbar={<ThemeToggle variant="icon" className="auth-theme-btn !h-9 !w-9" />}
      hero={
        <AuthHeroPanel
          variant="crm"
          headline={
            <>
              <span className="block">Your book,</span>
              {/* `.auth-title-accent` instead of `from-cyan-600 to-emerald-600
                  dark:from-cyan-300 …`: the console remaps Tailwind's cyan
                  scale onto Muted Spruce, so those literals could never paint
                  the brand cyan the landings use. */}
              <span className={`block ${authForm.titleAccent}`}>one workspace</span>
            </>
          }
          subtitle={heroSubtitle}
          badge={tenantLabel ? `${tenantLabel} · CRM Core` : 'CRM Core'}
        />
      }
    >
      <div className="space-y-8">
        <div className="text-center lg:text-left">
          <Link href="/" className="inline-flex items-center mb-6">
            <TenantBrandLogo
              variant="full"
              size="lg"
              tone="auto"
              priority
              branding={brandingContext?.branding}
              orgName={brandingContext?.orgName}
            />
          </Link>
          <p className={authForm.eyebrow}>CRM Core</p>
          <h2 className={authForm.title}>Welcome back</h2>
          <p className={authForm.subtitle}>{formSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Was a bare <div>: a screen reader never announced a failed
              sign-in, including the server-rendered `initialError`. */}
          {error && <AuthFormError>{error}</AuthFormError>}

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className={authForm.label}>
                Email Address
              </label>
              <div className="relative group">
                <div className={authForm.inputGlow} />
                <Mail className={authForm.inputIcon} />
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={authForm.input}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className={authForm.label}>
                  Password
                </label>
                <Link href="/reset-password" className={authForm.link}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <div className={authForm.inputGlow} />
                <Lock className={authForm.inputIcon} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`${authForm.input} pr-14`}
                />
                {/* Same handler; it was an unlabelled ~20px icon target. */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={authForm.fieldAffix}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* The 20px box keeps its size; `.checkboxHit::before` extends the
              pointer target to 44px. `htmlFor` names the control and lets the
              browser forward the label click, which is why the label's own
              onClick had to go — with both, it toggled twice. */}
          <div className={styles.checkboxRow}>
            <button
              type="button"
              id="remember-me"
              role="checkbox"
              aria-checked={rememberMe}
              aria-labelledby="remember-me-label"
              onClick={() => setRememberMe(!rememberMe)}
              className={`${styles.checkboxHit} ${
                rememberMe ? authForm.checkboxOn : authForm.checkboxOff
              }`}
            >
              {rememberMe && <Square className={`${styles.checkboxMark} fill-current`} />}
            </button>
            <label id="remember-me-label" htmlFor="remember-me" className={authForm.checkboxLabel}>
              Remember me for 30 days
            </label>
          </div>

          <button type="submit" className={authForm.submitBtn} disabled={loading}>
            <div className={authForm.submitShimmer} />
            {loading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                Sign in
                <span className="ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
              </span>
            )}
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className={authForm.dividerLine} />
            </div>
            <div className="relative flex justify-center">
              <span className={authForm.dividerText}>Need CRM Access?</span>
            </div>
          </div>

          <button
            type="button"
            className={authForm.secondaryBtn}
            onClick={() => {
              window.location.href = 'mailto:support@payitforwardhealth.com';
            }}
          >
            Contact Administrator
          </button>
        </form>

        {/* Compliance copy is untouched. What changed is the paint: these were
            `bg-emerald-500/10 … text-cyan-700 dark:text-cyan-300` literals, all
            of which resolve through the console's remapped scales. They now
            carry the two strand pigments from the tokens — cyan leads because
            this is CRM Core, emerald answers. */}
        <div className="mt-8 space-y-4">
          <div className={styles.trustRow}>
            <span className={`${styles.trustChip} ${styles.trustChipCounter}`}>
              <Shield className={styles.trustChipIcon} aria-hidden="true" />
              HIPAA Compliant
            </span>
            <span className={styles.trustChip}>
              <Lock className={styles.trustChipIcon} aria-hidden="true" />
              256-bit Encryption
            </span>
          </div>

          <p className={styles.assuranceRow}>
            <span className={styles.assuranceItem}>
              <Activity className={styles.assuranceIcon} aria-hidden="true" />
              MFA Protected
            </span>
            <span className={styles.assuranceSep} aria-hidden="true" />
            <span className={styles.assuranceItem}>
              <Stethoscope className={styles.assuranceIcon} aria-hidden="true" />
              PHI Secure
            </span>
            <span className={styles.assuranceSep} aria-hidden="true" />
            <span className={styles.assuranceItem}>
              <Shield className={styles.assuranceIcon} aria-hidden="true" />
              Audit Logging
            </span>
          </p>

          <p className={authForm.footer}>
            © 2026 {tenantLabel ?? 'Double Helix Hub'}. All rights reserved.
            {' · '}
            <Link href="/legal/sms-privacy" className={authForm.link}>
              SMS Privacy
            </Link>
          </p>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
