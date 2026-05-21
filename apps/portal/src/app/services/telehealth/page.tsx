import Link from 'next/link';
import { ChevronLeft, Stethoscope, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';

export const dynamic = 'force-dynamic';

export default async function TelehealthPage() {
  const providers = await listServiceProvidersByCategory('telehealth');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/services" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Services
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Stethoscope className="h-6 w-6 text-emerald-600" />
          Telehealth
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect with licensed providers 24/7 — included with your membership.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-amber-900">
            <Info className="h-4 w-4" />
            What&apos;s covered
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800">
          Coverage limits vary by plan. Most virtual urgent-care visits are included with
          no co-pay; behavioral health and specialty consults may have separate caps.
          Always confirm with your advisor before scheduling specialty visits.
        </CardContent>
      </Card>

      <ServiceProviderGrid
        providers={providers}
        ssoEnabled
        emptyMessage="Telehealth partners haven't been configured for your plan yet. Contact support."
      />
    </div>
  );
}
