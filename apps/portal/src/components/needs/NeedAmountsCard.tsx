import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { DollarSign, CreditCard, Banknote } from 'lucide-react';
import { format } from 'date-fns';

interface NeedAmountsCardProps {
  need: {
    total_amount: number | null;
    iua_amount: number | null;
    eligible_amount: number | null;
    reimbursed_amount: number | null;
    amount_paid: number | null;
    payment_method: string | null;
    payment_status: string | null;
    payment_date: string | null;
    reimbursement_method: string | null;
    reimbursement_account_last4: string | null;
    reimbursement_status: string | null;
    status: string;
  };
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const getPaymentStatusBadge = (status: string | null) => {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800">Partial</Badge>;
    case 'not_paid':
    default:
      return <Badge className="bg-slate-100 text-slate-700">Not Paid</Badge>;
  }
};

const getReimbursementStatusBadge = (status: string | null) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    case 'processing':
      return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
    case 'not_requested':
    default:
      return <Badge className="bg-slate-100 text-slate-700">Not Requested</Badge>;
  }
};

const formatPaymentMethod = (method: string | null) => {
  if (!method) return '—';
  const methodMap: Record<string, string> = {
    card: 'Debit/Credit Card',
    debit: 'Debit Card',
    credit: 'Credit Card',
    check: 'Check',
    ach: 'Bank Transfer (ACH)',
    cash: 'Cash',
    hsa: 'HSA Card',
    fsa: 'FSA Card',
  };
  return methodMap[method.toLowerCase()] || method;
};

const formatReimbursementMethod = (method: string | null, last4: string | null) => {
  if (!method) return '—';
  const methodMap: Record<string, string> = {
    ach: 'Bank Transfer (ACH)',
    check: 'Check',
    card: 'Card',
  };
  const formatted = methodMap[method.toLowerCase()] || method;
  if (last4) {
    return `${formatted} ending in ${last4}`;
  }
  return formatted;
};

export function NeedAmountsCard({ need }: NeedAmountsCardProps) {
  const memberResponsibility = (need.iua_amount || 0) + 
    ((need.total_amount || 0) - (need.eligible_amount || 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <DollarSign className="w-6 h-6 text-green-600" />
          Amounts & Reimbursement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Amounts */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Financial Summary
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Amount Billed / Submitted</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(need.total_amount)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Eligible / Approved Amount</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(need.eligible_amount)}
                </span>
              </div>

              {need.iua_amount !== null && need.iua_amount > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">IUA Amount</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(need.iua_amount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Member Responsibility</span>
                <span className="font-semibold text-slate-900">
                  {memberResponsibility > 0 ? formatCurrency(memberResponsibility) : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-green-50 px-3 rounded-lg">
                <span className="font-medium text-green-800">Total Reimbursed</span>
                <span className="font-bold text-green-800 text-lg">
                  {formatCurrency(need.reimbursed_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Payment & Reimbursement Status */}
          <div className="space-y-6">
            {/* Payment Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Your Payment to Provider
              </h3>
              
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Payment Method</span>
                  <span className="font-medium text-slate-900">
                    {formatPaymentMethod(need.payment_method)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Payment Status</span>
                  {getPaymentStatusBadge(need.payment_status)}
                </div>

                {need.payment_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Payment Date</span>
                    <span className="font-medium text-slate-900">
                      {format(new Date(need.payment_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}

                {need.amount_paid !== null && need.amount_paid > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Amount Paid</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(need.amount_paid)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Reimbursement Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Reimbursement from WealthShare</h3>
              
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Reimbursement Method</span>
                  <span className="font-medium text-slate-900">
                    {formatReimbursementMethod(
                      need.reimbursement_method,
                      need.reimbursement_account_last4
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Reimbursement Status</span>
                  {getReimbursementStatusBadge(need.reimbursement_status)}
                </div>
              </div>

              {need.reimbursement_status === 'completed' && need.reimbursed_amount && need.reimbursed_amount > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    We&apos;ve reimbursed {formatCurrency(need.reimbursed_amount)} for this Need.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

