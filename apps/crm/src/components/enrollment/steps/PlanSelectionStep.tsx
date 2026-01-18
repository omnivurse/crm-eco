'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  Input, 
  Label, 
  Badge, 
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui';
import { FileText, AlertTriangle, UserPlus, Check, Calendar, Pill, Plus, Trash2, Loader2, Sparkles, DollarSign } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { completePlanSelectionStep, runRxPricing } from '@/app/crm/enrollment/actions';
import { cn } from '@crm-eco/ui';
import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';

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

const FREQUENCY_OPTIONS = [
  { value: '1x/day', label: 'Once daily' },
  { value: '2x/day', label: 'Twice daily' },
  { value: '3x/day', label: 'Three times daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as needed', label: 'As needed' },
];

const EMPTY_MEDICATION: MedicationInput = {
  name: '',
  dosage: '',
  frequency: '',
  currentMonthlyCost: undefined,
  preferredPharmacy: '',
};

export function PlanSelectionStep({ plans }: PlanSelectionStepProps) {
  const {
    enrollmentId,
    snapshot,
    enrollmentMode,
    hasMandateWarning,
    hasAge65Warning,
    rxMedications,
    rxPricingResult,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
    setSelectedPlanId,
    setWarnings,
    setRxMedications,
    setRxPricingResult,
  } = useEnrollmentWizard();

  const [selectedPlan, setSelectedPlan] = useState(snapshot.plan_selection?.selectedPlanId || '');
  const [requestedEffectiveDate, setRequestedEffectiveDate] = useState(
    snapshot.plan_selection?.requestedEffectiveDate || ''
  );
  
  // Local medication state (synced to context on changes)
  const [medications, setMedications] = useState<MedicationInput[]>(
    rxMedications.length > 0 ? rxMedications : []
  );
  const [isLoadingRx, setIsLoadingRx] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);

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

  // Medication handlers
  const addMedication = () => {
    const newMeds = [...medications, { ...EMPTY_MEDICATION }];
    setMedications(newMeds);
  };

  const removeMedication = (index: number) => {
    const newMeds = medications.filter((_, i) => i !== index);
    setMedications(newMeds);
    setRxMedications(newMeds);
    // Clear pricing if all meds removed
    if (newMeds.length === 0) {
      setRxPricingResult(null);
    }
  };

  const updateMedication = (index: number, field: keyof MedicationInput, value: string | number | undefined) => {
    const newMeds = [...medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setMedications(newMeds);
  };

  const handleCheckRxPricing = async () => {
    if (!enrollmentId || medications.length === 0) return;

    // Validate all medications have required fields
    const validMeds = medications.filter(med => med.name && med.dosage && med.frequency);
    if (validMeds.length === 0) {
      setRxError('Please fill in medication name, dosage, and frequency for at least one medication');
      return;
    }

    setIsLoadingRx(true);
    setRxError(null);

    try {
      const result = await runRxPricing({
        enrollmentId,
        medications: validMeds,
      });

      if (!result.success) {
        setRxError(result.error || 'Failed to get Rx pricing');
        return;
      }

      if (result.data) {
        setRxMedications(validMeds);
        setRxPricingResult(result.data);
      }
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingRx(false);
    }
  };

  // Mode-aware copy
  const getMedicationsCopy = () => {
    if (enrollmentMode === 'member_self_serve') {
      return {
        title: 'Your Medications (Optional)',
        description: 'List any prescription medications you take regularly. We can estimate potential savings with different pharmacy options.',
        helpText: 'This information helps us find the best pricing options for you. All estimates are approximate.',
      };
    }
    return {
      title: 'Medications (Optional)',
      description: 'Capture member medications for Rx pricing estimates',
      helpText: 'Enter medications to generate pricing suggestions. These are estimates only.',
    };
  };

  const medicationsCopy = getMedicationsCopy();

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

      {/* Medications Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-slate-400" />
            {medicationsCopy.title}
          </CardTitle>
          <CardDescription>
            {medicationsCopy.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {medications.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[200px]">Medication Name</TableHead>
                    <TableHead className="w-[100px]">Dosage</TableHead>
                    <TableHead className="w-[140px]">Frequency</TableHead>
                    <TableHead className="w-[120px]">Current $/month</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medications.map((med, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          placeholder="e.g., Metformin"
                          value={med.name}
                          onChange={(e) => updateMedication(index, 'name', e.target.value)}
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="e.g., 500mg"
                          value={med.dosage}
                          onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={med.frequency}
                          onValueChange={(v) => updateMedication(index, 'frequency', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={med.currentMonthlyCost ?? ''}
                          onChange={(e) => updateMedication(
                            index, 
                            'currentMonthlyCost', 
                            e.target.value ? parseFloat(e.target.value) : undefined
                          )}
                          className="h-9"
                          min={0}
                          step={0.01}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMedication(index)}
                          className="h-9 w-9 p-0 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
              <Pill className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No medications added yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Add medications to get estimated pricing options
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMedication}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Medication
            </Button>

            {medications.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCheckRxPricing}
                disabled={isLoadingRx || medications.filter(m => m.name && m.dosage && m.frequency).length === 0}
                className="gap-2"
              >
                {isLoadingRx ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Check Estimated Rx Options
                  </>
                )}
              </Button>
            )}
          </div>

          {rxError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {rxError}
            </div>
          )}

          <p className="text-xs text-slate-500">
            {medicationsCopy.helpText}
          </p>
        </CardContent>
      </Card>

      {/* Rx Pricing Results */}
      {rxPricingResult && rxPricingResult.options.length > 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-green-800">
              <DollarSign className="w-5 h-5 text-green-600" />
              Rx Pricing Estimate
            </CardTitle>
            <CardDescription className="text-green-700">
              {rxPricingResult.summary}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Medication</TableHead>
                    <TableHead>Suggested Pharmacy</TableHead>
                    <TableHead className="text-right">Est. Monthly Cost</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rxPricingResult.options.map((option, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{option.medicationName}</TableCell>
                      <TableCell>{option.pharmacy}</TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        {formatCurrency(option.estimatedMonthlyCost)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {option.notes}
                        {option.source === 'mock' && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Estimate
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-green-700 mt-3">
              These are estimates only and may vary. Actual costs depend on your pharmacy, 
              insurance coverage, and available discounts. Consult your pharmacy for exact pricing.
            </p>
          </CardContent>
        </Card>
      )}

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

