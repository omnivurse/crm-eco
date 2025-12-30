'use client';

import { useState } from 'react';
import { Input, Label, Button, Card, CardContent, Badge } from '@crm-eco/ui';
import { Loader2, ArrowRight, Plus, Trash2, Pill, Sparkles, Check } from 'lucide-react';
import type { WizardPlan } from '../SelfServeEnrollmentWizard';
import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';

interface SelfServePlanSelectionStepProps {
  plans: WizardPlan[];
  selectedPlanId?: string;
  requestedEffectiveDate?: string;
  medications?: MedicationInput[];
  rxPricingResult?: RxPricingResult;
  memberState?: string;
  onComplete: (data: {
    selected_plan_id: string;
    requested_effective_date: string;
    rx_medications?: MedicationInput[];
  }) => void;
  onRxPricing: (medications: MedicationInput[]) => Promise<RxPricingResult | null>;
  loading: boolean;
}

const emptyMedication = (): MedicationInput => ({
  name: '',
  dosage: '',
  frequency: '',
  currentMonthlyCost: undefined,
  preferredPharmacy: '',
});

export function SelfServePlanSelectionStep({
  plans,
  selectedPlanId,
  requestedEffectiveDate,
  medications: initialMedications,
  rxPricingResult: initialRxPricing,
  memberState,
  onComplete,
  onRxPricing,
  loading,
}: SelfServePlanSelectionStepProps) {
  const [selectedPlan, setSelectedPlan] = useState(selectedPlanId || '');
  const [effectiveDate, setEffectiveDate] = useState(requestedEffectiveDate || '');
  const [medications, setMedications] = useState<MedicationInput[]>(
    initialMedications || []
  );
  const [rxPricing, setRxPricing] = useState<RxPricingResult | null>(
    initialRxPricing || null
  );
  const [rxLoading, setRxLoading] = useState(false);
  const [showMedications, setShowMedications] = useState(
    (initialMedications?.length || 0) > 0
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate min date (first of next month)
  const getMinDate = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextMonth.toISOString().split('T')[0];
  };

  const addMedication = () => {
    setMedications((prev) => [...prev, emptyMedication()]);
  };

  const removeMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof MedicationInput, value: string | number | undefined) => {
    setMedications((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleRxPricing = async () => {
    // Filter out empty medications
    const validMeds = medications.filter(
      (m) => m.name.trim() && m.dosage.trim() && m.frequency.trim()
    );

    if (validMeds.length === 0) {
      setErrors((prev) => ({ ...prev, rx: 'Please add at least one medication with name, dosage, and frequency' }));
      return;
    }

    setRxLoading(true);
    setErrors((prev) => ({ ...prev, rx: '' }));

    try {
      const result = await onRxPricing(validMeds);
      if (result) {
        setRxPricing(result);
      }
    } finally {
      setRxLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedPlan) {
      newErrors.plan = 'Please select a plan';
    }

    if (!effectiveDate) {
      newErrors.effectiveDate = 'Please select an effective date';
    } else {
      const selected = new Date(effectiveDate);
      const min = new Date(getMinDate());
      if (selected < min) {
        newErrors.effectiveDate = 'Effective date must be at least the first of next month';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onComplete({
        selected_plan_id: selectedPlan,
        requested_effective_date: effectiveDate,
        rx_medications: medications.filter(
          (m) => m.name.trim() && m.dosage.trim() && m.frequency.trim()
        ),
      });
    }
  };

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Choose your coverage.</strong> Select a healthshare plan that fits 
          your needs and budget. All plans include access to our member sharing network 
          and wellness resources.
        </p>
      </div>

      {/* Plan Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Select a Plan *</Label>
        
        {errors.plan && (
          <p className="text-sm text-red-600">{errors.plan}</p>
        )}

        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`cursor-pointer transition-all ${
                selectedPlan === plan.id
                  ? 'ring-2 ring-blue-500 border-blue-500'
                  : 'hover:border-blue-300'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{plan.name}</h4>
                      <Badge variant="secondary">{plan.code}</Badge>
                    </div>
                    {plan.description && (
                      <p className="text-sm text-slate-600 mt-1">{plan.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">
                      ${plan.monthly_share}
                    </p>
                    <p className="text-xs text-slate-500">per month</p>
                  </div>
                </div>
                {selectedPlan === plan.id && (
                  <div className="mt-4 pt-4 border-t flex items-center gap-2 text-blue-600">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Selected</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Effective Date */}
      <div className="space-y-2">
        <Label htmlFor="effectiveDate">Requested Effective Date *</Label>
        <Input
          id="effectiveDate"
          type="date"
          value={effectiveDate}
          min={getMinDate()}
          onChange={(e) => setEffectiveDate(e.target.value)}
          className={errors.effectiveDate ? 'border-red-500' : ''}
        />
        {errors.effectiveDate ? (
          <p className="text-sm text-red-600">{errors.effectiveDate}</p>
        ) : (
          <p className="text-xs text-slate-500">
            Coverage typically starts on the first of the month
          </p>
        )}
      </div>

      {/* Medications Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-slate-400" />
            <Label className="text-base font-medium">Prescription Medications</Label>
          </div>
          {!showMedications && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowMedications(true);
                if (medications.length === 0) addMedication();
              }}
            >
              Add Medications
            </Button>
          )}
        </div>

        <p className="text-sm text-slate-600">
          Tell us about any prescriptions you take regularly. We&apos;ll help estimate 
          costs and suggest pharmacies with better pricing.
        </p>

        {showMedications && (
          <div className="space-y-4">
            {medications.map((med, index) => (
              <Card key={index} className="relative">
                <CardContent className="pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMedication(index)}
                    className="absolute top-2 right-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pr-8">
                    <div className="col-span-2 md:col-span-1 space-y-2">
                      <Label>Medication Name</Label>
                      <Input
                        placeholder="e.g., Metformin"
                        value={med.name}
                        onChange={(e) => updateMedication(index, 'name', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Dosage</Label>
                      <Input
                        placeholder="e.g., 500mg"
                        value={med.dosage}
                        onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Input
                        placeholder="e.g., 2x daily"
                        value={med.frequency}
                        onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Current Monthly Cost</Label>
                      <Input
                        type="number"
                        placeholder="$"
                        value={med.currentMonthlyCost || ''}
                        onChange={(e) => updateMedication(index, 'currentMonthlyCost', Number(e.target.value) || undefined)}
                      />
                    </div>

                    <div className="col-span-2 space-y-2">
                      <Label>Preferred Pharmacy</Label>
                      <Input
                        placeholder="e.g., CVS, Walgreens, Costco"
                        value={med.preferredPharmacy || ''}
                        onChange={(e) => updateMedication(index, 'preferredPharmacy', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addMedication}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={handleRxPricing}
                disabled={rxLoading}
                className="gap-2"
              >
                {rxLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Check Estimated Rx Options
              </Button>
            </div>

            {errors.rx && (
              <p className="text-sm text-red-600">{errors.rx}</p>
            )}
          </div>
        )}

        {/* Rx Pricing Results */}
        {rxPricing && rxPricing.options.length > 0 && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-900">Estimated Rx Pricing</h4>
                {rxPricing.options[0]?.source === 'ai' && (
                  <Badge className="bg-purple-100 text-purple-800">AI-Powered</Badge>
                )}
              </div>

              <div className="space-y-3">
                {rxPricing.options.map((opt, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-slate-900">{opt.medicationName}</p>
                      <p className="text-sm text-slate-600">{opt.pharmacy}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-700">
                        ~${opt.estimatedMonthlyCost.toFixed(2)}/mo
                      </p>
                      {opt.notes && (
                        <p className="text-xs text-slate-500">{opt.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 mt-4">
                {rxPricing.summary}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected Plan Summary */}
      {selectedPlanData && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600 font-medium">Your Selection</p>
                <p className="text-lg font-semibold text-blue-900">
                  {selectedPlanData.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">
                  ${selectedPlanData.monthly_share}/mo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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

