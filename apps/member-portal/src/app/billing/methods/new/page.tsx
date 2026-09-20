import Link from 'next/link';
import { getAcceptJsConfig, isAcceptJsConfigured } from '@/lib/billing/accept-config';
import { getNmiPublicConfig, isNmiIntendedProvider } from '@/lib/billing/nmi-config';
import { AddPaymentMethodForm } from '@/components/billing/AddPaymentMethodForm';
import { NmiAddPaymentMethodForm } from '@/components/billing/NmiAddPaymentMethodForm';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default function AddPaymentMethodPage() {
  const nmiConfig = getNmiPublicConfig();
  const acceptConfig = getAcceptJsConfig();
  const nmiRequired = isNmiIntendedProvider();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <PageHeader
        title="Add a payment method"
        description={
          nmiConfig || nmiRequired
            ? 'Your card is tokenized by NMI — we never see or store your full card number.'
            : 'Your card is tokenized by Authorize.Net — we never see or store your full card number.'
        }
        backHref="/billing"
        backLabel="Back to Billing"
      />

      {nmiConfig ? (
        <NmiAddPaymentMethodForm config={nmiConfig} />
      ) : nmiRequired ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment setup unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              NMI is the configured payment provider, but the public tokenization key is missing.
              An administrator needs to set{' '}
              <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_NMI_TOKENIZATION_KEY</code>.
            </p>
            <Link
              href="/support?topic=billing"
              className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Contact support
            </Link>
          </CardContent>
        </Card>
      ) : acceptConfig ? (
        <AddPaymentMethodForm config={acceptConfig} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment setup unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              Card capture is not configured for this environment. An administrator needs to set{' '}
              <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_NMI_TOKENIZATION_KEY</code>
              {isAcceptJsConfigured() ? null : (
                <>
                  {' '}
                  or Authorize.Net Accept.js keys.
                </>
              )}
            </p>
            <Link
              href="/support?topic=billing"
              className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Contact support
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
