import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';

export default function AdvisorUpdatePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      hero={
        <AuthHeroPanel
          headline={
            <>
              <span className="block">Grow your practice with</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                Double Helix Hub
              </span>
            </>
          }
          subtitle="Enroll members, track commissions, and manage your book of business from one advisor portal."
          badge="Advisor Portal"
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
