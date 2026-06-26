import Link from 'next/link';
import { Compass, Home } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-6">
          <Compass className="w-8 h-8 text-slate-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Page not found</h2>
        <p className="text-slate-600 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link href="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
