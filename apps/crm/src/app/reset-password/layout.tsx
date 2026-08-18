import { AuthSplitLayout, AuthHeroPanel, authForm } from '@crm-eco/ui';
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';

/**
 * Shell for /reset-password. VISUAL ONLY — the page inside it owns the
 * Supabase `resetPasswordForEmail` call and its redirectTo; nothing here
 * touches either.
 */
export default function CrmResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      variant="crm"
      brandLabel="CRM Core"
      // The other two CRM auth surfaces already carried a theme toggle; these
      // two did not, so a user on the dark theme had no way back from a
      // reset link opened in a fresh browser.
      toolbar={<ThemeToggle variant="icon" className="auth-theme-btn !h-9 !w-9" />}
      hero={
        <AuthHeroPanel
          variant="crm"
          badge="CRM Core"
          showQuotes={false}
          headline={
            <>
              <span className="block">Reset access</span>
              {/* Was `from-cyan-300 to-emerald-300` with no `dark:` counterpart
                  — i.e. a pale 300-weight gradient painted on the WHITE light
                  panel, which was effectively unreadable there. */}
              <span className={`block ${authForm.titleAccent}`}>securely</span>
            </>
          }
          subtitle="We'll email a secure link so you can get back to your pipeline."
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
