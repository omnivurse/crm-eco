import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { User, Users, Heart, Pill, DollarSign, MapPin } from 'lucide-react';

interface EnrollmentSnapshot {
  intake?: {
    email?: string;
    phone?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  household?: {
    members?: Array<{
      first_name: string;
      last_name: string;
      relationship: string;
    }>;
  };
  plan_selection?: {
    rx_medications?: Array<{
      name: string;
      dosage: string;
    }>;
    rx_pricing_result?: {
      summary?: string;
      options?: Array<{
        medicationName: string;
        estimatedMonthlyCost: number;
      }>;
    };
  };
  payment?: {
    payment_method?: string;
    billing_day?: number;
  };
}

interface EnrollmentDetailsCardProps {
  enrollment: {
    snapshot: EnrollmentSnapshot | null;
    rx_medications: Array<{ name: string; dosage: string }> | null;
    rx_pricing_result: { summary?: string; options?: Array<{ medicationName: string; estimatedMonthlyCost: number }> } | null;
  };
  plan: {
    name: string;
    code: string;
    monthly_share: number;
  } | null;
  primaryMember: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    state: string | null;
  };
}

export function EnrollmentDetailsCard({ 
  enrollment, 
  plan,
  primaryMember,
}: EnrollmentDetailsCardProps) {
  const snapshot = enrollment.snapshot || {};
  const householdMembers = snapshot.household?.members || [];
  const rxMedications = enrollment.rx_medications || snapshot.plan_selection?.rx_medications || [];
  const rxPricing = enrollment.rx_pricing_result || snapshot.plan_selection?.rx_pricing_result;

  // Build household summary
  const getHouseholdSummary = () => {
    if (householdMembers.length === 0) return 'Individual enrollment (no dependents)';
    
    const spouse = householdMembers.filter(m => m.relationship === 'spouse').length;
    const children = householdMembers.filter(m => m.relationship === 'child').length;
    const dependents = householdMembers.filter(m => m.relationship === 'dependent').length;
    
    const parts = [];
    if (spouse > 0) parts.push(`${spouse} spouse`);
    if (children > 0) parts.push(`${children} child${children > 1 ? 'ren' : ''}`);
    if (dependents > 0) parts.push(`${dependents} dependent${dependents > 1 ? 's' : ''}`);
    
    return parts.join(', ') || `${householdMembers.length} member${householdMembers.length > 1 ? 's' : ''}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="w-5 h-5 text-blue-600" />
          Enrollment Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Primary Member */}
        <div>
          <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1">
            <User className="w-4 h-4" />
            Primary Member
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-slate-900">
              {primaryMember.first_name} {primaryMember.last_name}
            </p>
            <p className="text-sm text-slate-600">{primaryMember.email}</p>
            {primaryMember.phone && (
              <p className="text-sm text-slate-600">{primaryMember.phone}</p>
            )}
            {primaryMember.state && (
              <p className="text-sm text-slate-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {primaryMember.state}
              </p>
            )}
          </div>
        </div>

        {/* Household */}
        <div>
          <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1">
            <Users className="w-4 h-4" />
            Household
          </h4>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-900">{getHouseholdSummary()}</p>
            {householdMembers.length > 0 && (
              <div className="mt-2 space-y-1">
                {householdMembers.map((member, idx) => (
                  <p key={idx} className="text-sm text-slate-600">
                    {member.first_name} {member.last_name} ({member.relationship})
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plan Details */}
        {plan && (
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1">
              <Heart className="w-4 h-4" />
              Plan
            </h4>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="font-medium text-blue-900">{plan.name}</p>
              <p className="text-sm text-blue-700">{plan.code}</p>
              <p className="text-lg font-semibold text-blue-900 mt-1 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {plan.monthly_share}/month
              </p>
            </div>
          </div>
        )}

        {/* Rx Medications */}
        {rxMedications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1">
              <Pill className="w-4 h-4" />
              Medications
            </h4>
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              {rxMedications.map((med, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm text-slate-900">{med.name}</span>
                  <span className="text-sm text-slate-500">{med.dosage}</span>
                </div>
              ))}
              {rxPricing?.summary && (
                <p className="text-xs text-slate-500 pt-2 border-t mt-2">
                  {rxPricing.summary}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Payment Method */}
        {snapshot.payment?.payment_method && (
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              Payment
            </h4>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-900">
                {snapshot.payment.payment_method === 'bank_draft' ? 'Bank Draft (ACH)' : 'Credit/Debit Card'}
              </p>
              {snapshot.payment.billing_day && (
                <p className="text-sm text-slate-600">
                  Billing day: {snapshot.payment.billing_day}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

