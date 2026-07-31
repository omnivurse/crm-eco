import { Suspense } from 'react';
import { brandingToCssVariables } from '@crm-eco/ui/lib/branding';
import { getLoginBrandingContext } from '@/lib/login-tenant';
import { safeCrmRedirect } from '@/lib/login-branding-types';
import { isMfaEnforcementEnabled } from '@/lib/security/mfa';
import { CrmLoginClient } from './CrmLoginClient';

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
    <div
      className="min-h-screen"
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
      Loading sign-in…
    </div>
  );
}

export default function CrmLoginPage(props: CrmLoginPageProps) {
  return (
    <Suspense fallback={<CrmLoginFallback />}>
      <CrmLoginContent {...props} />
    </Suspense>
  );
}
