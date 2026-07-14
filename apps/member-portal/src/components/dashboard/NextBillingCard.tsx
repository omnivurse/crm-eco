import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';

interface NextBillingCardProps {
  schedule: {
    amount: number | null;
    next_billing_date: string | null;
    frequency?: string | null;
  } | null;
}

export function NextBillingCard({ schedule }: NextBillingCardProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Calendar className="h-5 w-5 text-blue-600" aria-hidden />
          Next billing
        </CardTitle>
      </CardHeader>
      <CardContent>
        {schedule?.next_billing_date ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">
                ${Number(schedule.amount ?? 0).toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Due {new Date(schedule.next_billing_date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            <Link
              href="/billing"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              Manage
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Once your enrollment is active, billing details will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
