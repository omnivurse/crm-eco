'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
} from '@crm-eco/ui';
import {
  FileText,
  CreditCard,
  FileCheck,
  Send,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  createNeedFromBasics,
  updateNeedBillsAndCashPay,
  updateNeedConsentAndDocs,
  submitNeedForReview,
} from '../../app/needs/new/actions';

// ============================================================================
// Types
// ============================================================================

interface NeedBasicsData {
  needType: string;
  description: string;
  incidentDate: string;
  facilityName: string;
}

interface BillsAndCashPayData {
  hasPaidProvider: boolean;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: string;
  billedAmount: number;
}

interface ConsentData {
  hasConsent: boolean;
}

interface WizardState {
  currentStep: number;
  needId: string | null;
  basics: NeedBasicsData;
  bills: BillsAndCashPayData;
  consent: ConsentData;
  isSubmitting: boolean;
  error: string | null;
  isComplete: boolean;
}

// ============================================================================
// Need Type Options
// ============================================================================

const NEED_TYPES = [
  { value: 'Hospitalization', label: 'Hospitalization' },
  { value: 'Surgery', label: 'Surgery' },
  { value: 'Emergency Room', label: 'Emergency Room' },
  { value: 'Specialist Visit', label: 'Specialist Visit' },
  { value: 'Lab/Imaging', label: 'Lab / Imaging' },
  { value: 'Outpatient Procedure', label: 'Outpatient Procedure' },
  { value: 'Maternity', label: 'Maternity' },
  { value: 'Physical Therapy', label: 'Physical Therapy' },
  { value: 'Other', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'card', label: 'Debit/Credit Card' },
  { value: 'check', label: 'Check' },
  { value: 'ach', label: 'Bank Transfer (ACH)' },
  { value: 'cash', label: 'Cash' },
  { value: 'hsa', label: 'HSA Card' },
  { value: 'fsa', label: 'FSA Card' },
];

// ============================================================================
// Step Components
// ============================================================================

interface StepProps {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => Promise<void>;
  onBack: () => void;
}

function Step1Basics({ state, setState, onNext }: StepProps) {
  const updateBasics = (updates: Partial<NeedBasicsData>) => {
    setState((prev) => ({
      ...prev,
      basics: { ...prev.basics, ...updates },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Step 1: Tell Us About Your Need
        </CardTitle>
        <CardDescription>
          Let us know what kind of medical service or expense you&apos;re submitting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="needType">What kind of Need is this? *</Label>
          <Select
            value={state.basics.needType}
            onValueChange={(value) => updateBasics({ needType: value })}
          >
            <SelectTrigger id="needType">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {NEED_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Describe what happened *</Label>
          <Textarea
            id="description"
            value={state.basics.description}
            onChange={(e) => updateBasics({ description: e.target.value })}
            placeholder="Brief description of the medical service or reason for the expense..."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="incidentDate">When did this happen? *</Label>
          <Input
            id="incidentDate"
            type="date"
            value={state.basics.incidentDate}
            onChange={(e) => updateBasics({ incidentDate: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="facilityName">Where were you seen?</Label>
          <Input
            id="facilityName"
            value={state.basics.facilityName}
            onChange={(e) => updateBasics({ facilityName: e.target.value })}
            placeholder="Hospital, clinic, or provider name"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={onNext} disabled={state.isSubmitting}>
          {state.isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step2Bills({ state, setState, onNext, onBack }: StepProps) {
  const updateBills = (updates: Partial<BillsAndCashPayData>) => {
    setState((prev) => ({
      ...prev,
      bills: { ...prev.bills, ...updates },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Step 2: Bills & Payment
        </CardTitle>
        <CardDescription>
          Tell us about any bills or payments related to this Need.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label>Have you already paid the provider?</Label>
          <div className="flex gap-4">
            <Button
              type="button"
              variant={state.bills.hasPaidProvider ? 'default' : 'outline'}
              onClick={() => updateBills({ hasPaidProvider: true })}
            >
              Yes, I&apos;ve paid
            </Button>
            <Button
              type="button"
              variant={!state.bills.hasPaidProvider ? 'default' : 'outline'}
              onClick={() => updateBills({ hasPaidProvider: false })}
            >
              No, not yet
            </Button>
          </div>
        </div>

        {state.bills.hasPaidProvider && (
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900">Payment Details</h4>

            <div className="space-y-2">
              <Label htmlFor="amountPaid">How much did you pay?</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                  id="amountPaid"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-7"
                  value={state.bills.amountPaid || ''}
                  onChange={(e) => updateBills({ amountPaid: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">How did you pay?</Label>
              <Select
                value={state.bills.paymentMethod}
                onValueChange={(value) => updateBills({ paymentMethod: value })}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">When did you pay?</Label>
              <Input
                id="paymentDate"
                type="date"
                value={state.bills.paymentDate}
                onChange={(e) => updateBills({ paymentDate: e.target.value })}
              />
            </div>
          </div>
        )}

        {!state.bills.hasPaidProvider && (
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900">Bill Information</h4>

            <div className="space-y-2">
              <Label htmlFor="billedAmount">What is the billed amount? (if known)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                  id="billedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-7"
                  value={state.bills.billedAmount || ''}
                  onChange={(e) => updateBills({ billedAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Keep your receipts and bills handy. You may need to upload them later.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={state.isSubmitting}>
          {state.isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step3Consent({ state, setState, onNext, onBack }: StepProps) {
  const updateConsent = (hasConsent: boolean) => {
    setState((prev) => ({
      ...prev,
      consent: { hasConsent },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-600" />
          Step 3: Authorization & Documents
        </CardTitle>
        <CardDescription>
          Please authorize us to process your Need and upload any supporting documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Medical Records Authorization</h4>
          <p className="text-sm text-blue-800 mb-4">
            To process your Need, we may need to obtain medical records from your provider.
            By checking the box below, you authorize WealthShare and its partners to obtain
            medical records related to this Need, as allowed by applicable laws.
          </p>
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={state.consent.hasConsent}
              onCheckedChange={(checked) => updateConsent(checked === true)}
            />
            <Label htmlFor="consent" className="text-sm font-normal leading-relaxed cursor-pointer">
              I authorize WealthShare and its partners to obtain medical records related to this
              Need for the purpose of processing my sharing request. I understand this authorization
              is voluntary and that I may revoke it at any time by contacting support.
            </Label>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="font-medium text-slate-900 mb-2">Supporting Documents</h4>
          <p className="text-sm text-slate-600 mb-4">
            You can upload receipts, itemized bills, or EOBs to help us process your Need faster.
          </p>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
            <p className="text-sm text-slate-500">
              Document upload will be available in a future update.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              For now, we&apos;ll reach out if we need additional documents.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={state.isSubmitting || !state.consent.hasConsent}>
          {state.isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step4Review({ state, onNext, onBack }: Omit<StepProps, 'setState'>) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-600" />
          Step 4: Review & Submit
        </CardTitle>
        <CardDescription>
          Please review your information before submitting your Need.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Need Basics Summary */}
        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-medium text-slate-900 mb-3">Need Details</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-900">{state.basics.needType || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Service Date</dt>
              <dd className="font-medium text-slate-900">{state.basics.incidentDate || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Description</dt>
              <dd className="font-medium text-slate-900">{state.basics.description || '—'}</dd>
            </div>
            {state.basics.facilityName && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Facility / Provider</dt>
                <dd className="font-medium text-slate-900">{state.basics.facilityName}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Payment Summary */}
        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-medium text-slate-900 mb-3">Payment Information</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Paid to Provider</dt>
              <dd className="font-medium text-slate-900">
                {state.bills.hasPaidProvider ? 'Yes' : 'No'}
              </dd>
            </div>
            {state.bills.hasPaidProvider && state.bills.amountPaid > 0 && (
              <>
                <div>
                  <dt className="text-slate-500">Amount Paid</dt>
                  <dd className="font-medium text-slate-900">
                    {formatCurrency(state.bills.amountPaid)}
                  </dd>
                </div>
                {state.bills.paymentMethod && (
                  <div>
                    <dt className="text-slate-500">Payment Method</dt>
                    <dd className="font-medium text-slate-900">
                      {PAYMENT_METHODS.find((m) => m.value === state.bills.paymentMethod)?.label ||
                        state.bills.paymentMethod}
                    </dd>
                  </div>
                )}
              </>
            )}
            {!state.bills.hasPaidProvider && state.bills.billedAmount > 0 && (
              <div>
                <dt className="text-slate-500">Billed Amount</dt>
                <dd className="font-medium text-slate-900">
                  {formatCurrency(state.bills.billedAmount)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Consent Status */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">
            You have authorized WealthShare to obtain medical records related to this Need.
          </p>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            By submitting this Need, you confirm that the information provided is accurate to the
            best of your knowledge. Our team will review your submission and reach out if we need
            additional information.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={state.isSubmitting} className="bg-green-600 hover:bg-green-700">
          {state.isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Submit Need for Sharing
        </Button>
      </CardFooter>
    </Card>
  );
}

function SuccessScreen({ needId }: { needId: string }) {
  const router = useRouter();

  return (
    <Card className="text-center">
      <CardContent className="pt-12 pb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Need Submitted Successfully!
        </h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Thank you for submitting your Need. Our team will review it and reach out if we need
          any additional information. You can track the status in your Needs list.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => router.push(`/needs/${needId}`)}>
            View This Need
          </Button>
          <Button variant="outline" onClick={() => router.push('/needs')}>
            Back to Needs List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

export function SubmitNeedWizard() {
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    needId: null,
    basics: {
      needType: '',
      description: '',
      incidentDate: '',
      facilityName: '',
    },
    bills: {
      hasPaidProvider: false,
      amountPaid: 0,
      paymentMethod: '',
      paymentDate: '',
      billedAmount: 0,
    },
    consent: {
      hasConsent: false,
    },
    isSubmitting: false,
    error: null,
    isComplete: false,
  });

  const handleStep1Next = async () => {
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

    const result = await createNeedFromBasics(state.basics);

    if (result.success && result.needId) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        needId: result.needId!,
        currentStep: 2,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: result.message,
      }));
    }
  };

  const handleStep2Next = async () => {
    if (!state.needId) return;

    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

    const result = await updateNeedBillsAndCashPay(state.needId, state.bills);

    if (result.success) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        currentStep: 3,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: result.message,
      }));
    }
  };

  const handleStep3Next = async () => {
    if (!state.needId) return;

    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

    const result = await updateNeedConsentAndDocs(state.needId, state.consent);

    if (result.success) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        currentStep: 4,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: result.message,
      }));
    }
  };

  const handleStep4Submit = async () => {
    if (!state.needId) return;

    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

    const result = await submitNeedForReview(state.needId);

    if (result.success) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        isComplete: true,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: result.message,
      }));
    }
  };

  const handleBack = () => {
    setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1, error: null }));
  };

  // Render success screen if complete
  if (state.isComplete && state.needId) {
    return <SuccessScreen needId={state.needId} />;
  }

  // Progress indicator
  const steps = [
    { num: 1, label: 'Basics' },
    { num: 2, label: 'Payment' },
    { num: 3, label: 'Consent' },
    { num: 4, label: 'Review' },
  ];

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                state.currentStep > step.num
                  ? 'bg-green-600 text-white'
                  : state.currentStep === step.num
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {state.currentStep > step.num ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                step.num
              )}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:inline ${
                state.currentStep >= step.num ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div
                className={`w-8 sm:w-16 h-px mx-2 ${
                  state.currentStep > step.num ? 'bg-green-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error display */}
      {state.error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}

      {/* Step content */}
      {state.currentStep === 1 && (
        <Step1Basics
          state={state}
          setState={setState}
          onNext={handleStep1Next}
          onBack={handleBack}
        />
      )}
      {state.currentStep === 2 && (
        <Step2Bills
          state={state}
          setState={setState}
          onNext={handleStep2Next}
          onBack={handleBack}
        />
      )}
      {state.currentStep === 3 && (
        <Step3Consent
          state={state}
          setState={setState}
          onNext={handleStep3Next}
          onBack={handleBack}
        />
      )}
      {state.currentStep === 4 && (
        <Step4Review
          state={state}
          onNext={handleStep4Submit}
          onBack={handleBack}
        />
      )}
    </div>
  );
}

