import Link from 'next/link';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { PageHeader } from '@/components/PageHeader';
import { RateBook } from '@/components/pricing/RateBook';

export default async function RateBookPage() {
  const ctx = await requireActiveMembership();
  const memberName = [ctx.member.first_name, ctx.member.last_name].filter(Boolean).join(' ').trim();
  const postalCode = ctx.member.postal_code || '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your tape"
        description="Clipped hospital cash, compiled from the ticks you saved. A book is a snapshot, not a live file."
        kicker="Pricing"
        backHref="/pricing"
        backLabel="Back to search"
        actions={
          <Link
            href="/pricing"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--mp-teal)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--mp-teal-soft)]"
          >
            Search rates
          </Link>
        }
      />
      <RateBook memberName={memberName} postalCode={postalCode} />
    </div>
  );
}
