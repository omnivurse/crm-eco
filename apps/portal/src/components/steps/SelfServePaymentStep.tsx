'use client';

import { useState } from 'react';
import { Label, Button, Card, CardContent } from '@crm-eco/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { Loader2, ArrowRight, CreditCard, Building2, Calendar, Check } from 'lucide-react';
import type { WizardPlan } from '../SelfServeEnrollmentWizard';

interface PaymentData {
  payment_method?: 'bank_draft' | 'credit_card';
  billing_day?: number;
}

interface SelfServePaymentStepProps {
  data?: PaymentData;
  selectedPlan?: WizardPlan;
  onComplete: (data: PaymentData) => void;
  loading: boolean;
}

export function SelfServePaymentStep({
  data,
  selectedPlan,
  onComplete,
  loading,
}: SelfServePaymentStepProps) {
  const [paymentMethod, setPaymentMethod] = useState<'bank_draft' | 'credit_card'>(
    data?.payment_method || 'bank_draft'
  );
  const [billingDay, setBillingDay] = useState<number>(data?.billing_day || 1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!paymentMethod) {
      newErrors.paymentMethod = 'Please select a payment method';
    }

    if (!billingDay || billingDay < 1 || billingDay > 28) {
      newErrors.billingDay = 'Please select a billing day';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onComplete({
        payment_method: paymentMethod,
        billing_day: billingDay,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Set up your monthly contribution.</strong> Choose how you&apos;d like to 
          make your monthly share payments. Your first payment will be processed after 
          your enrollment is approved.
        </p>
      </div>

      {/* Monthly Amount Summary */}
      {selectedPlan && (
        <Card className="bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-600">Monthly Share Amount</p>
                <p className="text-lg font-semibold text-slate-900">{selectedPlan.name}</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                ${selectedPlan.monthly_share}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Method */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Payment Method *</Label>
        
        {errors.paymentMethod && (
          <p className="text-sm text-red-600">{errors.paymentMethod}</p>
        )}

        <div className="grid gap-4">
          <Card
            className={`cursor-pointer transition-all ${
              paymentMethod === 'bank_draft'
                ? 'ring-2 ring-blue-500 border-blue-500'
                : 'hover:border-blue-300'
            }`}
            onClick={() => setPaymentMethod('bank_draft')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900">Bank Draft (ACH)</h4>
                    <span className="text-xs text-green-600 font-medium">Recommended</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Automatic monthly deduction from your checking or savings account. 
                    No processing fees.
                  </p>
                </div>
                {paymentMethod === 'bank_draft' && (
                  <Check className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              paymentMethod === 'credit_card'
                ? 'ring-2 ring-blue-500 border-blue-500'
                : 'hover:border-blue-300'
            }`}
            onClick={() => setPaymentMethod('credit_card')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">Credit/Debit Card</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Pay with your credit or debit card. A 2.9% processing fee applies.
                  </p>
                </div>
                {paymentMethod === 'credit_card' && (
                  <Check className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Billing Day */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-400" />
          <Label className="text-base font-medium">Billing Day *</Label>
        </div>

        <p className="text-sm text-slate-600">
          Choose which day of the month you&apos;d like your payment processed.
        </p>

        <Select
          value={billingDay.toString()}
          onValueChange={(value) => setBillingDay(Number(value))}
        >
          <SelectTrigger className={errors.billingDay ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select day of month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1st of the month</SelectItem>
            <SelectItem value="5">5th of the month</SelectItem>
            <SelectItem value="10">10th of the month</SelectItem>
            <SelectItem value="15">15th of the month</SelectItem>
            <SelectItem value="20">20th of the month</SelectItem>
            <SelectItem value="25">25th of the month</SelectItem>
          </SelectContent>
        </Select>
        {errors.billingDay && (
          <p className="text-sm text-red-600">{errors.billingDay}</p>
        )}
      </div>

      {/* Payment Details Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> You&apos;ll enter your actual bank account or card details 
            after your enrollment is reviewed and approved. No payment information is 
            collected at this time.
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedPlan && (
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="font-medium text-slate-900 mb-2">Payment Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Monthly share:</span>
              <span className="font-medium">${selectedPlan.monthly_share}</span>
            </div>
            {paymentMethod === 'credit_card' && (
              <div className="flex justify-between">
                <span className="text-slate-600">Processing fee (2.9%):</span>
                <span className="font-medium">
                  ${(selectedPlan.monthly_share * 0.029).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="font-medium text-slate-900">Monthly total:</span>
              <span className="font-bold text-slate-900">
                ${paymentMethod === 'credit_card' 
                  ? (selectedPlan.monthly_share * 1.029).toFixed(2)
                  : selectedPlan.monthly_share}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Billing day:</span>
              <span>{billingDay}st of each month</span>
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

