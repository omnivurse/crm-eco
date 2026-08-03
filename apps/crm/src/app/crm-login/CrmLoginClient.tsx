'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import {
  AuthSplitLayout,
  AuthHeroPanel,
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
      toolbar={<ThemeToggle variant="icon" className="auth-theme-btn !h-9 !w-9" />}
      hero={
        <AuthHeroPanel
          variant="crm"
          headline={
            <>
              <span className="block">Your book,</span>
              <span className="block bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-300 dark:to-emerald-300 bg-clip-text text-transparent">
                one workspace
              </span>
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
          <h2 className={authForm.title}>Welcome back</h2>
          <p className={authForm.subtitle}>{formSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className={authForm.error}>{error}</div>}

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
                  className={`${authForm.input} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--auth-muted)] hover:text-[var(--auth-text)] z-10"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                rememberMe ? authForm.checkboxOn : authForm.checkboxOff
              }`}
            >
              {rememberMe && <Square className="w-2.5 h-2.5 text-white fill-current" />}
            </button>
            <label onClick={() => setRememberMe(!rememberMe)} className={authForm.checkboxLabel}>
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

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
              <Lock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">256-bit Encryption</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs text-[var(--auth-muted)] flex-wrap">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              MFA Protected
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--auth-hairline)]" />
            <span className="flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              PHI Secure
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--auth-hairline)]" />
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Audit Logging
            </span>
          </div>

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
