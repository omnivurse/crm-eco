'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@crm-eco/ui';
import { CreditCard, Building, DollarSign } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { completePaymentStep } from '@/app/(dashboard)/enrollments/new/actions';

interface Plan {
  id: string;
  name: string;
  monthly_share: number | null;
  enrollment_fee: number | null;
}

interface PaymentStepProps {
  plans: Plan[];
}

const FUNDING_TYPES = [
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'ach', label: 'Bank Account (ACH)', icon: Building },
  { value: 'check', label: 'Check', icon: DollarSign },
  { value: 'other', label: 'Other', icon: DollarSign },
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export function PaymentStep({ plans }: PaymentStepProps) {
  const {
    enrollmentId,
    snapshot,
    selectedPlanId,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
  } = useEnrollmentWizard();

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const [fundingType, setFundingType] = useState<'credit_card' | 'ach' | 'check' | 'other'>(
    snapshot.payment?.fundingType || 'credit_card'
  );
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annual'>(
    snapshot.payment?.billingFrequency || 'monthly'
  );
  const [autoPay, setAutoPay] = useState(snapshot.payment?.autoPay ?? true);
  const [billingAddress, setBillingAddress] = useState({
    line1: snapshot.payment?.billingAddress?.line1 || '',
    line2: snapshot.payment?.billingAddress?.line2 || '',
    city: snapshot.payment?.billingAddress?.city || '',
    state: snapshot.payment?.billingAddress?.state || '',
    postalCode: snapshot.payment?.billingAddress?.postalCode || '',
  });

  const monthlyAmount = selectedPlan?.monthly_share || 0;
  const enrollmentFee = selectedPlan?.enrollment_fee || 0;
  const annualAmount = monthlyAmount * 12;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const validateForm = (): string | null => {
    if (!fundingType) return 'Please select a payment method';
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
      const billingAmount = billingFrequency === 'monthly' ? monthlyAmount : annualAmount;

      const result = await completePaymentStep({
        enrollmentId,
        fundingType,
        billingFrequency,
        autoPay,
        billingAmount,
        billingAddress: billingAddress.line1 ? billingAddress : undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to complete payment step');
        return;
      }

      updateSnapshot('payment', {
        fundingType,
        billingFrequency,
        autoPay,
        billingAmount,
        billingAddress: billingAddress.line1 ? billingAddress : undefined,
      });

      markStepComplete('payment');
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-400" />
            Payment Method
          </CardTitle>
          <CardDescription>
            Select how you&apos;d like to pay for your membership
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FUNDING_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFundingType(type.value as typeof fundingType)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    fundingType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${fundingType === type.value ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${fundingType === type.value ? 'text-blue-900' : 'text-slate-700'}`}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-sm text-slate-500 mt-4">
            <strong>Note:</strong> Payment details will be collected after enrollment approval. 
            We do not store full payment credentials at this time.
          </p>
        </CardContent>
      </Card>

      {/* Billing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Billing Frequency</Label>
              <Select value={billingFrequency} onValueChange={(v) => setBillingFrequency(v as 'monthly' | 'annual')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label htmlFor="autoPay" className="text-base font-medium">Auto-Pay</Label>
                <p className="text-sm text-slate-500">Automatically charge payment method</p>
              </div>
              <Switch
                id="autoPay"
                checked={autoPay}
                onCheckedChange={setAutoPay}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Address (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Address (Optional)</CardTitle>
          <CardDescription>
            Required if different from member address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Street Address</Label>
            <Input
              id="addressLine1"
              value={billingAddress.line1}
              onChange={(e) => setBillingAddress({ ...billingAddress, line1: e.target.value })}
              placeholder="123 Main St"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Apartment, Suite, etc.</Label>
            <Input
              id="addressLine2"
              value={billingAddress.line2}
              onChange={(e) => setBillingAddress({ ...billingAddress, line2: e.target.value })}
              placeholder="Apt 4B"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={billingAddress.city}
                onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                placeholder="Springfield"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={billingAddress.state}
                onValueChange={(value) => setBillingAddress({ ...billingAddress, state: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode">ZIP Code</Label>
              <Input
                id="postalCode"
                value={billingAddress.postalCode}
                onChange={(e) => setBillingAddress({ ...billingAddress, postalCode: e.target.value })}
                placeholder="12345"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-4 h-4 text-slate-400" />
            Estimated Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {enrollmentFee > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">One-time Enrollment Fee</span>
                <span className="font-medium">{formatCurrency(enrollmentFee)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">
                {billingFrequency === 'monthly' ? 'Monthly Share' : 'Annual Share'}
              </span>
              <span className="font-medium">
                {formatCurrency(billingFrequency === 'monthly' ? monthlyAmount : annualAmount)}
              </span>
            </div>

            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">Today&apos;s Estimated Total</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(
                    enrollmentFee + (billingFrequency === 'monthly' ? monthlyAmount : annualAmount)
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                * Final amount will be confirmed upon enrollment approval
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <WizardNavigation
        onNext={handleNext}
        isNextDisabled={!fundingType}
      />
    </div>
  );
}

