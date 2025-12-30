/**
 * Rx Pricing Types and Helper
 * 
 * This module provides types and functions for prescription medication
 * pricing estimates. Uses Gemini AI when GEMINI_API_KEY is configured,
 * falls back to deterministic mock data otherwise.
 */

import { callGeminiForRxPricing, isGeminiConfigured } from '../ai/geminiClient';

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
 * Uses Gemini AI when GEMINI_API_KEY is configured, otherwise falls back
 * to deterministic mock data for development/testing.
 * 
 * @param params - Medications list and context (state, plan)
 * @returns Pricing result with options and summary
 */
export async function getRxPricingEstimate(
  params: GetRxPricingParams
): Promise<RxPricingResult> {
  const { meds, memberState, planId } = params;

  if (!meds || meds.length === 0) {
    return {
      options: [],
      summary: 'No medications provided for pricing.',
      generatedAt: new Date().toISOString(),
    };
  }

  // Try Gemini AI if configured
  if (isGeminiConfigured()) {
    const aiResult = await tryGeminiRxPricing(meds, memberState, planId);
    if (aiResult) {
      return aiResult;
    }
    // Fall through to mock if AI fails
    console.log('Gemini Rx pricing failed, falling back to mock');
  }

  // Fallback: Generate mock pricing options
  return generateMockRxPricing(meds, memberState, planId);
}

/**
 * Build and execute a Gemini prompt for Rx pricing
 */
async function tryGeminiRxPricing(
  meds: MedicationInput[],
  memberState?: string,
  planId?: string
): Promise<RxPricingResult | null> {
  // Build a structured prompt for Gemini
  const medsDescription = meds
    .map(
      (m, idx) =>
        `${idx + 1}. Name: ${m.name}, Dosage: ${m.dosage}, Frequency: ${m.frequency}, ` +
        `Current Monthly Cost: ${m.currentMonthlyCost !== undefined ? '$' + m.currentMonthlyCost : 'unknown'}, ` +
        `Preferred Pharmacy: ${m.preferredPharmacy || 'none specified'}`
    )
    .join('\n');

  const prompt = `You are helping estimate prescription costs for healthshare members.

Return STRICTLY valid JSON with this exact shape (no markdown, no explanation, just JSON):

{
  "options": [
    {
      "medicationName": "string",
      "pharmacy": "string",
      "estimatedMonthlyCost": number,
      "notes": "string (optional advice or context)"
    }
  ],
  "summary": "string (brief overall summary)"
}

Context:
- Member state: ${memberState || 'unknown'}
- Plan ID: ${planId || 'unknown'}

Medications to price:
${medsDescription}

For each medication, suggest a realistic estimated monthly cost based on:
- Common pharmacy pricing (Costco, Walmart $4 generics, GoodRx discounts, etc.)
- Whether it's likely generic or brand-name
- Typical price ranges for the drug class

Keep estimates realistic and conservative. If you're unsure, estimate higher rather than lower.`;

  const aiResponse = await callGeminiForRxPricing(prompt);

  if (!aiResponse || !aiResponse.options) {
    return null;
  }

  // Map AI response to our RxOption type with source: 'ai'
  const options: RxOption[] = aiResponse.options.map((opt) => ({
    medicationName: opt.medicationName,
    pharmacy: opt.pharmacy,
    estimatedMonthlyCost: opt.estimatedMonthlyCost,
    notes: opt.notes,
    source: 'ai' as const,
  }));

  return {
    options,
    summary: aiResponse.summary || 'AI-generated Rx pricing estimates.',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate mock Rx pricing (fallback when AI is unavailable)
 */
function generateMockRxPricing(
  meds: MedicationInput[],
  memberState?: string,
  planId?: string
): RxPricingResult {
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

  let summary = `Estimated pricing for ${meds.length} medication${meds.length > 1 ? 's' : ''}.`;
  if (savings > 0) {
    summary += ` Potential monthly savings: ~$${savings.toFixed(2)}.`;
  }
  summary += ' (Mock estimates - configure GEMINI_API_KEY for AI-powered pricing)';

  // Include context in notes for future debugging
  if (memberState || planId) {
    summary += ` [State: ${memberState || 'N/A'}, Plan: ${planId || 'N/A'}]`;
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

