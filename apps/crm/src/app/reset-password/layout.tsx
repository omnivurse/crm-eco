import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';

export default function CrmResetPasswordLayout({
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
              <span className="block">Empowering</span>
              <span className="block bg-gradient-to-r from-[#67e8f9] to-[#a5f3fc] bg-clip-text text-transparent">
                Healthier Lives
              </span>
            </>
          }
          subtitle="Building stronger communities through shared health and compassionate care."
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
