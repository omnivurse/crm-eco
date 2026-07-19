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
  SealCheck,
  PaperPlaneTilt,
  CaretRight,
  CaretLeft,
  CheckCircle,
  CircleNotch,
  WarningCircle,
} from '@phosphor-icons/react';
import { createShareRequest, submitNeedForReview } from '../../app/needs/new/actions';
import { NeedDocumentUpload } from './NeedDocumentUpload';
import type { NeedAttachmentRecord } from '@/lib/needs/attachment-client';

// ============================================================================
// Types
// ============================================================================

type YesNo = 'yes' | 'no' | '';

export interface MemberPrefill {
  firstName: string;
  lastName: string;
  memberIdCard: string;
  dateOfBirth: string;
  email: string;
  phone: string;
}

interface FormData {
  acknowledgedInstructions: boolean;
  // Member info
  firstName: string;
  lastName: string;
  memberIdCard: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  otherInsurance: YesNo;
  // Request details
  requestType: string;
  treatmentType: string;
  usedAmbulance: YesNo;
  initialDateOfService: string;
  symptomsBeforeService: YesNo;
  facilityName: string;
  primaryCare: string;
  detailedDescription: string;
  hasItemizedSelfPayStatement: YesNo;
  inquiredFinancialAssistance: YesNo;
}

interface WizardState {
  currentStep: number;
  needId: string | null;
  form: FormData;
  attachments: NeedAttachmentRecord[];
  isSubmitting: boolean;
  error: string | null;
  isComplete: boolean;
}

// ============================================================================
// Options
// ============================================================================

const REQUEST_TYPES = [
  { value: 'General', label: 'General' },
  { value: 'Maternity', label: 'Maternity' },
  { value: 'Injury or Accident', label: 'Injury or Accident' },
  { value: 'Surgery / Procedure', label: 'Surgery / Procedure' },
  { value: 'Pre-existing Condition', label: 'Pre-existing Condition' },
  { value: 'Other', label: 'Other' },
];

const TREATMENT_TYPES = [
  { value: 'Office / clinic visit', label: 'Office / clinic visit' },
  { value: 'Emergency room', label: 'Emergency room' },
  { value: 'Urgent care', label: 'Urgent care' },
  { value: 'Hospitalization', label: 'Hospitalization' },
  { value: 'Surgery / procedure', label: 'Surgery / procedure' },
  { value: 'Lab / imaging', label: 'Lab / imaging' },
  { value: 'Maternity', label: 'Maternity' },
  { value: 'Physical therapy', label: 'Physical therapy' },
  { value: 'Other', label: 'Other' },
];

const INSTRUCTIONS =
  'Before submitting your request, make sure eligible medical bills from a single event ' +
  'exceed your Member Responsibility Amount (MRA) that was chosen during the enrollment ' +
  'process. Review the Member Guidelines to understand what may be eligible for sharing. ' +
  'When receiving care, present yourself as a self-pay patient, request to be directly ' +
  'billed, and always ask about available self-pay pricing and discounts. If this occurred ' +
  'within your first year of membership, it is highly recommended to include medical records ' +
  'with your request to support the review process.';

// ============================================================================
// Small helpers
// ============================================================================

function YesNoField({
  label,
  hint,
  value,
  onChange,
  required,
}: {
  label: string;
  hint?: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <div className="flex gap-3">
        <Button
          type="button"
          variant={value === 'yes' ? 'default' : 'outline'}
          onClick={() => onChange('yes')}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={value === 'no' ? 'default' : 'outline'}
          onClick={() => onChange('no')}
        >
          No
        </Button>
      </div>
    </div>
  );
}

interface StepProps {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => Promise<void>;
  onBack: () => void;
}

// ============================================================================
// Step 1 — Instructions, member info & request details
// ============================================================================

function Step1Details({ state, setState, onNext }: StepProps) {
  const update = (updates: Partial<FormData>) =>
    setState((prev) => ({ ...prev, form: { ...prev.form, ...updates } }));

  const f = state.form;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText weight="light" className="w-5 h-5 text-[var(--mp-teal)]" aria-hidden />
            Sharing Request
          </CardTitle>
          <CardDescription>Complete the form below to submit your request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border-[rgba(11,109,133,0.2)] border bg-[var(--mp-mist)] p-4 text-sm text-[var(--mp-ink)]">
            {INSTRUCTIONS}
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="ack"
              checked={f.acknowledgedInstructions}
              onCheckedChange={(checked) => update({ acknowledgedInstructions: checked === true })}
            />
            <Label htmlFor="ack" className="text-sm font-normal leading-relaxed cursor-pointer">
              I have read the instructions above. *
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Member Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Member Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" value={f.firstName} onChange={(e) => update({ firstName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" value={f.lastName} onChange={(e) => update({ lastName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberIdCard">Member ID *</Label>
              <Input
                id="memberIdCard"
                value={f.memberIdCard}
                onChange={(e) => update({ memberIdCard: e.target.value })}
                placeholder="From your ID card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={f.dateOfBirth}
                onChange={(e) => update({ dateOfBirth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Preferred Email *</Label>
              <Input id="email" type="email" value={f.email} onChange={(e) => update({ email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Preferred Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={f.phone}
                onChange={(e) => update({ phone: e.target.value })}
                placeholder="(555) 555-5555"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="otherInsurance">Do you have other Insurance?</Label>
            <Select value={f.otherInsurance} onValueChange={(v) => update({ otherInsurance: v as YesNo })}>
              <SelectTrigger id="otherInsurance">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Request Type & details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Request Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="requestType">Request Type *</Label>
            <Select value={f.requestType} onValueChange={(v) => update({ requestType: v })}>
              <SelectTrigger id="requestType">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              General is for unexpected or general medical care such as emergency room visits,
              urgent care, or treatment for an illness or injury.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatmentType">Treatment type (optional)</Label>
            <Select value={f.treatmentType} onValueChange={(v) => update({ treatmentType: v })}>
              <SelectTrigger id="treatmentType">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {TREATMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <YesNoField
            label="Did you use ambulance transportation for this event?"
            value={f.usedAmbulance}
            onChange={(v) => update({ usedAmbulance: v })}
          />

          <div className="space-y-2">
            <Label htmlFor="initialDateOfService">Initial Date of Service *</Label>
            <p className="text-xs text-slate-500">First date of service you received care for this.</p>
            <Input
              id="initialDateOfService"
              type="date"
              value={f.initialDateOfService}
              onChange={(e) => update({ initialDateOfService: e.target.value })}
            />
          </div>

          <YesNoField
            label="Have symptoms occurred before the initial date of service?"
            value={f.symptomsBeforeService}
            onChange={(v) => update({ symptomsBeforeService: v })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="facilityName">Facility Name (if known)</Label>
              <Input
                id="facilityName"
                value={f.facilityName}
                onChange={(e) => update({ facilityName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryCare">Primary Care (if known)</Label>
              <Input
                id="primaryCare"
                value={f.primaryCare}
                onChange={(e) => update({ primaryCare: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detailedDescription">Detailed Description *</Label>
            <p className="text-xs text-slate-500">
              Please provide specific details about how the event occurred.
            </p>
            <Textarea
              id="detailedDescription"
              rows={4}
              value={f.detailedDescription}
              onChange={(e) => update({ detailedDescription: e.target.value })}
            />
          </div>

          <YesNoField
            label="Have you received an Itemized Statement with Self-pay adjustments?"
            required
            value={f.hasItemizedSelfPayStatement}
            onChange={(v) => update({ hasItemizedSelfPayStatement: v })}
          />

          <YesNoField
            label="Have you inquired with the hospital about their financial assistance programs?"
            required
            value={f.inquiredFinancialAssistance}
            onChange={(v) => update({ inquiredFinancialAssistance: v })}
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={onNext} disabled={state.isSubmitting}>
            {state.isSubmitting ? <CircleNotch weight="light" className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : null}
            Continue
            <CaretRight weight="light" className="w-4 h-4 ml-2" aria-hidden />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ============================================================================
// Step 2 — Documents
// ============================================================================

function Step2Documents({ state, setState, onNext, onBack }: StepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SealCheck weight="light" className="w-5 h-5 text-[var(--mp-teal)]" aria-hidden />
          Documents
        </CardTitle>
        <CardDescription>
          Upload supporting documents to help us review your request faster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <NeedDocumentUpload
          needId={state.needId}
          attachments={state.attachments}
          disabled={state.isSubmitting}
          onAttachmentUploaded={(attachment) =>
            setState((prev) => ({ ...prev, attachments: [...prev.attachments, attachment] }))
          }
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Documents to include: itemized medical bills with self-pay discounts, receipts of
          payments, medical notes, and prepayment agreements. An EOB from the other insurance may
          be required. For your sharing request to be expedited, please provide the medical records
          from the providers.
        </div>
      </CardContent>
      <CardFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          <CaretLeft weight="light" className="w-4 h-4 mr-2" aria-hidden />
          Back
        </Button>
        <Button onClick={onNext} disabled={state.isSubmitting} className="w-full sm:w-auto">
          Continue
          <CaretRight weight="light" className="w-4 h-4 ml-2" aria-hidden />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Step 3 — Review & submit
// ============================================================================

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function yn(v: YesNo): string | null {
  return v === 'yes' ? 'Yes' : v === 'no' ? 'No' : null;
}

function Step3Review({ state, onNext, onBack }: Omit<StepProps, 'setState'>) {
  const f = state.form;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PaperPlaneTilt weight="light" className="w-5 h-5 text-[var(--mp-teal)]" aria-hidden />
          Review & Submit
        </CardTitle>
        <CardDescription>Please review your request before submitting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-medium text-slate-900 mb-3">Member</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row label="Name" value={`${f.firstName} ${f.lastName}`.trim()} />
            <Row label="Member ID" value={f.memberIdCard} />
            <Row label="Date of Birth" value={f.dateOfBirth} />
            <Row label="Email" value={f.email} />
            <Row label="Phone" value={f.phone} />
            <Row label="Other Insurance" value={yn(f.otherInsurance)} />
          </dl>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-medium text-slate-900 mb-3">Request</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row label="Request Type" value={f.requestType} />
            <Row label="Treatment Type" value={f.treatmentType} />
            <Row label="Initial Date of Service" value={f.initialDateOfService} />
            <Row label="Ambulance Used" value={yn(f.usedAmbulance)} />
            <Row label="Symptoms Before Service" value={yn(f.symptomsBeforeService)} />
            <Row label="Facility" value={f.facilityName} />
            <Row label="Primary Care" value={f.primaryCare} />
            <Row label="Itemized Self-pay Statement" value={yn(f.hasItemizedSelfPayStatement)} />
            <Row label="Inquired Financial Assistance" value={yn(f.inquiredFinancialAssistance)} />
            <div className="sm:col-span-2">
              <Row label="Detailed Description" value={f.detailedDescription} />
            </div>
          </dl>
        </div>

        {state.attachments.length > 0 && (
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-3">
              Documents ({state.attachments.length})
            </h4>
            <ul className="space-y-1 text-sm text-slate-700">
              {state.attachments.map((a) => (
                <li key={a.id} className="truncate">
                  {a.file_name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-3 p-4 bg-[var(--mp-mist)] border border-[rgba(11,109,133,0.2)] rounded-lg">
          <WarningCircle weight="light" className="h-5 w-5 text-[var(--mp-teal)] flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-[var(--mp-ink)]">
            By submitting, you confirm the information provided is accurate to the best of your
            knowledge. Our team will review your request and reach out if we need anything else.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          <CaretLeft weight="light" className="w-4 h-4 mr-2" aria-hidden />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={state.isSubmitting}
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
        >
          {state.isSubmitting ? (
            <CircleNotch weight="light" className="w-4 h-4 mr-2 animate-spin" aria-hidden />
          ) : (
            <PaperPlaneTilt weight="light" className="w-4 h-4 mr-2" aria-hidden />
          )}
          Submit Request
        </Button>
      </CardFooter>
    </Card>
  );
}

function SuccessScreen({ needId, attachmentCount }: { needId: string; attachmentCount: number }) {
  const router = useRouter();
  return (
    <Card className="text-center">
      <CardContent className="pt-12 pb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle weight="light" className="w-8 h-8 text-green-600" aria-hidden />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted!</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Thank you for submitting your sharing request. Our team will review it and reach out if we
          need any additional information.
          {attachmentCount > 0
            ? ` ${attachmentCount} supporting document${attachmentCount === 1 ? '' : 's'} attached.`
            : ''}{' '}
          You can track the status in your Needs list.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => router.push(`/needs/${needId}`)}>View This Request</Button>
          <Button variant="outline" onClick={() => router.push('/needs')}>
            Back to Needs List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main wizard
// ============================================================================

export function SubmitNeedWizard({ memberPrefill }: { memberPrefill?: MemberPrefill }) {
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    needId: null,
    form: {
      acknowledgedInstructions: false,
      firstName: memberPrefill?.firstName ?? '',
      lastName: memberPrefill?.lastName ?? '',
      memberIdCard: memberPrefill?.memberIdCard ?? '',
      dateOfBirth: memberPrefill?.dateOfBirth ?? '',
      email: memberPrefill?.email ?? '',
      phone: memberPrefill?.phone ?? '',
      otherInsurance: '',
      requestType: 'General',
      treatmentType: '',
      usedAmbulance: '',
      initialDateOfService: '',
      symptomsBeforeService: '',
      facilityName: '',
      primaryCare: '',
      detailedDescription: '',
      hasItemizedSelfPayStatement: '',
      inquiredFinancialAssistance: '',
    },
    attachments: [],
    isSubmitting: false,
    error: null,
    isComplete: false,
  });

  const handleStep1Next = async () => {
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    const f = state.form;
    const result = await createShareRequest({
      acknowledgedInstructions: f.acknowledgedInstructions,
      firstName: f.firstName,
      lastName: f.lastName,
      memberIdCard: f.memberIdCard,
      dateOfBirth: f.dateOfBirth,
      email: f.email,
      phone: f.phone,
      otherInsurance: f.otherInsurance,
      requestType: f.requestType,
      treatmentType: f.treatmentType,
      usedAmbulance: f.usedAmbulance,
      initialDateOfService: f.initialDateOfService,
      symptomsBeforeService: f.symptomsBeforeService,
      facilityName: f.facilityName,
      primaryCare: f.primaryCare,
      detailedDescription: f.detailedDescription,
      hasItemizedSelfPayStatement: f.hasItemizedSelfPayStatement,
      inquiredFinancialAssistance: f.inquiredFinancialAssistance,
    });

    if (result.success && result.needId) {
      setState((prev) => ({ ...prev, isSubmitting: false, needId: result.needId!, currentStep: 2 }));
    } else {
      setState((prev) => ({ ...prev, isSubmitting: false, error: result.message }));
    }
  };

  const handleStep2Next = async () => {
    setState((prev) => ({ ...prev, currentStep: 3, error: null }));
  };

  const handleStep3Submit = async () => {
    if (!state.needId) return;
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    const result = await submitNeedForReview(state.needId);
    if (result.success) {
      setState((prev) => ({ ...prev, isSubmitting: false, isComplete: true }));
    } else {
      setState((prev) => ({ ...prev, isSubmitting: false, error: result.message }));
    }
  };

  const handleBack = () =>
    setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1, error: null }));

  if (state.isComplete && state.needId) {
    return <SuccessScreen needId={state.needId} attachmentCount={state.attachments.length} />;
  }

  const steps = [
    { num: 1, label: 'Request' },
    { num: 2, label: 'Documents' },
    { num: 3, label: 'Review' },
  ];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                state.currentStep > step.num
                  ? 'bg-green-600 text-white'
                  : state.currentStep === step.num
                    ? 'bg-[var(--mp-teal)] text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {state.currentStep > step.num ? <CheckCircle weight="light" className="w-5 h-5" aria-hidden /> : step.num}
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

      {state.error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <WarningCircle weight="light" className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}

      {state.currentStep === 1 && (
        <Step1Details state={state} setState={setState} onNext={handleStep1Next} onBack={handleBack} />
      )}
      {state.currentStep === 2 && (
        <Step2Documents state={state} setState={setState} onNext={handleStep2Next} onBack={handleBack} />
      )}
      {state.currentStep === 3 && (
        <Step3Review state={state} onNext={handleStep3Submit} onBack={handleBack} />
      )}
    </div>
  );
}
