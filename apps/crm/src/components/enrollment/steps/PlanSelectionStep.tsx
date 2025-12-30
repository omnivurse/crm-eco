'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Badge } from '@crm-eco/ui';
import { FileText, AlertTriangle, UserPlus, Check, Calendar } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { completePlanSelectionStep } from '@/app/(dashboard)/enrollments/new/actions';
import { cn } from '@crm-eco/ui';

interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  tier: string | null;
  monthly_share: number | null;
  iua_amount: number | null;
  enrollment_fee: number | null;
}

interface PlanSelectionStepProps {
  plans: Plan[];
}

export function PlanSelectionStep({ plans }: PlanSelectionStepProps) {
  const {
    enrollmentId,
    snapshot,
    hasMandateWarning,
    hasAge65Warning,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
    setSelectedPlanId,
    setWarnings,
  } = useEnrollmentWizard();

  const [selectedPlan, setSelectedPlan] = useState(snapshot.plan_selection?.selectedPlanId || '');
  const [requestedEffectiveDate, setRequestedEffectiveDate] = useState(
    snapshot.plan_selection?.requestedEffectiveDate || ''
  );

  // Set minimum date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const validateForm = (): string | null => {
    if (!selectedPlan) return 'Please select a plan';
    if (!requestedEffectiveDate) return 'Please select a requested effective date';
    return null;
  };

  const handleNext = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!enrollmentId) {
      setError('Enrollment not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await completePlanSelectionStep({
        enrollmentId,
        selectedPlanId: selectedPlan,
        requestedEffectiveDate,
      });

      if (!result.success) {
        setError(result.error || 'Failed to complete plan selection step');
        return;
      }

      // Update warnings from server response
      if (result.data) {
        setWarnings(result.data.hasMandateWarning, result.data.hasAge65Warning);
      }

      updateSnapshot('plan_selection', {
        selectedPlanId: selectedPlan,
        requestedEffectiveDate,
        hasMandateWarning: result.data?.hasMandateWarning,
        hasAge65Warning: result.data?.hasAge65Warning,
      });

      setSelectedPlanId(selectedPlan);
      markStepComplete('plan_selection');
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banners */}
      {(hasMandateWarning || hasAge65Warning) && (
        <div className="space-y-3">
          {hasMandateWarning && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Mandate State Warning</p>
                <p className="text-sm text-amber-700 mt-1">
                  This member resides in a state with an individual health insurance mandate. 
                  Healthshare plans may not satisfy the mandate requirement. Please ensure the 
                  member understands this before proceeding.
                </p>
              </div>
            </div>
          )}
          {hasAge65Warning && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <UserPlus className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Age 65+ Warning</p>
                <p className="text-sm text-orange-700 mt-1">
                  This member is 65 or older and may be eligible for Medicare. Please review 
                  Medicare eligibility and ensure the member understands their options before 
                  proceeding with a healthshare plan.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plan Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Select a Plan
          </CardTitle>
          <CardDescription>
            Choose the healthshare plan that best fits the member&apos;s needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No plans available</p>
              <p className="text-sm mt-1">Please add plans in Settings before proceeding</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    'relative p-4 rounded-lg border-2 text-left transition-all',
                    selectedPlan === plan.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  )}
                >
                  {selectedPlan === plan.id && (
                    <div className="absolute top-3 right-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}

                  <div className="pr-8">
                    <h4 className="font-semibold text-slate-900">{plan.name}</h4>
                    <p className="text-sm text-slate-500 font-mono">{plan.code}</p>
                    
                    {plan.tier && (
                      <Badge variant="secondary" className="mt-2 capitalize">
                        {plan.tier}
                      </Badge>
                    )}

                    {plan.description && (
                      <p className="text-sm text-slate-600 mt-3 line-clamp-2">
                        {plan.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500">Monthly Share</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {formatCurrency(plan.monthly_share)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">IUA</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {formatCurrency(plan.iua_amount)}
                        </p>
                      </div>
                    </div>

                    {plan.enrollment_fee && (
                      <p className="text-xs text-slate-500 mt-2">
                        One-time enrollment fee: {formatCurrency(plan.enrollment_fee)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Effective Date */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-slate-400" />
            Requested Effective Date
          </CardTitle>
          <CardDescription>
            When should coverage begin? This is subject to approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="effectiveDate" className="sr-only">Effective Date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={requestedEffectiveDate}
              onChange={(e) => setRequestedEffectiveDate(e.target.value)}
              min={minDate}
            />
          </div>
        </CardContent>
      </Card>

      {/* Selected Plan Summary */}
      {selectedPlan && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Selected Plan</p>
                <p className="font-semibold text-slate-900">
                  {plans.find((p) => p.id === selectedPlan)?.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Monthly Share</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(plans.find((p) => p.id === selectedPlan)?.monthly_share ?? null)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <WizardNavigation
        onNext={handleNext}
        isNextDisabled={!selectedPlan || !requestedEffectiveDate}
      />
    </div>
  );
}

