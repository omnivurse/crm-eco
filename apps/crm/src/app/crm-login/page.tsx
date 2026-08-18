import { Suspense } from 'react';
import { brandingToCssVariables } from '@crm-eco/ui/lib/branding';
import { getLoginBrandingContext } from '@/lib/login-tenant';
import { safeCrmRedirect } from '@/lib/login-branding-types';
import { isMfaEnforcementEnabled } from '@/lib/security/mfa';
import { CrmLoginClient } from './CrmLoginClient';
import styles from '@/styles/crm-auth.module.css';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  profile_fetch_failed: 'Your session could not be verified. Please sign in again.',
  no_crm_access: 'You do not have access to the CRM. Please contact your administrator.',
  no_organization: 'Your account is not linked to an organization.',
  session_expired: 'Your session expired. Please sign in again.',
};

interface CrmLoginPageProps {
  searchParams: Promise<{
    org?: string;
    redirect?: string;
    error?: string;
  }>;
}

async function CrmLoginContent({ searchParams }: CrmLoginPageProps) {
  const params = await searchParams;
  const brandingContext = await getLoginBrandingContext(params.org);
  const redirectTo = safeCrmRedirect(params.redirect);
  const initialError = params.error ? ERROR_MESSAGES[params.error] ?? null : null;
  const cssVars = brandingToCssVariables(brandingContext?.branding);

  return (
    // The tenant's brand tokens (--primary / --secondary / --accent and the
    // contrast-safe --*-foreground each of them gets from
    // hexToContrastForegroundTriple) are still injected here, unchanged, and
    // still inherit to everything below — including the MFA challenge's
    // <Button>, which is the one control on this flow that paints with them.
    //
    // `.brandScope` is `display: contents`: the div is now purely the element
    // those custom properties inherit from and contributes no box, so it can
    // no longer re-impose the `min-h-screen` (100vh) the shell just replaced
    // with 100dvh. Inheritance is unaffected by `display: contents`.
    <div
      className={styles.brandScope}
      style={Object.keys(cssVars).length > 0 ? (cssVars as React.CSSProperties) : undefined}
    >
      <CrmLoginClient
        brandingContext={brandingContext}
        redirectTo={redirectTo}
        initialError={initialError}
        // Read server-side so the login challenge and the middleware gate are
        // driven by the same single flag — no NEXT_PUBLIC_* duplicate to drift.
        enforceMfa={isMfaEnforcementEnabled()}
      />
    </div>
  );
}

function CrmLoginFallback() {
  // Was `bg-slate-950 text-slate-400`: a hard-coded dark card that flashed
  // black over the light theme before the real page resolved.
  return <div className={styles.fallback}>Loading sign-in…</div>;
}

export default function CrmLoginPage(props: CrmLoginPageProps) {
  return (
    <Suspense fallback={<CrmLoginFallback />}>
      <CrmLoginContent {...props} />
    </Suspense>
  );
}
