/**
 * AI Pricing Engine - Type Definitions
 */

export interface PricingInput {
  needType: string;
  description?: string;
  procedureCodes?: string[];
  facilityType?: 'hospital' | 'urgent_care' | 'clinic' | 'specialist' | 'imaging' | 'lab' | 'pharmacy' | 'other';
  facilityName?: string;
  inNetwork?: boolean;
  memberState?: string;
  billedAmount?: number;
  incidentDate?: string;
}

export interface PricingEstimate {
  lowEstimate: number;
  avgEstimate: number;
  highEstimate: number;
  estimatedMemberShare: number;
  estimatedEligibleAmount: number;
  confidenceScore: number;
  pricingMethod: 'cpt_lookup' | 'ml_estimate' | 'historical_avg' | 'rule_based';
  reasoning: PricingReasoning;
}

export interface PricingReasoning {
  factors: PricingFactor[];
  summary: string;
  warnings: string[];
  recommendations: string[];
}

export interface PricingFactor {
  name: string;
  impact: 'increase' | 'decrease' | 'neutral';
  description: string;
  adjustment?: number;
}

export interface CPTProcedure {
  code: string;
  name: string;
  category: string;
  avgCost: number;
  lowCost: number;
  highCost: number;
  typicalMemberSharePct: number;
}

export interface FacilityAdjustment {
  type: string;
  multiplier: number;
  description: string;
}

export interface StateAdjustment {
  state: string;
  costIndex: number; // 1.0 = national average
}
