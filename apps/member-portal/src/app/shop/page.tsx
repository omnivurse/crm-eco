import { PageHeader } from '@/components/PageHeader';
import { ShopClient } from '@/components/shop/ShopClient';

export const dynamic = 'force-dynamic';

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="Shop"
        description="Add another membership or buy a prepaid package. Your current plan stays in place."
        backHref="/plan"
        backLabel="My plan"
      />
      <ShopClient />
    </div>
  );
}
