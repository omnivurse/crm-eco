'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ReportBuilderWizard } from '@/components/crm/reports/ReportBuilderWizard';

// Unified: both /reports/new and /reports/builder use the same wizard
export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <ReportBuilderWizard />
    </Suspense>
  );
}
