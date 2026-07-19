import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';

export default function CrmUpdatePasswordLayout({
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
              <span className="block">Choose a</span>
              <span className="block bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                new password
              </span>
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
