import type { Metadata } from 'next';
import { SmsPrivacyPolicy } from '@crm-eco/ui/components/sms-privacy-policy';
import { PageSection } from '@/components/page-section';

export const metadata: Metadata = {
  title: 'SMS Privacy Policy | Double Helix Software',
  description:
    'How Double Helix Software and tenant brands collect, use, and protect information related to text message campaigns.',
};

export default function SmsPrivacyPage() {
  return (
    <PageSection
      eyebrow="Legal"
      title="SMS Privacy Policy"
      lede="This policy explains how we handle personal information for text message campaigns, including how to opt out."
    >
      <div className="dh-bezel max-w-3xl">
        <div className="dh-bezel-inner p-7 text-muted-foreground sm:p-8">
          <SmsPrivacyPolicy
            brand={{
              companyName: 'Double Helix Software',
              contactEmail: 'privacy@doublehelixhub.com',
              supportEmail: 'support@doublehelixhub.com',
            }}
            className="text-foreground/90 [&_a]:text-cyan-600 dark:[&_a]:text-cyan-400"
          />
        </div>
      </div>
    </PageSection>
  );
}
