/**
 * CPT Code Reference Database
 * Common procedure codes with typical pricing ranges
 * Note: In production, this would be a database table with real pricing data
 */

import type { CPTProcedure, FacilityAdjustment, StateAdjustment } from './types';

// Common CPT codes with typical pricing (national averages)
export const CPT_DATABASE: Record<string, CPTProcedure> = {
  // Office Visits
  '99213': {
    code: '99213',
    name: 'Office Visit - Established Patient (Level 3)',
    category: 'office_visit',
    avgCost: 150,
    lowCost: 75,
    highCost: 250,
    typicalMemberSharePct: 20,
  },
  '99214': {
    code: '99214',
    name: 'Office Visit - Established Patient (Level 4)',
    category: 'office_visit',
    avgCost: 225,
    lowCost: 125,
    highCost: 350,
    typicalMemberSharePct: 20,
  },
  '99215': {
    code: '99215',
    name: 'Office Visit - Established Patient (Level 5)',
    category: 'office_visit',
    avgCost: 325,
    lowCost: 200,
    highCost: 500,
    typicalMemberSharePct: 20,
  },
  '99203': {
    code: '99203',
    name: 'Office Visit - New Patient (Level 3)',
    category: 'office_visit',
    avgCost: 200,
    lowCost: 100,
    highCost: 350,
    typicalMemberSharePct: 20,
  },
  '99204': {
    code: '99204',
    name: 'Office Visit - New Patient (Level 4)',
    category: 'office_visit',
    avgCost: 300,
    lowCost: 175,
    highCost: 475,
    typicalMemberSharePct: 20,
  },
  // Emergency/Urgent Care
  '99281': {
    code: '99281',
    name: 'ER Visit - Level 1',
    category: 'emergency',
    avgCost: 250,
    lowCost: 150,
    highCost: 400,
    typicalMemberSharePct: 25,
  },
  '99283': {
    code: '99283',
    name: 'ER Visit - Level 3',
    category: 'emergency',
    avgCost: 750,
    lowCost: 400,
    highCost: 1200,
    typicalMemberSharePct: 25,
  },
  '99285': {
    code: '99285',
    name: 'ER Visit - Level 5 (High Severity)',
    category: 'emergency',
    avgCost: 2500,
    lowCost: 1500,
    highCost: 4000,
    typicalMemberSharePct: 25,
  },
  // Lab Work
  '80053': {
    code: '80053',
    name: 'Comprehensive Metabolic Panel',
    category: 'lab',
    avgCost: 50,
    lowCost: 20,
    highCost: 150,
    typicalMemberSharePct: 10,
  },
  '85025': {
    code: '85025',
    name: 'Complete Blood Count (CBC)',
    category: 'lab',
    avgCost: 35,
    lowCost: 15,
    highCost: 100,
    typicalMemberSharePct: 10,
  },
  '84443': {
    code: '84443',
    name: 'Thyroid Panel (TSH)',
    category: 'lab',
    avgCost: 75,
    lowCost: 30,
    highCost: 200,
    typicalMemberSharePct: 10,
  },
  '82947': {
    code: '82947',
    name: 'Glucose Test',
    category: 'lab',
    avgCost: 25,
    lowCost: 10,
    highCost: 75,
    typicalMemberSharePct: 10,
  },
  // Imaging
  '71046': {
    code: '71046',
    name: 'Chest X-Ray (2 views)',
    category: 'imaging',
    avgCost: 150,
    lowCost: 50,
    highCost: 400,
    typicalMemberSharePct: 20,
  },
  '72148': {
    code: '72148',
    name: 'MRI Lumbar Spine',
    category: 'imaging',
    avgCost: 1500,
    lowCost: 500,
    highCost: 3500,
    typicalMemberSharePct: 25,
  },
  '74177': {
    code: '74177',
    name: 'CT Abdomen/Pelvis with Contrast',
    category: 'imaging',
    avgCost: 1200,
    lowCost: 400,
    highCost: 3000,
    typicalMemberSharePct: 25,
  },
  '76856': {
    code: '76856',
    name: 'Ultrasound - Pelvic',
    category: 'imaging',
    avgCost: 350,
    lowCost: 150,
    highCost: 800,
    typicalMemberSharePct: 20,
  },
  // Surgeries
  '27447': {
    code: '27447',
    name: 'Total Knee Replacement',
    category: 'surgery',
    avgCost: 35000,
    lowCost: 20000,
    highCost: 65000,
    typicalMemberSharePct: 30,
  },
  '27130': {
    code: '27130',
    name: 'Total Hip Replacement',
    category: 'surgery',
    avgCost: 32000,
    lowCost: 18000,
    highCost: 60000,
    typicalMemberSharePct: 30,
  },
  '47562': {
    code: '47562',
    name: 'Laparoscopic Cholecystectomy (Gallbladder)',
    category: 'surgery',
    avgCost: 12000,
    lowCost: 6000,
    highCost: 25000,
    typicalMemberSharePct: 25,
  },
  // Physical Therapy
  '97110': {
    code: '97110',
    name: 'Physical Therapy - Therapeutic Exercise',
    category: 'therapy',
    avgCost: 75,
    lowCost: 40,
    highCost: 150,
    typicalMemberSharePct: 20,
  },
  '97140': {
    code: '97140',
    name: 'Physical Therapy - Manual Therapy',
    category: 'therapy',
    avgCost: 85,
    lowCost: 45,
    highCost: 160,
    typicalMemberSharePct: 20,
  },
  // Mental Health
  '90834': {
    code: '90834',
    name: 'Psychotherapy - 45 minutes',
    category: 'mental_health',
    avgCost: 150,
    lowCost: 80,
    highCost: 250,
    typicalMemberSharePct: 20,
  },
  '90837': {
    code: '90837',
    name: 'Psychotherapy - 60 minutes',
    category: 'mental_health',
    avgCost: 200,
    lowCost: 100,
    highCost: 350,
    typicalMemberSharePct: 20,
  },
  // Preventive Care
  '99395': {
    code: '99395',
    name: 'Annual Wellness Exam (18-39)',
    category: 'preventive',
    avgCost: 200,
    lowCost: 100,
    highCost: 400,
    typicalMemberSharePct: 0, // Fully covered preventive
  },
  '99396': {
    code: '99396',
    name: 'Annual Wellness Exam (40-64)',
    category: 'preventive',
    avgCost: 250,
    lowCost: 125,
    highCost: 450,
    typicalMemberSharePct: 0,
  },
};

// Facility type cost adjustments
export const FACILITY_ADJUSTMENTS: Record<string, FacilityAdjustment> = {
  hospital: {
    type: 'hospital',
    multiplier: 1.5,
    description: 'Hospital facility fees typically add 50% to costs',
  },
  urgent_care: {
    type: 'urgent_care',
    multiplier: 1.1,
    description: 'Urgent care is slightly higher than primary care',
  },
  clinic: {
    type: 'clinic',
    multiplier: 1.0,
    description: 'Standard clinic pricing',
  },
  specialist: {
    type: 'specialist',
    multiplier: 1.25,
    description: 'Specialist visits are typically 25% higher',
  },
  imaging: {
    type: 'imaging',
    multiplier: 0.9,
    description: 'Standalone imaging centers are typically 10% less',
  },
  lab: {
    type: 'lab',
    multiplier: 0.7,
    description: 'Standalone labs are significantly cheaper',
  },
  pharmacy: {
    type: 'pharmacy',
    multiplier: 1.0,
    description: 'Standard pharmacy pricing',
  },
  other: {
    type: 'other',
    multiplier: 1.0,
    description: 'Standard pricing applied',
  },
};

// State cost of living adjustments (simplified)
export const STATE_ADJUSTMENTS: Record<string, StateAdjustment> = {
  // High cost states
  CA: { state: 'CA', costIndex: 1.35 },
  NY: { state: 'NY', costIndex: 1.40 },
  MA: { state: 'MA', costIndex: 1.30 },
  HI: { state: 'HI', costIndex: 1.45 },
  AK: { state: 'AK', costIndex: 1.35 },
  CT: { state: 'CT', costIndex: 1.25 },
  NJ: { state: 'NJ', costIndex: 1.25 },
  MD: { state: 'MD', costIndex: 1.20 },
  WA: { state: 'WA', costIndex: 1.20 },
  DC: { state: 'DC', costIndex: 1.30 },
  // Average cost states
  CO: { state: 'CO', costIndex: 1.10 },
  VA: { state: 'VA', costIndex: 1.10 },
  IL: { state: 'IL', costIndex: 1.05 },
  FL: { state: 'FL', costIndex: 1.05 },
  TX: { state: 'TX', costIndex: 1.00 },
  PA: { state: 'PA', costIndex: 1.00 },
  AZ: { state: 'AZ', costIndex: 1.00 },
  GA: { state: 'GA', costIndex: 0.95 },
  NC: { state: 'NC', costIndex: 0.95 },
  OH: { state: 'OH', costIndex: 0.90 },
  // Lower cost states
  TN: { state: 'TN', costIndex: 0.85 },
  MO: { state: 'MO', costIndex: 0.85 },
  IN: { state: 'IN', costIndex: 0.85 },
  KY: { state: 'KY', costIndex: 0.80 },
  AL: { state: 'AL', costIndex: 0.80 },
  AR: { state: 'AR', costIndex: 0.75 },
  MS: { state: 'MS', costIndex: 0.75 },
  WV: { state: 'WV', costIndex: 0.75 },
  OK: { state: 'OK', costIndex: 0.80 },
};

// Default cost index for states not listed
export const DEFAULT_STATE_COST_INDEX = 1.0;

// Need type to category mapping
export const NEED_TYPE_CATEGORIES: Record<string, string> = {
  medical: 'office_visit',
  emergency: 'emergency',
  surgery: 'surgery',
  lab: 'lab',
  imaging: 'imaging',
  prescription: 'pharmacy',
  dental: 'dental',
  vision: 'vision',
  mental_health: 'mental_health',
  physical_therapy: 'therapy',
  preventive: 'preventive',
  maternity: 'maternity',
  other: 'other',
};

// Average costs by category (for when no CPT codes provided)
export const CATEGORY_AVERAGES: Record<string, { low: number; avg: number; high: number; memberSharePct: number }> = {
  office_visit: { low: 100, avg: 200, high: 400, memberSharePct: 20 },
  emergency: { low: 500, avg: 1500, high: 5000, memberSharePct: 25 },
  surgery: { low: 5000, avg: 15000, high: 50000, memberSharePct: 30 },
  lab: { low: 25, avg: 100, high: 500, memberSharePct: 10 },
  imaging: { low: 200, avg: 800, high: 3000, memberSharePct: 25 },
  pharmacy: { low: 10, avg: 100, high: 500, memberSharePct: 15 },
  dental: { low: 100, avg: 500, high: 2000, memberSharePct: 40 },
  vision: { low: 50, avg: 200, high: 600, memberSharePct: 30 },
  mental_health: { low: 100, avg: 175, high: 350, memberSharePct: 20 },
  therapy: { low: 50, avg: 100, high: 200, memberSharePct: 20 },
  preventive: { low: 0, avg: 0, high: 0, memberSharePct: 0 },
  maternity: { low: 5000, avg: 12000, high: 30000, memberSharePct: 20 },
  other: { low: 100, avg: 500, high: 2000, memberSharePct: 25 },
};

/**
 * Look up CPT code information
 */
export function lookupCPT(code: string): CPTProcedure | null {
  return CPT_DATABASE[code] || null;
}

/**
 * Get facility adjustment multiplier
 */
export function getFacilityMultiplier(facilityType: string): number {
  return FACILITY_ADJUSTMENTS[facilityType]?.multiplier || 1.0;
}

/**
 * Get state cost index
 */
export function getStateCostIndex(state: string): number {
  return STATE_ADJUSTMENTS[state?.toUpperCase()]?.costIndex || DEFAULT_STATE_COST_INDEX;
}

/**
 * Get category averages for a need type
 */
export function getCategoryAverages(needType: string): typeof CATEGORY_AVERAGES[string] {
  const category = NEED_TYPE_CATEGORIES[needType] || 'other';
  return CATEGORY_AVERAGES[category] || CATEGORY_AVERAGES.other;
}
