'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Label, Badge } from '@crm-eco/ui';
import { CheckCircle, User, Users, FileText, Shield, CreditCard, AlertTriangle, UserPlus } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { submitEnrollment } from '@/app/(dashboard)/enrollments/new/actions';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Plan {
  id: string;
  name: string;
  code: string;
  monthly_share: number | null;
  enrollment_fee: number | null;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
}

interface ConfirmationStepProps {
  members: Member[];
  plans: Plan[];
  advisors: Advisor[];
}

export function ConfirmationStep({ members, plans, advisors }: ConfirmationStepProps) {
  const router = useRouter();
  const {
    enrollmentId,
    snapshot,
    hasMandateWarning,
    hasAge65Warning,
    setIsLoading,
    setError,
    stepStatuses,
  } = useEnrollmentWizard();

  const [finalAcceptance, setFinalAcceptance] = useState(false);

  // Get selected data
  const selectedMember = members.find((m) => m.id === snapshot.intake?.memberId);
  const selectedPlan = plans.find((p) => p.id === snapshot.plan_selection?.selectedPlanId);
  const selectedAdvisor = advisors.find((a) => a.id === snapshot.intake?.advisorId);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Check all required steps are complete
  const requiredSteps = ['intake', 'household', 'plan_selection', 'compliance', 'payment'] as const;
  const allStepsComplete = requiredSteps.every((step) => stepStatuses[step]?.isCompleted);

  const handleSubmit = async () => {
    if (!finalAcceptance) {
      setError('You must accept the final terms to submit');
      return;
    }

    if (!enrollmentId) {
      setError('Enrollment not initialized');
      return;
    }

    if (!allStepsComplete) {
      setError('Please complete all previous steps before submitting');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await submitEnrollment(enrollmentId, finalAcceptance);

      if (!result.success) {
        setError(result.error || 'Failed to submit enrollment');
        return;
      }

      // Redirect to the enrollment detail page with success
      router.push(`/enrollments/${enrollmentId}?submitted=true`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Summary */}
      {(hasMandateWarning || hasAge65Warning) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Enrollment Warnings</p>
                <ul className="text-sm text-amber-700 mt-2 space-y-1">
                  {hasMandateWarning && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      State has individual health coverage mandate
                    </li>
                  )}
                  {hasAge65Warning && (
                    <li className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Member is 65+ and may be Medicare eligible
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary Member */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4 text-slate-400" />
              Primary Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMember || snapshot.intake?.newMember ? (
              <div>
                <p className="font-medium text-slate-900">
                  {selectedMember 
                    ? `${selectedMember.first_name} ${selectedMember.last_name}`
                    : `${snapshot.intake?.newMember?.firstName} ${snapshot.intake?.newMember?.lastName}`
                  }
                </p>
                <p className="text-sm text-slate-500">
                  {selectedMember?.email || snapshot.intake?.newMember?.email}
                </p>
              </div>
            ) : (
              <p className="text-slate-400">No member selected</p>
            )}
          </CardContent>
        </Card>

        {/* Household */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-slate-400" />
              Household
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-slate-900">
              {snapshot.household?.householdSize || 1} member{(snapshot.household?.householdSize || 1) !== 1 ? 's' : ''}
            </p>
            {snapshot.household?.members && snapshot.household.members.length > 1 && (
              <p className="text-sm text-slate-500">
                {snapshot.household.members
                  .filter((m) => m.relationship !== 'primary')
                  .map((m) => `${m.firstName} (${m.relationship})`)
                  .join(', ')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Selected Plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-slate-400" />
              Selected Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPlan ? (
              <div>
                <p className="font-medium text-slate-900">{selectedPlan.name}</p>
                <p className="text-sm text-slate-500 font-mono">{selectedPlan.code}</p>
                <p className="text-lg font-semibold text-blue-600 mt-2">
                  {formatCurrency(selectedPlan.monthly_share)}/mo
                </p>
              </div>
            ) : (
              <p className="text-slate-400">No plan selected</p>
            )}
          </CardContent>
        </Card>

        {/* Effective Date */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Requested Effective Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-slate-900">
              {snapshot.plan_selection?.requestedEffectiveDate
                ? new Date(snapshot.plan_selection.requestedEffectiveDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Not selected'}
            </p>
          </CardContent>
        </Card>

        {/* Advisor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Advisor</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAdvisor ? (
              <p className="font-medium text-slate-900">
                {selectedAdvisor.first_name} {selectedAdvisor.last_name}
              </p>
            ) : (
              <p className="text-slate-400">No advisor assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4 text-slate-400" />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-slate-900 capitalize">
              {snapshot.payment?.fundingType?.replace('_', ' ') || 'Not selected'}
            </p>
            <p className="text-sm text-slate-500">
              {snapshot.payment?.billingFrequency === 'annual' ? 'Annual' : 'Monthly'} billing
              {snapshot.payment?.autoPay && ' • Auto-pay enabled'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-slate-400" />
            Acknowledgements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {snapshot.compliance?.healthshareAcknowledgement && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Healthshare Understanding
              </Badge>
            )}
            {snapshot.compliance?.guidelinesAcknowledgement && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Guidelines
              </Badge>
            )}
            {snapshot.compliance?.sharingLimitationsAcknowledgement && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Sharing Limitations
              </Badge>
            )}
            {snapshot.compliance?.telehealthConsent && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Telehealth
              </Badge>
            )}
            {snapshot.compliance?.electronicCommunicationsConsent && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                E-Communications
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Final Acceptance */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="finalAcceptance"
              checked={finalAcceptance}
              onCheckedChange={(checked) => setFinalAcceptance(checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="finalAcceptance" className="font-medium text-slate-900 cursor-pointer">
                I confirm that all information provided is accurate
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                By checking this box and submitting, I confirm that the information provided in 
                this enrollment is true and accurate to the best of my knowledge. I understand 
                that my enrollment is subject to review and approval, and I agree to the terms 
                and conditions of the healthshare program.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Completion Status */}
      {!allStepsComplete && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700 font-medium">
              Please complete all previous steps before submitting:
            </p>
            <ul className="text-sm text-red-600 mt-2 space-y-1">
              {requiredSteps
                .filter((step) => !stepStatuses[step]?.isCompleted)
                .map((step) => (
                  <li key={step} className="capitalize">• {step.replace('_', ' ')}</li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <WizardNavigation
        onSubmit={handleSubmit}
        submitLabel="Submit Enrollment"
        isNextDisabled={!finalAcceptance || !allStepsComplete}
        showSubmit
      />
    </div>
  );
}

