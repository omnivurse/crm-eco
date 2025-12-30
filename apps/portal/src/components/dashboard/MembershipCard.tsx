import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Heart, ArrowRight, Calendar, DollarSign, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';

interface MembershipWithPlan {
  id: string;
  membership_number: string | null;
  status: 'pending' | 'active' | 'terminated' | 'paused';
  effective_date: string;
  billing_amount: number | null;
  plans: { 
    name: string; 
    code: string; 
    monthly_share: number;
  } | null;
}

interface MembershipCardProps {
  membership: MembershipWithPlan | null;
}

export function MembershipCard({ membership }: MembershipCardProps) {
  if (!membership) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="w-5 h-5 text-slate-400" />
            Your Membership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Heart className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 mb-2">No active membership yet.</p>
            <p className="text-sm text-slate-500 mb-4">
              Start a new enrollment to apply for membership.
            </p>
            <Link href="/enroll">
              <Button className="gap-2">
                Start Enrollment
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const monthlyAmount = membership.billing_amount || membership.plans?.monthly_share;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="w-5 h-5 text-blue-600" />
            Your Membership
          </CardTitle>
          <StatusBadge status={membership.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Name */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium mb-1">Plan</p>
          <p className="text-lg font-semibold text-blue-900">
            {membership.plans?.name || 'N/A'}
          </p>
          {membership.plans?.code && (
            <p className="text-sm text-blue-600">{membership.plans.code}</p>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Hash className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Membership #</p>
              <p className="text-sm font-medium text-slate-900">
                {membership.membership_number || 'Pending'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Effective Date</p>
              <p className="text-sm font-medium text-slate-900">
                {format(new Date(membership.effective_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 col-span-2">
            <DollarSign className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Monthly Share</p>
              <p className="text-lg font-semibold text-slate-900">
                ${monthlyAmount || '—'}/month
              </p>
            </div>
          </div>
        </div>

        {/* View Details Link */}
        <div className="pt-2 border-t">
          <Link href={`/membership/${membership.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View details
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

