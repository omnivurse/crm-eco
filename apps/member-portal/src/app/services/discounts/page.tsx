import Link from 'next/link';
import { ChevronLeft, Tag } from 'lucide-react';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';

export const dynamic = 'force-dynamic';

export default async function DiscountsPage() {
  const providers = await listServiceProvidersByCategory('discount');
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/services" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Services
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Tag className="h-6 w-6 text-amber-600" />
          Discounts
        </h1>
        <p className="mt-1 text-sm text-slate-600">Member-only savings on pharmacy, vision, dental, fitness, and more.</p>
      </div>
      <ServiceProviderGrid providers={providers} />
    </div>
  );
}
