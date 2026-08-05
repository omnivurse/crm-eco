/**
 * SMS / text-message campaign privacy policy (long form).
 * Source: Long+Version+Text.docx + HubSpot publish link.
 */

export const SMS_PRIVACY_POLICY_HUBS_URL = 'https://hubs.ly/Q04r5Ql30';

export const SMS_PRIVACY_POLICY_PATH = '/legal/sms-privacy';

export const SMS_PRIVACY_POLICY_TITLE = 'SMS Privacy Policy';

export const SMS_PRIVACY_POLICY_UPDATED = 'August 5, 2026';

export interface SmsPrivacyPolicyBrand {
  companyName: string;
  contactEmail: string;
  contactPhoneDisplay?: string;
  contactPhoneTel?: string;
  supportEmail?: string;
}

export interface SmsPrivacySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  afterBullets?: string[];
}

export function buildSmsPrivacySections(brand: SmsPrivacyPolicyBrand): SmsPrivacySection[] {
  const support = brand.supportEmail ?? brand.contactEmail;
  const phoneLine = brand.contactPhoneDisplay
    ? ` or call ${brand.contactPhoneDisplay}`
    : '';

  return [
    {
      id: 'introduction',
      title: '1. Introduction',
      paragraphs: [
        `${brand.companyName} ("we," "us," or "our") is committed to respecting your privacy. This Privacy Policy outlines how we collect, use, and protect your personal information in relation to our text message campaigns. By participating in our text message campaigns, you agree to the terms outlined in this Privacy Policy.`,
      ],
    },
    {
      id: 'information-we-collect',
      title: '2. Information We Collect',
      paragraphs: [
        'When you sign up for our text message campaigns, we may collect certain personal information from you, including:',
      ],
      bullets: [
        'Your phone number',
        'Your name (if provided)',
        'Any responses you provide to our messages',
      ],
    },
    {
      id: 'how-we-use',
      title: '3. How We Use Your Information',
      paragraphs: ['We use the information we collect to:'],
      bullets: [
        'Send you updates, promotions, and other relevant information',
        'Respond to your inquiries or requests',
        'Improve our marketing and customer service efforts',
      ],
    },
    {
      id: 'sharing',
      title: '4. Sharing Your Information',
      paragraphs: [
        'Mobile information will not be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.',
      ],
    },
    {
      id: 'security',
      title: '5. Data Security',
      paragraphs: [
        'We take reasonable steps to ensure the security of your personal information. However, please note that no method of transmission over the internet, or method of electronic storage, is 100% secure.',
      ],
    },
    {
      id: 'rights',
      title: '6. Your Privacy Rights and Choices',
      paragraphs: [
        'You have the right to opt out of receiving text messages from us at any time. To stop receiving text messages, you can:',
      ],
      bullets: [
        'Reply with the word "STOP" to any text message you receive from us.',
        `Contact our customer service team at ${support}${phoneLine} for assistance.`,
      ],
      afterBullets: [
        'Once we receive your opt-out request, we will process it promptly, and you will no longer receive messages from us unless you choose to opt-in again in the future.',
      ],
    },
    {
      id: 'updates',
      title: '7. Updates to This Privacy Policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any significant changes by sending a notice to the primary phone number you provided or by posting a notice on our website.',
      ],
    },
    {
      id: 'contact',
      title: '8. Contact Us',
      paragraphs: [
        'If you have questions or concerns regarding this Privacy Policy or our text message campaigns, please contact us at:',
        brand.companyName,
        brand.contactEmail,
        ...(brand.contactPhoneDisplay ? [brand.contactPhoneDisplay] : []),
        'By participating in our text message campaigns, you acknowledge that you have read and understood this Privacy Policy.',
      ],
    },
  ];
}
