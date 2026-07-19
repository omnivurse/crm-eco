import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';

const CRM_QUOTES = [
  { text: 'Pipeline clarity beats pipeline volume.', author: 'Double Helix CRM' },
  { text: 'Every lead deserves a stage, an owner, and a next action.', author: 'Double Helix CRM' },
  { text: 'Benefits sales run on trust — and systems that remember the details.', author: 'Double Helix CRM' },
];

export default function AuthLayout({
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
          headline={
            <>
              <span className="block">Your book,</span>
              <span className="block bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                one workspace
              </span>
            </>
          }
          subtitle="Pipelines, modules, and automations purpose-built for Medicare, ACA, group, and healthshare advisors."
          quotes={CRM_QUOTES}
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
