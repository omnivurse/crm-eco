import Link from 'next/link';
import { getAcceptJsConfig, isAcceptJsConfigured } from '@/lib/billing/accept-config';
import { AddPaymentMethodForm } from '@/components/billing/AddPaymentMethodForm';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default function AddPaymentMethodPage() {
  const config = getAcceptJsConfig();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <PageHeader
        title="Add a payment method"
        description="Your card is tokenized by Authorize.Net — we never see or store your full card number."
        backHref="/billing"
        backLabel="Back to Billing"
      />

      {config ? (
        <AddPaymentMethodForm config={config} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment setup unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              Accept.js is not configured for this environment. An administrator needs to set{' '}
              <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_AUTHORIZE_NET_API_LOGIN_ID</code>{' '}
              and{' '}
              <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_AUTHORIZE_NET_CLIENT_KEY</code>.
            </p>
            {!isAcceptJsConfigured() && (
              <Link
                href="/support?topic=billing"
                className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Contact support
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
