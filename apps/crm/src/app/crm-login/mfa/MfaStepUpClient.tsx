'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import { MFAChallenge } from '@/components/auth';

export interface MfaStepUpClientProps {
  /** Already constrained to an in-app CRM path by the server component. */
  redirectTo: string;
}

/**
 * Step-up screen for a session that authenticated with a password but has not
 * yet satisfied its enrolled TOTP factor (AAL1 → AAL2).
 */
export function MfaStepUpClient({ redirectTo }: MfaStepUpClientProps) {
  const { user } = useClientAuth();

  const handleSuccess = useCallback(() => {
    // Full navigation rather than a client-side push: the access token has been
    // upgraded to AAL2 and middleware must re-evaluate it before rendering.
    window.location.href = redirectTo;
  }, [redirectTo]);

  const handleCancel = useCallback(() => {
    // Abandoning step-up must not leave a half-assured session behind.
    void supabase.auth.signOut().finally(() => {
      window.location.href = '/crm-login';
    });
  }, []);

  return (
    <MFAChallenge
      email={user?.email ?? undefined}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
