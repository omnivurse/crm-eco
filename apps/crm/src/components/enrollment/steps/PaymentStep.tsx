'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, PaymentForm, type PaymentMethodData } from '@crm-eco/ui';
import { CreditCard, Building, DollarSign, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { completePaymentStep, createPaymentProfile } from '@/app/crm/enrollment/actions';

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

export function PaymentStep({ plans }: PaymentStepProps) {
  const {
    enrollmentId,
    snapshot,
    selectedPlanId,
    primaryMemberId,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
    isLoading,
  } = useEnrollmentWizard();

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const [fundingType, setFundingType] = useState<'credit_card' | 'ach' | 'check' | 'other'>(
    snapshot.payment?.fundingType || 'credit_card'
  );
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annual'>(
    snapshot.payment?.billingFrequency || 'monthly'
  );
  const [autoPay, setAutoPay] = useState(snapshot.payment?.autoPay ?? true);

  // Payment profile state
  const [paymentProfileCreated, setPaymentProfileCreated] = useState(false);
  const [paymentProfileId, setPaymentProfileId] = useState<string | null>(null);
  const [paymentLast4, setPaymentLast4] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);

  const monthlyAmount = selectedPlan?.monthly_share || 0;
  const enrollmentFee = selectedPlan?.enrollment_fee || 0;
  const annualAmount = monthlyAmount * 12;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Handle payment form submission - creates payment profile via Authorize.Net
  const handlePaymentFormSubmit = useCallback(async (paymentData: PaymentMethodData) => {
    if (!enrollmentId || !primaryMemberId) {
      setError('Enrollment or member not initialized');
      return;
    }

    setCreatingProfile(true);
    setError(null);

    try {
      // Convert PaymentMethodData to the format expected by createPaymentProfile
      const isCard = paymentData.type === 'credit_card';

      const result = await createPaymentProfile({
        enrollmentId,
        memberId: primaryMemberId,
        paymentType: isCard ? 'card' : 'ach',
        cardNumber: isCard ? paymentData.card.cardNumber.replace(/\s/g, '') : undefined,
        expiryMonth: isCard ? paymentData.card.expirationMonth : undefined,
        expiryYear: isCard ? paymentData.card.expirationYear : undefined,
        cvv: isCard ? paymentData.card.cvv : undefined,
        routingNumber: !isCard ? paymentData.bank.routingNumber : undefined,
        accountNumber: !isCard ? paymentData.bank.accountNumber : undefined,
        accountType: !isCard ? paymentData.bank.accountType : undefined,
        accountName: !isCard ? paymentData.bank.accountHolderName : undefined,
        billingAddress: {
          firstName: paymentData.billing.firstName,
          lastName: paymentData.billing.lastName,
          address: paymentData.billing.address,
          city: paymentData.billing.city,
          state: paymentData.billing.state,
          zip: paymentData.billing.zipCode,
        },
      });

      if (!result.success) {
        setError(result.error || 'Failed to create payment profile');
        return;
      }

      setPaymentProfileCreated(true);
      setPaymentProfileId(result.data?.paymentProfileId || null);
      setPaymentLast4(result.data?.last4 || null);

      // Update funding type based on payment type
      setFundingType(isCard ? 'credit_card' : 'ach');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreatingProfile(false);
    }
  }, [enrollmentId, primaryMemberId, setError]);

  const validateForm = (): string | null => {
    if (!fundingType) return 'Please select a payment method';
    if ((fundingType === 'credit_card' || fundingType === 'ach') && !paymentProfileCreated) {
      return 'Please enter and verify your payment information';
    }
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
        paymentProfileId: paymentProfileId || undefined,
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
      });

      markStepComplete('payment');
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const showPaymentForm = fundingType === 'credit_card' || fundingType === 'ach';

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
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
              const isSelected = fundingType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setFundingType(type.value as typeof fundingType);
                    // Reset payment profile if changing to a different type
                    if (type.value !== 'credit_card' && type.value !== 'ach') {
                      setPaymentProfileCreated(false);
                      setPaymentProfileId(null);
                      setPaymentLast4(null);
                    }
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment Form for Card/ACH */}
      {showPaymentForm && !paymentProfileCreated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {fundingType === 'credit_card' ? 'Credit Card Details' : 'Bank Account Details'}
            </CardTitle>
            <CardDescription>
              Your payment information is securely processed through our payment gateway
            </CardDescription>
          </CardHeader>
          <CardContent>
            {creatingProfile ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                <span className="text-slate-600">Processing payment information...</span>
              </div>
            ) : (
              <PaymentForm
                defaultTab={fundingType === 'credit_card' ? 'credit_card' : 'bank_account'}
                onSubmit={handlePaymentFormSubmit}
                submitLabel="Verify Payment Method"
                showBillingAddress={true}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Profile Confirmed */}
      {paymentProfileCreated && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Payment Method Verified</p>
                <p className="text-sm text-green-700">
                  {fundingType === 'credit_card' ? 'Card' : 'Bank Account'} ending in {paymentLast4 || '****'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentProfileCreated(false);
                  setPaymentProfileId(null);
                  setPaymentLast4(null);
                }}
                className="ml-auto text-sm text-green-700 hover:text-green-900 underline"
              >
                Change
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check/Other Payment Note */}
      {(fundingType === 'check' || fundingType === 'other') && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Manual Payment Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  {fundingType === 'check'
                    ? 'You will receive instructions for mailing your check after enrollment approval.'
                    : 'Our team will contact you to arrange an alternative payment method.'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

