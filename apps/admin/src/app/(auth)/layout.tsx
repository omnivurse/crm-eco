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
              <span className="block">Member</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                Management System
              </span>
            </>
          }
          subtitle="Member Management System for health sharing organizations."
          badge="MMS"
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
