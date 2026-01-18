import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { ArrowLeft } from 'lucide-react';
import { VendorForm } from '@/components/vendors/VendorForm';

export default function NewVendorPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/vendors">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add New Vendor</h1>
          <p className="text-slate-500 mt-0.5">
            Configure a new vendor integration
          </p>
        </div>
      </div>

      {/* Form */}
      <VendorForm />
    </div>
  );
}
