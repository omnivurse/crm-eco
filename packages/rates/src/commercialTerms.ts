export type BillingPeriod = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
export type BillingTiming = 'advance' | 'arrears';

export interface GroupSizeDiscount {
  min_lives: number;
  percent?: number;
  amount?: number;
}

export interface CommercialTerms {
  billing_timing?: BillingTiming;
  default_period?: BillingPeriod;
  period_discounts?: Partial<Record<BillingPeriod, number>>;
  registration_fee_family_max?: number;
  group_size_discounts?: GroupSizeDiscount[];
  min_age_years?: number;
  max_age_years?: number;
}

export interface CommercialQuoteAdjustment {
  monthlyPremium: number;
  oneTimeFees: Array<{ id: string; label: string; amount: number; meta?: Record<string, unknown> }>;
  breakdown: Array<{ label: string; amount: number; meta?: Record<string, unknown> }>;
  period?: BillingPeriod;
  periodAmount?: number;
  billingTiming?: BillingTiming;
}

export function parseCommercialTerms(value: unknown): CommercialTerms | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const terms: CommercialTerms = {};

  if (raw.billing_timing === 'advance' || raw.billing_timing === 'arrears') {
    terms.billing_timing = raw.billing_timing;
  }
  if (
    raw.default_period === 'monthly' ||
    raw.default_period === 'quarterly' ||
    raw.default_period === 'semi_annual' ||
    raw.default_period === 'annual'
  ) {
    terms.default_period = raw.default_period;
  }
  if (raw.period_discounts && typeof raw.period_discounts === 'object') {
    terms.period_discounts = raw.period_discounts as CommercialTerms['period_discounts'];
  }
  if (typeof raw.registration_fee_family_max === 'number' && raw.registration_fee_family_max >= 0) {
    terms.registration_fee_family_max = raw.registration_fee_family_max;
  }
  if (Array.isArray(raw.group_size_discounts)) {
    terms.group_size_discounts = raw.group_size_discounts.filter(
      (row): row is GroupSizeDiscount =>
        !!row && typeof row === 'object' && typeof (row as GroupSizeDiscount).min_lives === 'number'
    );
  }
  if (typeof raw.min_age_years === 'number') terms.min_age_years = raw.min_age_years;
  if (typeof raw.max_age_years === 'number') terms.max_age_years = raw.max_age_years;

  return Object.keys(terms).length > 0 ? terms : undefined;
}

export function periodMonths(period: BillingPeriod): number {
  switch (period) {
    case 'quarterly':
      return 3;
    case 'semi_annual':
      return 6;
    case 'annual':
      return 12;
    default:
      return 1;
  }
}

export function householdLives(input: {
  coverageTier: string;
  household: { spouseAge?: number; dependentAges?: number[] };
}): number {
  let lives = 1;
  if (input.coverageTier === 'member_spouse' || input.coverageTier === 'family') {
    if (input.household.spouseAge != null) lives += 1;
  }
  if (input.coverageTier === 'member_children' || input.coverageTier === 'family') {
    lives += input.household.dependentAges?.length ?? 0;
  }
  return lives;
}

export function applyGroupSizeDiscount(
  monthly: number,
  lives: number,
  tiers: GroupSizeDiscount[] | undefined
): { monthly: number; discount: number; tier?: GroupSizeDiscount } {
  if (!tiers?.length) return { monthly, discount: 0 };
  const applicable = [...tiers]
    .filter((t) => lives >= t.min_lives)
    .sort((a, b) => b.min_lives - a.min_lives)[0];
  if (!applicable) return { monthly, discount: 0 };

  const percentOff = Number(applicable.percent) || 0;
  const amountOff = Number(applicable.amount) || 0;
  const discount = round(monthly * (percentOff / 100) + amountOff);
  return { monthly: round(Math.max(0, monthly - discount)), discount, tier: applicable };
}

export function applyPeriodAmount(
  monthly: number,
  period: BillingPeriod,
  discountPercent = 0
): number {
  const raw = monthly * periodMonths(period);
  const safeDiscount = Number.isFinite(discountPercent) ? Math.min(100, Math.max(0, discountPercent)) : 0;
  return round(raw * (1 - safeDiscount / 100));
}

export function capRegistrationFees<T extends { id: string; label: string; amount: number; meta?: Record<string, unknown> }>(
  fees: T[],
  familyMax?: number
): { fees: T[]; cappedBy: number } {
  if (familyMax == null || !Number.isFinite(familyMax)) return { fees, cappedBy: 0 };
  const registrational = fees.filter((f) => isRegistrationFee(f));
  const others = fees.filter((f) => !isRegistrationFee(f));
  const total = registrational.reduce((sum, f) => sum + f.amount, 0);
  if (total <= familyMax) return { fees, cappedBy: 0 };

  const scale = familyMax / total;
  const capped = registrational.map((f) => ({ ...f, amount: round(f.amount * scale) }));
  return { fees: [...others, ...capped], cappedBy: round(total - familyMax) };
}

export function commercialAgeErrors(
  terms: CommercialTerms | undefined,
  household: { memberAge?: number; spouseAge?: number }
): Array<{ code: string; message: string; path?: string }> {
  if (!terms) return [];
  const errors: Array<{ code: string; message: string; path?: string }> = [];
  const check = (age: number | undefined, path: string) => {
    if (age == null || !Number.isFinite(age)) return;
    if (terms.min_age_years != null && age < terms.min_age_years) {
      errors.push({
        code: 'AGE_BELOW_MIN',
        message: `Age must be at least ${terms.min_age_years}`,
        path,
      });
    }
    if (terms.max_age_years != null && age > terms.max_age_years) {
      errors.push({
        code: 'AGE_ABOVE_MAX',
        message: `Age must be at most ${terms.max_age_years}`,
        path,
      });
    }
  };
  check(household.memberAge, 'household.memberAge');
  check(household.spouseAge, 'household.spouseAge');
  return errors;
}

export function applyCommercialTerms<
  TFee extends { id: string; label: string; amount: number; meta?: Record<string, unknown> },
>(input: {
  terms?: CommercialTerms;
  monthlyPremium: number;
  oneTimeFees: TFee[];
  coverageTier: string;
  household: { spouseAge?: number; dependentAges?: number[] };
  period?: BillingPeriod;
}): CommercialQuoteAdjustment {
  const terms = input.terms;
  if (!terms) {
    return { monthlyPremium: input.monthlyPremium, oneTimeFees: input.oneTimeFees, breakdown: [] };
  }

  const breakdown: CommercialQuoteAdjustment['breakdown'] = [];
  const lives = householdLives(input);
  const grouped = applyGroupSizeDiscount(input.monthlyPremium, lives, terms.group_size_discounts);
  if (grouped.discount > 0) {
    breakdown.push({
      label: `Group-size discount (${lives} lives)`,
      amount: -grouped.discount,
      meta: { min_lives: grouped.tier?.min_lives },
    });
  }

  const capped = capRegistrationFees(input.oneTimeFees, terms.registration_fee_family_max);
  if (capped.cappedBy > 0) {
    breakdown.push({
      label: 'Registration fee family max',
      amount: -capped.cappedBy,
      meta: { family_max: terms.registration_fee_family_max },
    });
  }

  const period =
    terms.billing_timing === 'arrears'
      ? 'monthly'
      : input.period ?? terms.default_period ?? 'monthly';
  const periodDiscount = terms.period_discounts?.[period] ?? 0;
  const periodAmount = applyPeriodAmount(grouped.monthly, period, periodDiscount);

  return {
    monthlyPremium: grouped.monthly,
    oneTimeFees: capped.fees,
    breakdown,
    period,
    periodAmount,
    billingTiming: terms.billing_timing ?? 'advance',
  };
}

function isRegistrationFee(fee: { id: string; label: string }): boolean {
  const hay = `${fee.id} ${fee.label}`.toLowerCase();
  return hay.includes('registration') || hay.includes('enrollment');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
