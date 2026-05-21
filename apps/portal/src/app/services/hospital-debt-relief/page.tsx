import Link from 'next/link';
import { ChevronLeft, Building2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';

export const dynamic = 'force-dynamic';

export default async function HospitalDebtReliefPage() {
  const providers = await listServiceProvidersByCategory('hospital_debt_relief');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/services" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Services
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Building2 className="h-6 w-6 text-red-600" />
          Hospital debt relief
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Negotiate or eliminate hospital debt accumulated before joining.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Quick eligibility check
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Has the bill been outstanding for more than 90 days?</li>
            <li>Did the service occur before your membership effective date?</li>
            <li>Is the original balance over $500?</li>
            <li>Have you already contacted the billing department?</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            If you answered yes to two or more, you likely qualify. Visit a partner below to start the application.
          </p>
        </CardContent>
      </Card>

      <ServiceProviderGrid providers={providers} />
    </div>
  );
}
