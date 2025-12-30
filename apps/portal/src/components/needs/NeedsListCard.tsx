import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui';
import { HeartPulse, FileQuestion, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { NeedStatusBadge } from './NeedStatusBadge';
import { NeedUrgencyIndicator } from './NeedUrgencyIndicator';

interface NeedSummary {
  id: string;
  need_type: string;
  description: string;
  total_amount: number;
  eligible_amount: number;
  reimbursed_amount: number;
  status: 'open' | 'in_review' | 'processing' | 'paid' | 'closed';
  urgency_light: 'green' | 'orange' | 'red' | null;
  incident_date: string | null;
  created_at: string;
  updated_at: string;
}

interface NeedsListCardProps {
  needs: NeedSummary[];
}

const formatAmount = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || amount === 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function NeedsListCard({ needs }: NeedsListCardProps) {
  if (!needs || needs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HeartPulse className="w-5 h-5 text-slate-400" />
            Your Needs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <FileQuestion className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No Needs on file yet
            </h3>
            <p className="text-slate-500 max-w-md mx-auto">
              When you submit a Need for sharing, it will appear here with its latest status.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HeartPulse className="w-5 h-5 text-blue-600" />
          Your Needs
        </CardTitle>
        <CardDescription>
          Most recent first • {needs.length} total
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Need
                </th>
                <th className="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                  Amount
                </th>
                <th className="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  SLA
                </th>
                <th className="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {needs.map((need) => {
                const totalFormatted = formatAmount(need.total_amount);
                const reimbursedFormatted = formatAmount(need.reimbursed_amount);

                return (
                  <tr key={need.id} className="hover:bg-slate-50">
                    <td className="py-4 text-sm text-slate-900">
                      {format(new Date(need.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {need.need_type}
                        </p>
                        {need.description && (
                          <p className="text-xs text-slate-500 truncate max-w-xs">
                            {need.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <NeedStatusBadge status={need.status} showIcon={false} />
                    </td>
                    <td className="py-4 text-right">
                      {need.status === 'paid' && reimbursedFormatted ? (
                        <div>
                          <p className="text-sm font-semibold text-green-700">
                            {reimbursedFormatted}
                          </p>
                          {totalFormatted && totalFormatted !== reimbursedFormatted && (
                            <p className="text-xs text-slate-500">
                              of {totalFormatted}
                            </p>
                          )}
                        </div>
                      ) : totalFormatted ? (
                        <p className="text-sm text-slate-900">{totalFormatted}</p>
                      ) : (
                        <p className="text-sm text-slate-400">—</p>
                      )}
                    </td>
                    <td className="py-4">
                      <NeedUrgencyIndicator urgency={need.urgency_light} showLabel={false} />
                    </td>
                    <td className="py-4 text-right text-sm text-slate-500">
                      {format(new Date(need.updated_at), 'MMM d')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {needs.map((need) => {
            const totalFormatted = formatAmount(need.total_amount);
            const reimbursedFormatted = formatAmount(need.reimbursed_amount);

            return (
              <div
                key={need.id}
                className="p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                {/* Top row: Type + Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">
                      {need.need_type}
                    </p>
                    {need.description && (
                      <p className="text-xs text-slate-500 truncate">
                        {need.description}
                      </p>
                    )}
                  </div>
                  <NeedStatusBadge status={need.status} showIcon={false} />
                </div>

                {/* Middle row: Dates */}
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span>Created {format(new Date(need.created_at), 'MMM d, yyyy')}</span>
                  <span>Updated {format(new Date(need.updated_at), 'MMM d')}</span>
                </div>

                {/* Bottom row: Amount + SLA */}
                <div className="flex items-center justify-between">
                  <div>
                    {need.status === 'paid' && reimbursedFormatted ? (
                      <p className="text-sm font-semibold text-green-700">
                        {reimbursedFormatted} shared
                      </p>
                    ) : totalFormatted ? (
                      <p className="text-sm text-slate-900">{totalFormatted}</p>
                    ) : null}
                  </div>
                  <NeedUrgencyIndicator urgency={need.urgency_light} showLabel={true} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

