import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';

export default function CrmResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      variant="crm"
      hero={
        <AuthHeroPanel
          variant="crm"
          badge="CRM Core"
          showQuotes={false}
          headline={
            <>
              <span className="block">Reset access</span>
              <span className="block bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                securely
              </span>
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
