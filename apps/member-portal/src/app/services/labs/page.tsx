import Link from 'next/link';
import { ChevronLeft, FlaskConical, Info, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { Button } from '@crm-eco/ui/components/button';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { RecommendedLabsSection } from '@/components/services/RecommendedLabsSection';
import { LabPartnersSection } from '@/components/services/LabPartnersSection';

export const dynamic = 'force-dynamic';

export default async function LabsPage() {
  const dbProviders = await listServiceProvidersByCategory('labs');

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <Link href="/services" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
        Back to Services
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <FlaskConical className="h-6 w-6 text-cyan-600" aria-hidden />
          Labs &amp; testing
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Affordable lab tests, blood work, and curated bundles through Own Your Labs and Health Cost Labs.
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-blue-900">
            <Info className="h-4 w-4" aria-hidden />
            Sharing eligibility
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800">
          Lab tests exceeding your IUA may not be eligible for sharing. Confirm pricing with your advisor
          before booking expensive panels. After you pay, keep your receipt — you can attach it when you{' '}
          <Link href="/needs/new" className="font-medium underline-offset-2 hover:underline">
            submit a sharing need
          </Link>
          .
        </CardContent>
      </Card>

      <RecommendedLabsSection />

      <LabPartnersSection dbProviders={dbProviders} />

      <Card className="border-slate-200">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className="font-medium text-slate-900">Already had labs done?</p>
              <p className="mt-0.5 text-sm text-slate-600">
                Submit a need for sharing review with your itemized bill or receipt.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/needs/new">Submit a sharing need</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
