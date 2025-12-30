/**
 * Rx Pricing Types and Helper
 * 
 * This module provides types and a stub function for prescription medication
 * pricing estimates. Currently returns mock data; replace getRxPricingEstimate
 * implementation with real AI (e.g., Gemini) or Rx pricing API when ready.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Input structure for a single medication
 */
export interface MedicationInput {
  /** Medication name (e.g., "Metformin", "Lisinopril") */
  name: string;
  /** Dosage (e.g., "500mg", "10mg") */
  dosage: string;
  /** Frequency (e.g., "1x/day", "2x/day", "weekly", "as needed") */
  frequency: string;
  /** Current monthly cost the member is paying (optional) */
  currentMonthlyCost?: number;
  /** Member's preferred pharmacy (optional) */
  preferredPharmacy?: string;
}

/**
 * A single pricing option returned from the estimate
 */
export interface RxOption {
  /** Name of the medication this option is for */
  medicationName: string;
  /** Suggested pharmacy */
  pharmacy: string;
  /** Estimated monthly cost at this pharmacy */
  estimatedMonthlyCost: number;
  /** Additional notes about this option */
  notes?: string;
  /** Source of this estimate: 'mock' for placeholder, 'ai' for real integration */
  source: 'mock' | 'ai';
}

/**
 * Complete pricing result with all options and a summary
 */
export interface RxPricingResult {
  /** Array of pricing options, one per medication (potentially multiple per med in future) */
  options: RxOption[];
  /** Human-readable summary of the pricing estimate */
  summary: string;
  /** Timestamp when this estimate was generated */
  generatedAt?: string;
}

// ============================================================================
// Pricing Estimate Function
// ============================================================================

export interface GetRxPricingParams {
  /** List of medications to get pricing for */
  meds: MedicationInput[];
  /** Member's state (may affect pharmacy options/pricing) */
  memberState?: string;
  /** Selected plan ID (may affect coverage/pricing in future) */
  planId?: string;
}

/**
 * Get prescription pricing estimates for a list of medications.
 * 
 * **CURRENT IMPLEMENTATION: MOCK DATA**
 * 
 * This function returns deterministic mock data so the UI and DB wiring
 * are stable. Replace the implementation body with real AI (e.g., Gemini)
 * or external Rx pricing API when ready.
 * 
 * The mock logic:
 * - Uses the member's preferred pharmacy if specified, otherwise "Generic Pharmacy"
 * - Estimates 20% lower than current cost (minimum $5)
 * - If no current cost provided, assumes $100 baseline
 * 
 * @param params - Medications list and context (state, plan)
 * @returns Pricing result with options and summary
 */
export async function getRxPricingEstimate(
  params: GetRxPricingParams
): Promise<RxPricingResult> {
  // TODO: Replace with real AI (e.g., Gemini) or Rx pricing API integration
  // The types and return structure should remain stable.

  const { meds, memberState, planId } = params;

  if (meds.length === 0) {
    return {
      options: [],
      summary: 'No medications provided for pricing.',
      generatedAt: new Date().toISOString(),
    };
  }

  // Generate mock pricing options
  const options: RxOption[] = meds.map((med) => {
    const baseCost = med.currentMonthlyCost ?? 100;
    // Mock: 20% discount, minimum $5
    const estimatedCost = Math.max(baseCost * 0.8, 5);
    // Round to 2 decimal places
    const roundedCost = Math.round(estimatedCost * 100) / 100;

    return {
      medicationName: med.name,
      pharmacy: med.preferredPharmacy || 'Generic Pharmacy',
      estimatedMonthlyCost: roundedCost,
      notes: med.currentMonthlyCost
        ? `Mock estimate: ~20% lower than your current $${med.currentMonthlyCost}/month.`
        : 'Mock estimate based on typical pricing.',
      source: 'mock' as const,
    };
  });

  // Calculate potential savings summary
  const totalCurrentCost = meds.reduce(
    (sum, med) => sum + (med.currentMonthlyCost ?? 100),
    0
  );
  const totalEstimatedCost = options.reduce(
    (sum, opt) => sum + opt.estimatedMonthlyCost,
    0
  );
  const savings = totalCurrentCost - totalEstimatedCost;

  let summary = `Mock Rx pricing generated for ${meds.length} medication${meds.length > 1 ? 's' : ''}.`;
  if (savings > 0) {
    summary += ` Potential monthly savings: ~$${savings.toFixed(2)}.`;
  }
  summary += ' Replace with real AI or API integration when ready.';

  // Include context in notes for future debugging
  if (memberState || planId) {
    summary += ` (State: ${memberState || 'N/A'}, Plan: ${planId || 'N/A'})`;
  }

  return {
    options,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Validate a medications array before submitting
 */
export function validateMedications(meds: MedicationInput[]): string | null {
  for (let i = 0; i < meds.length; i++) {
    const med = meds[i];
    if (!med.name?.trim()) {
      return `Medication ${i + 1}: Name is required`;
    }
    if (!med.dosage?.trim()) {
      return `Medication ${i + 1}: Dosage is required`;
    }
    if (!med.frequency?.trim()) {
      return `Medication ${i + 1}: Frequency is required`;
    }
    if (med.currentMonthlyCost !== undefined && med.currentMonthlyCost < 0) {
      return `Medication ${i + 1}: Monthly cost cannot be negative`;
    }
  }
  return null;
}

