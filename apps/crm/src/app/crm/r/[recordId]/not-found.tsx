import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

export default function RecordNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 max-w-md">
        <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <FileQuestion className="w-7 h-7 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Record not found
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          This record may have been deleted, moved, or you may not have access to it.
        </p>
        <Button variant="outline" asChild>
          <Link href="/crm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CRM
          </Link>
        </Button>
      </div>
    </div>
  );
}
