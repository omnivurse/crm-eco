/**
 * AI Pricing Estimator
 * Generates cost estimates for healthcare needs based on multiple factors
 */

import type { PricingInput, PricingEstimate, PricingFactor } from './types';
import {
  lookupCPT,
  getFacilityMultiplier,
  getStateCostIndex,
  getCategoryAverages,
  FACILITY_ADJUSTMENTS,
  STATE_ADJUSTMENTS,
} from './cptDatabase';

/**
 * Generate a pricing estimate for a healthcare need
 */
export async function generatePricingEstimate(input: PricingInput): Promise<PricingEstimate> {
  const factors: PricingFactor[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  let baseLow = 0;
  let baseAvg = 0;
  let baseHigh = 0;
  let memberSharePct = 20;
  let confidenceScore = 50;
  let pricingMethod: PricingEstimate['pricingMethod'] = 'rule_based';

  // 1. Try CPT code lookup first (highest confidence)
  if (input.procedureCodes && input.procedureCodes.length > 0) {
    let cptTotal = { low: 0, avg: 0, high: 0, memberShare: 0, count: 0 };

    for (const code of input.procedureCodes) {
      const cpt = lookupCPT(code);
      if (cpt) {
        cptTotal.low += cpt.lowCost;
        cptTotal.avg += cpt.avgCost;
        cptTotal.high += cpt.highCost;
        cptTotal.memberShare += cpt.typicalMemberSharePct;
        cptTotal.count++;

        factors.push({
          name: `CPT ${code}`,
          impact: 'neutral',
          description: `${cpt.name}: $${cpt.avgCost.toLocaleString()} average`,
        });
      } else {
        warnings.push(`CPT code ${code} not found in database`);
      }
    }

    if (cptTotal.count > 0) {
      baseLow = cptTotal.low;
      baseAvg = cptTotal.avg;
      baseHigh = cptTotal.high;
      memberSharePct = cptTotal.memberShare / cptTotal.count;
      confidenceScore = 80;
      pricingMethod = 'cpt_lookup';
    }
  }

  // 2. Fall back to category-based estimation
  if (baseAvg === 0 && input.needType) {
    const categoryAvg = getCategoryAverages(input.needType);
    baseLow = categoryAvg.low;
    baseAvg = categoryAvg.avg;
    baseHigh = categoryAvg.high;
    memberSharePct = categoryAvg.memberSharePct;
    confidenceScore = 40;
    pricingMethod = 'rule_based';

    factors.push({
      name: 'Category Average',
      impact: 'neutral',
      description: `Based on typical ${input.needType} costs`,
    });
  }

  // 3. If we have a billed amount, use it as the primary estimate
  if (input.billedAmount && input.billedAmount > 0) {
    // Billed amount becomes our anchor
    baseAvg = input.billedAmount;
    baseLow = input.billedAmount * 0.7; // Negotiated/cash pay could be 30% less
    baseHigh = input.billedAmount * 1.2; // Some facilities charge more
    confidenceScore = 90;
    pricingMethod = 'ml_estimate';

    factors.push({
      name: 'Billed Amount',
      impact: 'neutral',
      description: `Actual billed amount of $${input.billedAmount.toLocaleString()}`,
    });
  }

  // 4. Apply facility type adjustment
  if (input.facilityType) {
    const multiplier = getFacilityMultiplier(input.facilityType);
    const adjustment = FACILITY_ADJUSTMENTS[input.facilityType];

    if (multiplier !== 1.0) {
      baseLow *= multiplier;
      baseAvg *= multiplier;
      baseHigh *= multiplier;

      factors.push({
        name: 'Facility Type',
        impact: multiplier > 1 ? 'increase' : 'decrease',
        description: adjustment?.description || `${input.facilityType} facility adjustment`,
        adjustment: (multiplier - 1) * 100,
      });
    }
  }

  // 5. Apply state/geographic adjustment
  if (input.memberState) {
    const costIndex = getStateCostIndex(input.memberState);
    const stateInfo = STATE_ADJUSTMENTS[input.memberState?.toUpperCase()];

    if (costIndex !== 1.0) {
      baseLow *= costIndex;
      baseAvg *= costIndex;
      baseHigh *= costIndex;

      factors.push({
        name: 'Geographic Adjustment',
        impact: costIndex > 1 ? 'increase' : 'decrease',
        description: `${input.memberState} has ${costIndex > 1 ? 'higher' : 'lower'} healthcare costs than average`,
        adjustment: (costIndex - 1) * 100,
      });
    }
  }

  // 6. Apply in-network adjustment
  if (input.inNetwork === false) {
    const outOfNetworkMultiplier = 1.5;
    baseLow *= outOfNetworkMultiplier;
    baseAvg *= outOfNetworkMultiplier;
    baseHigh *= outOfNetworkMultiplier;
    memberSharePct = Math.min(memberSharePct * 1.5, 50);

    factors.push({
      name: 'Out-of-Network',
      impact: 'increase',
      description: 'Out-of-network providers typically cost 50% more',
      adjustment: 50,
    });

    warnings.push('Out-of-network care may have higher member responsibility');
    recommendations.push('Consider using an in-network provider if possible');
  }

  // 7. Calculate final estimates
  const estimatedMemberShare = baseAvg * (memberSharePct / 100);
  const estimatedEligibleAmount = baseAvg - estimatedMemberShare;

  // 8. Generate recommendations
  if (input.needType === 'imaging' && input.facilityType === 'hospital') {
    recommendations.push('Standalone imaging centers are often 30-50% cheaper than hospital imaging');
  }

  if (input.needType === 'lab' && input.facilityType === 'hospital') {
    recommendations.push('Quest or LabCorp locations are typically 50-70% cheaper than hospital labs');
  }

  if (baseAvg > 5000) {
    recommendations.push('For high-cost procedures, consider requesting a pre-authorization');
  }

  // 9. Build summary
  const summary = buildSummary(input, baseAvg, confidenceScore, pricingMethod);

  return {
    lowEstimate: Math.round(baseLow * 100) / 100,
    avgEstimate: Math.round(baseAvg * 100) / 100,
    highEstimate: Math.round(baseHigh * 100) / 100,
    estimatedMemberShare: Math.round(estimatedMemberShare * 100) / 100,
    estimatedEligibleAmount: Math.round(estimatedEligibleAmount * 100) / 100,
    confidenceScore: Math.round(confidenceScore),
    pricingMethod,
    reasoning: {
      factors,
      summary,
      warnings,
      recommendations,
    },
  };
}

function buildSummary(
  input: PricingInput,
  avgEstimate: number,
  confidenceScore: number,
  method: string
): string {
  const confidenceLevel = confidenceScore >= 80 ? 'high' : confidenceScore >= 50 ? 'moderate' : 'low';

  let methodDescription = '';
  switch (method) {
    case 'cpt_lookup':
      methodDescription = 'CPT code pricing data';
      break;
    case 'ml_estimate':
      methodDescription = 'the provided billed amount';
      break;
    case 'historical_avg':
      methodDescription = 'historical claims data';
      break;
    default:
      methodDescription = 'category-based averages';
  }

  let summary = `Estimated cost of $${avgEstimate.toLocaleString()} based on ${methodDescription}`;

  if (input.facilityType) {
    summary += ` at a ${input.facilityType.replace('_', ' ')}`;
  }

  if (input.memberState) {
    summary += ` in ${input.memberState}`;
  }

  summary += `. Confidence: ${confidenceLevel}.`;

  return summary;
}

/**
 * Analyze a description to suggest CPT codes
 * This is a simplified keyword-based approach; in production, this would use ML/NLP
 */
export function suggestProcedureCodes(description: string): string[] {
  const normalizedDesc = description.toLowerCase();
  const suggestions: string[] = [];

  // Simple keyword matching (in production, use ML model)
  const keywordMappings: Record<string, string[]> = {
    'office visit': ['99213', '99214'],
    'checkup': ['99395', '99396'],
    'physical': ['99395', '99396'],
    'wellness': ['99395', '99396'],
    'emergency': ['99283', '99285'],
    'er visit': ['99283', '99285'],
    'urgent care': ['99213', '99214'],
    'blood test': ['85025', '80053'],
    'blood work': ['85025', '80053'],
    'lab work': ['85025', '80053'],
    'cbc': ['85025'],
    'metabolic panel': ['80053'],
    'thyroid': ['84443'],
    'x-ray': ['71046'],
    'xray': ['71046'],
    'chest x-ray': ['71046'],
    'mri': ['72148'],
    'ct scan': ['74177'],
    'ultrasound': ['76856'],
    'knee replacement': ['27447'],
    'hip replacement': ['27130'],
    'gallbladder': ['47562'],
    'cholecystectomy': ['47562'],
    'physical therapy': ['97110', '97140'],
    'pt': ['97110', '97140'],
    'therapy': ['90834', '90837'],
    'counseling': ['90834', '90837'],
    'psychotherapy': ['90834', '90837'],
  };

  for (const [keyword, codes] of Object.entries(keywordMappings)) {
    if (normalizedDesc.includes(keyword)) {
      suggestions.push(...codes);
    }
  }

  // Remove duplicates
  return [...new Set(suggestions)];
}

/**
 * Batch estimate multiple needs
 */
export async function batchEstimate(
  inputs: PricingInput[]
): Promise<Map<number, PricingEstimate>> {
  const results = new Map<number, PricingEstimate>();

  for (let i = 0; i < inputs.length; i++) {
    results.set(i, await generatePricingEstimate(inputs[i]));
  }

  return results;
}
