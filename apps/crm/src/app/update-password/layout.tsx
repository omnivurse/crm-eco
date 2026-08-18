import { AuthSplitLayout, AuthHeroPanel, authForm } from '@crm-eco/ui';
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';

/**
 * Shell for /update-password. VISUAL ONLY — the page inside it owns the
 * PASSWORD_RECOVERY session handshake and the `updateUser` call, and the
 * password-rule copy lives in the shared form. Neither is touched here.
 */
export default function CrmUpdatePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      variant="crm"
      brandLabel="CRM Core"
      toolbar={<ThemeToggle variant="icon" className="auth-theme-btn !h-9 !w-9" />}
      hero={
        <AuthHeroPanel
          variant="crm"
          badge="CRM Core"
          showQuotes={false}
          headline={
            <>
              <span className="block">Choose a</span>
              {/* Same defect as /reset-password: a 300-weight gradient with no
                  light-theme counterpart, on a white panel. */}
              <span className={`block ${authForm.titleAccent}`}>new password</span>
            </>
          }
          subtitle="Set a strong password to protect your CRM workspace."
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
