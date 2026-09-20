export const CORE_MEMBERSHIP_CODE = 'core_membership';

export type CoverageTreatment =
  | 'included'
  | 'included_under'
  | 'quantity_limit'
  | 'percent_discount'
  | 'flat_amount'
  | 'pass_through'
  | 'not_covered';

export type CoveragePayer = 'member' | 'sponsor';

export type ChargeCategory = 'membership' | 'registration' | 'visit' | 'lab' | 'other';

export interface ChargeItem {
  code: string;
  name: string;
  category: ChargeCategory;
  list_amount: number;
}

export interface CoverageRule {
  charge_item_code: string;
  treatment: CoverageTreatment;
  who_pays: CoveragePayer;
  threshold_amount?: number;
  quantity_limit?: number;
  percent?: number;
  flat_amount?: number;
}

export interface CoverageConfig {
  items: ChargeItem[];
  rules: CoverageRule[];
}

export interface ChargeInput {
  code: string;
  name?: string;
  listAmount: number;
  quantity?: number;
}

export interface CoverageLine {
  code: string;
  name: string;
  listAmount: number;
  quantity: number;
  treatment: CoverageTreatment;
  whoPays: CoveragePayer;
  memberPays: number;
  sponsorPays: number;
  planAbsorbed: number;
}

export interface CoverageAllocation {
  lines: CoverageLine[];
  memberTotal: number;
  sponsorTotal: number;
  planAbsorbed: number;
}

const TREATMENTS: CoverageTreatment[] = [
  'included',
  'included_under',
  'quantity_limit',
  'percent_discount',
  'flat_amount',
  'pass_through',
  'not_covered',
];

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function parseCoverageConfig(value: unknown): CoverageConfig | undefined {
  const raw = asRecord(value);
  const nested = asRecord(raw.coverage);
  const source = Array.isArray(raw.rules) || Array.isArray(raw.items) ? raw : nested;

  const items = Array.isArray(source.items)
    ? source.items.flatMap((row) => {
        const item = asRecord(row);
        const code = typeof item.code === 'string' ? item.code.trim() : '';
        const name = typeof item.name === 'string' ? item.name.trim() : code;
        const list_amount = asNumber(item.list_amount);
        if (!code || list_amount === undefined) return [];
        const category: ChargeCategory =
          item.category === 'registration' ||
          item.category === 'visit' ||
          item.category === 'lab' ||
          item.category === 'membership'
            ? item.category
            : 'other';
        return [{ code, name: name || code, category, list_amount: round(list_amount) }];
      })
    : [];

  const rules = Array.isArray(source.rules)
    ? source.rules.flatMap((row) => {
        const rule = asRecord(row);
        const charge_item_code =
          typeof rule.charge_item_code === 'string' ? rule.charge_item_code.trim() : '';
        const treatment = TREATMENTS.includes(rule.treatment as CoverageTreatment)
          ? (rule.treatment as CoverageTreatment)
          : null;
        const who_pays = rule.who_pays === 'sponsor' ? 'sponsor' : rule.who_pays === 'member' ? 'member' : null;
        if (!charge_item_code || !treatment || !who_pays) return [];
        const parsed: CoverageRule = { charge_item_code, treatment, who_pays };
        const threshold = asNumber(rule.threshold_amount);
        const quantityLimit = asNumber(rule.quantity_limit);
        const percent = asNumber(rule.percent);
        const flat = asNumber(rule.flat_amount);
        if (threshold !== undefined) parsed.threshold_amount = threshold;
        if (quantityLimit !== undefined) parsed.quantity_limit = quantityLimit;
        if (percent !== undefined) parsed.percent = percent;
        if (flat !== undefined) parsed.flat_amount = flat;
        return [parsed];
      })
    : [];

  if (items.length === 0 && rules.length === 0) return undefined;
  return { items, rules };
}

export function findCoverageRule(
  config: CoverageConfig | undefined,
  code: string,
): CoverageRule | undefined {
  return config?.rules.find((rule) => rule.charge_item_code === code);
}

export function applyCoverageToCharge(
  charge: ChargeInput,
  config?: CoverageConfig,
): CoverageLine {
  const quantity = Math.max(1, Math.round(Number(charge.quantity) || 1));
  const unit = Number(charge.listAmount) || 0;
  const total = round(unit * quantity);
  const item = config?.items.find((row) => row.code === charge.code);
  const name = charge.name || item?.name || charge.code;
  const rule = findCoverageRule(config, charge.code);

  if (!rule) {
    return {
      code: charge.code,
      name,
      listAmount: total,
      quantity,
      treatment: 'pass_through',
      whoPays: 'member',
      memberPays: total,
      sponsorPays: 0,
      planAbsorbed: 0,
    };
  }

  let remaining = total;
  let planAbsorbed = 0;
  let memberExtra = 0;

  switch (rule.treatment) {
    case 'included':
      planAbsorbed = total;
      remaining = 0;
      break;
    case 'included_under': {
      const threshold = Number(rule.threshold_amount) || 0;
      if (total <= threshold) {
        planAbsorbed = total;
        remaining = 0;
      }
      break;
    }
    case 'quantity_limit': {
      const limit = Math.max(0, Math.round(Number(rule.quantity_limit) || 0));
      const coveredQty = Math.min(quantity, limit);
      const extraQty = Math.max(0, quantity - limit);
      remaining = round(unit * coveredQty);
      memberExtra = round(unit * extraQty);
      break;
    }
    case 'percent_discount': {
      const percent = Math.min(100, Math.max(0, Number(rule.percent) || 0));
      remaining = round(total * (1 - percent / 100));
      planAbsorbed = round(total - remaining);
      break;
    }
    case 'flat_amount': {
      const flat = Math.max(0, Number(rule.flat_amount) || 0);
      remaining = round(Math.max(0, total - flat));
      planAbsorbed = round(total - remaining);
      break;
    }
    case 'pass_through':
    case 'not_covered':
    default:
      remaining = total;
      break;
  }

  const memberPays = round((rule.who_pays === 'member' ? remaining : 0) + memberExtra);
  const sponsorPays = round(rule.who_pays === 'sponsor' ? remaining : 0);

  return {
    code: charge.code,
    name,
    listAmount: total,
    quantity,
    treatment: rule.treatment,
    whoPays: rule.who_pays,
    memberPays,
    sponsorPays,
    planAbsorbed,
  };
}

export function applyCoverageToCharges(
  charges: ChargeInput[],
  config?: CoverageConfig,
): CoverageAllocation {
  const lines = charges.map((charge) => applyCoverageToCharge(charge, config));
  return {
    lines,
    memberTotal: round(lines.reduce((sum, line) => sum + line.memberPays, 0)),
    sponsorTotal: round(lines.reduce((sum, line) => sum + line.sponsorPays, 0)),
    planAbsorbed: round(lines.reduce((sum, line) => sum + line.planAbsorbed, 0)),
  };
}

/** Sponsor invoices keep today's full amount when no rule exists. */
export function sponsorInvoiceAmount(
  listAmount: number,
  config: CoverageConfig | undefined,
  code = CORE_MEMBERSHIP_CODE,
): number {
  if (!findCoverageRule(config, code)) return round(Number(listAmount) || 0);
  return applyCoverageToCharge({ code, listAmount }, config).sponsorPays;
}
