import Link from 'next/link';
import { ChevronLeft, FlaskConical, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';

export const dynamic = 'force-dynamic';

export default async function LabsPage() {
  const providers = await listServiceProvidersByCategory('labs');
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/services" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Services
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <FlaskConical className="h-6 w-6 text-cyan-600" />
          Labs &amp; testing
        </h1>
        <p className="mt-1 text-sm text-slate-600">Affordable lab tests, blood work, and home testing kits.</p>
      </div>
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-blue-900">
            <Info className="h-4 w-4" /> Note
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800">
          Lab tests exceeding your IUA may not be eligible for sharing. Confirm pricing
          with your advisor before booking expensive panels.
        </CardContent>
      </Card>
      <ServiceProviderGrid providers={providers} />
    </div>
  );
}
