'use client';

import { createClient } from '@crm-eco/lib/supabase/client';
import { AuthResetPasswordForm } from '@crm-eco/ui';

export default function AdvisorResetPasswordPage() {
  const supabase = createClient();

  return (
    <AuthResetPasswordForm
      backHref="/login"
      onResetPassword={async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        return { error: error as Error | null };
      }}
    />
  );
}
