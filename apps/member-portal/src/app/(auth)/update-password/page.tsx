'use client';

import { createClient } from '@crm-eco/lib/supabase/client';
import { AuthUpdatePasswordForm } from '@crm-eco/ui';

export default function UpdatePasswordPage() {
  const supabase = createClient();

  return (
    <AuthUpdatePasswordForm
      backHref="/signin"
      onSessionReady={async () => {
        return new Promise((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
              subscription.unsubscribe();
              resolve(true);
            }
          });

          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              subscription.unsubscribe();
              resolve(true);
            }
          });
        });
      }}
      onUpdatePassword={async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error as Error | null };
      }}
    />
  );
}
