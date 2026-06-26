import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { HeartPulse, ArrowRight, FileQuestion } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';

interface NeedSummary {
  id: string;
  need_type: string;
  description: string;
  total_amount: number;
  eligible_amount: number;
  reimbursed_amount: number;
  status: 'open' | 'in_review' | 'processing' | 'paid' | 'closed';
  incident_date: string | null;
  created_at: string;
}

interface NeedsOverviewCardProps {
  needs: NeedSummary[];
}

const formatAmount = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function NeedsOverviewCard({ needs }: NeedsOverviewCardProps) {
  if (!needs || needs.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HeartPulse className="w-5 h-5 text-slate-400" />
            Needs & Sharing Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <FileQuestion className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 mb-2">No Needs on file yet.</p>
            <p className="text-sm text-slate-500">
              When you submit a Need for sharing, you&apos;ll see updates here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <HeartPulse className="w-5 h-5 text-blue-600" />
          Needs & Sharing Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {needs.slice(0, 4).map((need) => (
            <div
              key={need.id}
              className="flex items-start justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {need.need_type}
                  </p>
                  <StatusBadge status={need.status} showIcon={false} />
                </div>
                <p className="text-xs text-slate-500">
                  {format(new Date(need.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-semibold text-slate-900">
                  {formatAmount(need.total_amount)}
                </p>
                {need.status === 'paid' && need.reimbursed_amount > 0 && (
                  <p className="text-xs text-green-600">
                    Shared: {formatAmount(need.reimbursed_amount)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t">
          <Link 
            href="/needs" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all Needs
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

