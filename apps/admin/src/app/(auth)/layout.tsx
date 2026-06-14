import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';

export default function AuthLayout({
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
              <span className="block">Community</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                Health Platform
              </span>
            </>
          }
          subtitle="Administration and management console for Double Helix Hub."
          badge="Admin Portal"
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
