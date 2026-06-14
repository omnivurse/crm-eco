'use client';

import { createBrowserClient } from '@supabase/ssr';
import { AuthUpdatePasswordForm } from '@crm-eco/ui';

export default function AdminUpdatePasswordPage() {
  return (
    <AuthUpdatePasswordForm
      backHref="/login"
      onSessionReady={async () => {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

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
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error as Error | null };
      }}
    />
  );
}
