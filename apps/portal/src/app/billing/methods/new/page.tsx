import Link from 'next/link';
import { ChevronLeft, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';

/**
 * Add Payment Method — placeholder.
 *
 * The production-grade flow uses Authorize.Net Accept.js to tokenize card data
 * client-side before posting an opaque token to the server, which calls
 * BillingService.createPaymentProfile. Until Accept.js is wired, this page
 * directs members to support so we don't accept raw PAN through Next.js.
 */
export default function AddPaymentMethodPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link href="/billing" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Billing
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add a payment method</h1>
        <p className="mt-1 text-sm text-slate-600">
          We use bank-grade tokenization so your card details never touch our servers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-emerald-600" />
            Secure tokenization required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <p>
            For your security, new payment methods are added through our PCI-compliant
            Authorize.Net Accept.js integration. The form is currently being finalized.
          </p>
          <p>
            In the meantime, please contact our support team and we&apos;ll add a payment
            method on your behalf using their secure portal.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/support?topic=billing"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Contact support
            </Link>
            <Link
              href="/billing"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to billing
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
