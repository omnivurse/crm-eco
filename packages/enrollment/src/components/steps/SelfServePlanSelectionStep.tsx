'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Label, Button, Card, CardContent, Badge } from '@crm-eco/ui';
import { Loader2, ArrowRight, Plus, Trash2, Pill, Sparkles, Check, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { WizardPlan } from '../../types';
import type { MedicationInput, RxPricingResult, EligibilityResult } from '@crm-eco/lib';
import type { QuoteResult } from '@crm-eco/rates/types';
import { PricingQuote } from '../PricingQuote';

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
  /**
   * Server-authority quote. Returns the server-computed QuoteResult for the
   * given plan + effective date. The server owns pricing; this step only
   * displays what it returns. When omitted, or on error / NO_RATE_SET, the
   * step falls back to the flat plan monthly_share.
   */
  onQuote?: (input: {
    selected_plan_id: string;
    requested_effective_date: string;
  }) => Promise<{ success: boolean; result?: QuoteResult; error?: string }>;
  /**
   * DB-driven eligibility check. Returns the server-evaluated EligibilityResult
   * for the selected plan + effective date (rules read from
   * product_eligibility_rules, keyed on selected_plan_id -> plans). When omitted
   * (or on error), no eligibility panel is shown and the step behaves exactly as
   * before — so this is non-breaking for hosts that have not wired it.
   */
  onEligibility?: (input: {
    selected_plan_id: string;
    requested_effective_date: string;
  }) => Promise<{ success: boolean; result?: EligibilityResult; error?: string }>;
  /**
   * Enforcement flag. When true, BLOCKING eligibility findings hard-gate this
   * step: Continue is disabled while a blocking finding stands for the selected
   * plan. When false (the default), ALL findings are advisory — they render as
   * notices but never prevent advancing. Mirrors ELIGIBILITY_ENFORCE (default
   * OFF); the host passes the resolved boolean so the env flag stays server-side.
   */
  eligibilityEnforce?: boolean;
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
  onComplete,
  onRxPricing,
  onQuote,
  onEligibility,
  eligibilityEnforce = false,
  loading,
}: SelfServePlanSelectionStepProps) {
  const [selectedPlan, setSelectedPlan] = useState(selectedPlanId || '');
  const [effectiveDate, setEffectiveDate] = useState(requestedEffectiveDate || '');
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
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

  // Server-authority quote: on debounced plan / effective-date change, ask the
  // server for the authoritative QuoteResult. On error / NO_RATE_SET (or when
  // no action is wired) we clear it and fall back to the flat monthly_share.
  const quoteRequestRef = useRef(0);
  useEffect(() => {
    if (!onQuote || !selectedPlan || !effectiveDate) {
      setQuoteResult(null);
      return;
    }

    const requestId = ++quoteRequestRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await onQuote({
          selected_plan_id: selectedPlan,
          requested_effective_date: effectiveDate,
        });
        // Ignore stale responses from superseded requests.
        if (requestId !== quoteRequestRef.current) return;
        setQuoteResult(res.success && res.result ? res.result : null);
      } catch {
        if (requestId !== quoteRequestRef.current) return;
        setQuoteResult(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [onQuote, selectedPlan, effectiveDate]);

  // DB-driven eligibility: on the SAME debounced (plan, effective-date) change,
  // ask the server for the structured EligibilityResult. Mirrors the quote seam.
  // On error / when no action is wired we clear it (no panel, no gate).
  const eligibilityRequestRef = useRef(0);
  useEffect(() => {
    if (!onEligibility || !selectedPlan || !effectiveDate) {
      setEligibility(null);
      setEligibilityLoading(false);
      return;
    }

    const requestId = ++eligibilityRequestRef.current;
    setEligibilityLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await onEligibility({
          selected_plan_id: selectedPlan,
          requested_effective_date: effectiveDate,
        });
        if (requestId !== eligibilityRequestRef.current) return;
        setEligibility(res.success && res.result ? res.result : null);
        // Clear any stale hard-block error once a fresh result arrives; the
        // disabled-Continue gate is recomputed from isEligibilityBlocked.
        setErrors((prev) => (prev.eligibility ? { ...prev, eligibility: '' } : prev));
      } catch {
        if (requestId !== eligibilityRequestRef.current) return;
        setEligibility(null);
      } finally {
        if (requestId === eligibilityRequestRef.current) setEligibilityLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [onEligibility, selectedPlan, effectiveDate]);

  // Block-vs-warn decision lives HERE: only when the host turned enforcement on
  // (ELIGIBILITY_ENFORCE) AND there is at least one blocking finding for the
  // selected plan do we hard-gate the step. Otherwise findings are advisory.
  const hasBlockingFindings = (eligibility?.blocking.length ?? 0) > 0;
  const isEligibilityBlocked = eligibilityEnforce && hasBlockingFindings;

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
    // Hard-gate: when enforcement is on and the selected plan has a blocking
    // eligibility finding, do not advance. (When enforcement is off this is
    // always false, so behaviour is unchanged.)
    if (isEligibilityBlocked) {
      setErrors((prev) => ({
        ...prev,
        eligibility: 'This plan is not available based on the eligibility requirements below.',
      }));
      return;
    }
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
          <strong>Choose your coverage.</strong> Select a health sharing plan that fits
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
                  ${quoteResult && (!quoteResult.errors || quoteResult.errors.length === 0)
                    ? quoteResult.totalMonthly
                    : selectedPlanData.monthly_share}
                  /mo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Authoritative pricing breakdown (server-computed; flat fallback) */}
      {selectedPlanData && (
        <PricingQuote
          result={quoteResult}
          fallbackMonthlyShare={selectedPlanData.monthly_share}
        />
      )}

      {/* Eligibility findings (DB-driven). Advisory by default; when the host
          enforces, blocking findings additionally hard-gate Continue. */}
      {selectedPlanData && eligibility && eligibility.findings.length > 0 && (
        <Card
          className={
            isEligibilityBlocked
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              {isEligibilityBlocked ? (
                <ShieldAlert className="w-5 h-5 text-red-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              )}
              <h4
                className={`font-medium ${
                  isEligibilityBlocked ? 'text-red-900' : 'text-amber-900'
                }`}
              >
                {isEligibilityBlocked
                  ? 'This plan is not available'
                  : 'Eligibility notices'}
              </h4>
            </div>
            <ul className="space-y-2">
              {eligibility.findings.map((f) => {
                // A finding only reads as a hard block when enforcement is on.
                const isBlock = eligibilityEnforce && f.severity === 'block';
                return (
                  <li key={f.rule_id} className="flex items-start gap-2">
                    <Badge
                      className={
                        isBlock
                          ? 'bg-red-100 text-red-800 border border-red-200 shrink-0'
                          : 'bg-amber-100 text-amber-800 border border-amber-200 shrink-0'
                      }
                    >
                      {isBlock ? 'Not eligible' : 'Notice'}
                    </Badge>
                    <span
                      className={`text-sm ${
                        isBlock ? 'text-red-800' : 'text-amber-800'
                      }`}
                    >
                      {f.message}
                    </span>
                  </li>
                );
              })}
            </ul>
            {isEligibilityBlocked && (
              <p className="text-xs text-red-700 mt-3">
                Please choose a different plan or contact support to continue.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {errors.eligibility && (
        <p className="text-sm text-red-600">{errors.eligibility}</p>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          // Only the loading state of an ENFORCING check holds Continue — when
          // enforcement is off (or no action is wired) advancing is never
          // delayed, so behaviour is unchanged. A standing block always holds.
          disabled={loading || isEligibilityBlocked || (eligibilityEnforce && eligibilityLoading)}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : eligibilityEnforce && eligibilityLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking eligibility...
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
