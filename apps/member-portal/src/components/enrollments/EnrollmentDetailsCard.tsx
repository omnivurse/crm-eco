import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { User, Users, Heart, Pill, CurrencyDollar, MapPin } from '@phosphor-icons/react/dist/ssr';

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
          <User weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
          Enrollment Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-500">
            <User weight="light" className="h-4 w-4" />
            Primary Member
          </h4>
          <div className="space-y-1 rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-900">
              {primaryMember.first_name} {primaryMember.last_name}
            </p>
            <p className="text-sm text-slate-600">{primaryMember.email}</p>
            {primaryMember.phone && (
              <p className="text-sm text-slate-600">{primaryMember.phone}</p>
            )}
            {primaryMember.state && (
              <p className="flex items-center gap-1 text-sm text-slate-600">
                <MapPin weight="light" className="h-3 w-3" />
                {primaryMember.state}
              </p>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-500">
            <Users weight="light" className="h-4 w-4" />
            Household
          </h4>
          <div className="rounded-lg bg-slate-50 p-3">
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

        {plan && (
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-500">
              <Heart weight="light" className="h-4 w-4" />
              Plan
            </h4>
            <div className="rounded-lg bg-[rgba(11,109,133,0.06)] p-3">
              <p className="font-medium text-[var(--mp-ink)]">{plan.name}</p>
              <p className="text-sm text-[var(--mp-teal)]">{plan.code}</p>
              <p className="mt-1 flex items-center gap-1 text-lg font-semibold text-[var(--mp-ink)]">
                <CurrencyDollar weight="light" className="h-4 w-4" />
                {plan.monthly_share}/month
              </p>
            </div>
          </div>
        )}

        {rxMedications.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-500">
              <Pill weight="light" className="h-4 w-4" />
              Medications
            </h4>
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              {rxMedications.map((med, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-slate-900">{med.name}</span>
                  <span className="text-sm text-slate-500">{med.dosage}</span>
                </div>
              ))}
              {rxPricing?.summary && (
                <p className="mt-2 border-t pt-2 text-xs text-slate-500">
                  {rxPricing.summary}
                </p>
              )}
            </div>
          </div>
        )}

        {snapshot.payment?.payment_method && (
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-500">
              <CurrencyDollar weight="light" className="h-4 w-4" />
              Payment
            </h4>
            <div className="rounded-lg bg-slate-50 p-3">
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
