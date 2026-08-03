import type { Metadata } from 'next';
import Link from 'next/link';
import { SmsPrivacyPolicy } from '@crm-eco/ui/components/sms-privacy-policy';

export const metadata: Metadata = {
  title: 'SMS Privacy Policy | Advisor Portal',
  description:
    'How we collect, use, and protect information related to text message campaigns.',
};

export default function AdvisorSmsPrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <main className="mx-auto max-w-3xl">
        <Link href="/login" className="text-sm font-medium text-cyan-700 hover:underline">
          ← Back to sign in
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">SMS Privacy Policy</h1>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <SmsPrivacyPolicy
            brand={{
              companyName: 'Double Helix Software',
              contactEmail: 'privacy@doublehelixhub.com',
              supportEmail: 'support@doublehelixhub.com',
            }}
            className="[&_a]:text-cyan-700"
          />
        </div>
      </main>
    </div>
  );
}
