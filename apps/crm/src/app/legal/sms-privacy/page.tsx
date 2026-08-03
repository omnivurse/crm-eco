import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@crm-eco/ui/components/brand-logo';
import { SmsPrivacyPolicy } from '@crm-eco/ui/components/sms-privacy-policy';

export const metadata: Metadata = {
  title: 'SMS Privacy Policy | Double Helix CRM',
  description:
    'How we collect, use, and protect information related to text message campaigns.',
};

export default function CrmSmsPrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--lp-void,#f7f8fa)] text-[var(--lp-fg,#0f172a)]">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <BrandLogo variant="full" size="sm" tone="auto" priority />
          </Link>
          <Link
            href="/crm-login"
            className="text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-400">
          Legal
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          SMS Privacy Policy
        </h1>
        <div className="mt-10 rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-black/40 sm:p-8">
          <SmsPrivacyPolicy
            brand={{
              companyName: 'Double Helix Software',
              contactEmail: 'privacy@doublehelixhub.com',
              supportEmail: 'support@doublehelixhub.com',
            }}
            className="[&_a]:text-cyan-700 dark:[&_a]:text-cyan-400"
          />
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/" className="underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
