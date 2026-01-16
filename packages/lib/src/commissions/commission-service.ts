import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

// Commission types (tables may not be in generated types yet)
interface CommissionTier {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  level: number;
  base_rate_pct: number;
  bonus_rate_pct: number | null;
  override_rate_pct: number | null;
  min_personal_production: number | null;
  min_team_production: number | null;
  min_active_members: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CommissionTransaction {
  id: string;
  organization_id: string;
  advisor_id: string;
  enrollment_id: string | null;
  member_id: string | null;
  transaction_type: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  rate_pct: number;
  commission_amount: number;
  source_advisor_id: string | null;
  override_level: number | null;
  status: string;
  paid_at: string | null;
  payout_id: string | null;
  notes: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Advisor {
  id: string;
  commission_tier_id: string | null;
  parent_advisor_id: string | null;
  commission_eligible: boolean | null;
  personal_production: number | null;
  team_production: number | null;
  lifetime_production: number | null;
}

interface Enrollment {
  id: string;
  advisor_id: string | null;
  member_id: string | null;
  premium: number | null;
  status: string;
  created_at: string;
}

export interface CalculateCommissionInput {
  enrollmentId: string;
  advisorId: string;
  grossAmount: number;
  transactionType: 'new_business' | 'renewal' | 'override' | 'bonus' | 'chargeback';
  periodStart: Date;
  periodEnd: Date;
  sourceAdvisorId?: string;
  overrideLevel?: number;
}

export interface CommissionCalculationResult {
  advisorId: string;
  commissionAmount: number;
  ratePct: number;
  tierId: string | null;
  tierName: string | null;
}

export interface GenerateOverridesInput {
  enrollmentId: string;
  sourceAdvisorId: string;
  grossAmount: number;
  periodStart: Date;
  periodEnd: Date;
  maxLevels?: number;
}

export interface AdvisorProductionUpdate {
  advisorId: string;
  addPersonal: number;
  addTeam: number;
}

/**
 * Commission Service Class
 * Handles commission calculations, transaction creation, and payout generation.
 */
export class CommissionService {
  private supabase: SupabaseClient<Database>;
  private organizationId: string;

  constructor(supabase: SupabaseClient<Database>, organizationId: string) {
    this.supabase = supabase;
    this.organizationId = organizationId;
  }

  /**
   * Gets the commission tier for an advisor
   */
  async getAdvisorTier(advisorId: string): Promise<CommissionTier | null> {
    const { data: advisor } = await (this.supabase as any)
      .from('advisors')
      .select('commission_tier_id')
      .eq('id', advisorId)
      .single() as { data: Pick<Advisor, 'commission_tier_id'> | null };

    if (!advisor?.commission_tier_id) return null;

    const { data: tier } = await (this.supabase as any)
      .from('commission_tiers')
      .select('*')
      .eq('id', advisor.commission_tier_id)
      .single();

    return tier || null;
  }

  /**
   * Calculates commission for a single advisor based on their tier
   */
  async calculateCommission(input: CalculateCommissionInput): Promise<CommissionCalculationResult> {
    const tier = await this.getAdvisorTier(input.advisorId);

    let ratePct = 0;

    if (tier) {
      switch (input.transactionType) {
        case 'new_business':
        case 'renewal':
          ratePct = tier.base_rate_pct;
          break;
        case 'override':
          ratePct = tier.override_rate_pct || 0;
          break;
        case 'bonus':
          ratePct = tier.bonus_rate_pct || 0;
          break;
        case 'chargeback':
          // Chargebacks use the same rate as original commission
          ratePct = tier.base_rate_pct;
          break;
      }
    }

    const commissionAmount = (input.grossAmount * ratePct) / 100;

    return {
      advisorId: input.advisorId,
      commissionAmount: input.transactionType === 'chargeback' ? -commissionAmount : commissionAmount,
      ratePct,
      tierId: tier?.id || null,
      tierName: tier?.name || null,
    };
  }

  /**
   * Creates a commission transaction record
   */
  async createCommissionTransaction(
    input: CalculateCommissionInput,
    calculation: CommissionCalculationResult,
    enrollmentId?: string,
    memberId?: string
  ): Promise<CommissionTransaction | null> {
    const { data, error } = await (this.supabase as any)
      .from('commission_transactions')
      .insert({
        organization_id: this.organizationId,
        advisor_id: input.advisorId,
        enrollment_id: enrollmentId || null,
        member_id: memberId || null,
        transaction_type: input.transactionType,
        period_start: input.periodStart.toISOString().split('T')[0],
        period_end: input.periodEnd.toISOString().split('T')[0],
        gross_amount: input.grossAmount,
        rate_pct: calculation.ratePct,
        commission_amount: calculation.commissionAmount,
        source_advisor_id: input.sourceAdvisorId || null,
        override_level: input.overrideLevel || null,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating commission transaction:', error);
      return null;
    }

    return data as CommissionTransaction;
  }

  /**
   * Generates override commissions for the upline chain
   */
  async generateOverrides(input: GenerateOverridesInput): Promise<CommissionTransaction[]> {
    const maxLevels = input.maxLevels ?? 5;
    const transactions: CommissionTransaction[] = [];

    let currentAdvisorId = input.sourceAdvisorId;
    let level = 1;

    while (level <= maxLevels) {
      // Get the parent advisor
      const { data: advisor } = await this.supabase
        .from('advisors')
        .select('parent_advisor_id, commission_eligible')
        .eq('id', currentAdvisorId)
        .single() as { data: Pick<Advisor, 'parent_advisor_id' | 'commission_eligible'> | null };

      if (!advisor?.parent_advisor_id) break;

      // Check if parent is commission eligible
      const { data: parentAdvisor } = await (this.supabase as any)
        .from('advisors')
        .select('id, commission_eligible')
        .eq('id', advisor.parent_advisor_id)
        .single() as { data: Pick<Advisor, 'id' | 'commission_eligible'> | null };

      if (!parentAdvisor || !parentAdvisor.commission_eligible) {
        currentAdvisorId = advisor.parent_advisor_id;
        continue;
      }

      // Calculate override commission for the parent
      const calculationInput: CalculateCommissionInput = {
        enrollmentId: input.enrollmentId,
        advisorId: parentAdvisor.id,
        grossAmount: input.grossAmount,
        transactionType: 'override',
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        sourceAdvisorId: input.sourceAdvisorId,
        overrideLevel: level,
      };

      const calculation = await this.calculateCommission(calculationInput);

      if (calculation.commissionAmount > 0) {
        const transaction = await this.createCommissionTransaction(
          calculationInput,
          calculation,
          input.enrollmentId,
          undefined
        );

        if (transaction) {
          transactions.push(transaction);
        }
      }

      currentAdvisorId = advisor.parent_advisor_id;
      level++;
    }

    return transactions;
  }

  /**
   * Processes an enrollment for commission calculation
   * Creates commission for the direct agent and generates overrides
   */
  async processEnrollmentCommissions(enrollmentId: string): Promise<CommissionTransaction[]> {
    // Get enrollment details
    const { data: enrollment } = await (this.supabase as any)
      .from('enrollments')
      .select('id, advisor_id, member_id, premium, status, created_at')
      .eq('id', enrollmentId)
      .single() as { data: Pick<Enrollment, 'id' | 'advisor_id' | 'member_id' | 'premium' | 'status' | 'created_at'> | null };

    if (!enrollment || !enrollment.advisor_id) {
      console.error('Enrollment not found or no advisor assigned');
      return [];
    }

    const periodStart = new Date();
    periodStart.setDate(1); // First of current month
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0); // Last day of month

    const grossAmount = enrollment.premium || 0;
    const transactions: CommissionTransaction[] = [];

    // Check if advisor is commission eligible
    const { data: advisor } = await (this.supabase as any)
      .from('advisors')
      .select('commission_eligible')
      .eq('id', enrollment.advisor_id)
      .single() as { data: Pick<Advisor, 'commission_eligible'> | null };

    if (advisor?.commission_eligible) {
      // Calculate direct commission
      const directInput: CalculateCommissionInput = {
        enrollmentId,
        advisorId: enrollment.advisor_id,
        grossAmount,
        transactionType: 'new_business',
        periodStart,
        periodEnd,
      };

      const directCalculation = await this.calculateCommission(directInput);
      const directTransaction = await this.createCommissionTransaction(
        directInput,
        directCalculation,
        enrollmentId,
        enrollment.member_id || undefined
      );

      if (directTransaction) {
        transactions.push(directTransaction);
      }
    }

    // Generate override commissions for upline
    const overrides = await this.generateOverrides({
      enrollmentId,
      sourceAdvisorId: enrollment.advisor_id,
      grossAmount,
      periodStart,
      periodEnd,
    });

    transactions.push(...overrides);

    // Update advisor production
    await this.updateAdvisorProduction({
      advisorId: enrollment.advisor_id,
      addPersonal: grossAmount,
      addTeam: 0,
    });

    // Update upline team production
    let currentAdvisorId = enrollment.advisor_id;
    while (true) {
      const { data: currentAdvisor } = await (this.supabase as any)
        .from('advisors')
        .select('parent_advisor_id')
        .eq('id', currentAdvisorId)
        .single() as { data: Pick<Advisor, 'parent_advisor_id'> | null };

      if (!currentAdvisor?.parent_advisor_id) break;

      await this.updateAdvisorProduction({
        advisorId: currentAdvisor.parent_advisor_id,
        addPersonal: 0,
        addTeam: grossAmount,
      });

      currentAdvisorId = currentAdvisor.parent_advisor_id;
    }

    return transactions;
  }

  /**
   * Updates an advisor's production totals
   */
  async updateAdvisorProduction(update: AdvisorProductionUpdate): Promise<void> {
    const { data: current } = await (this.supabase as any)
      .from('advisors')
      .select('personal_production, team_production, lifetime_production')
      .eq('id', update.advisorId)
      .single() as { data: Pick<Advisor, 'personal_production' | 'team_production' | 'lifetime_production'> | null };

    if (!current) return;

    const newPersonal = (current.personal_production || 0) + update.addPersonal;
    const newTeam = (current.team_production || 0) + update.addTeam;
    const newLifetime = (current.lifetime_production || 0) + update.addPersonal;

    await (this.supabase as any)
      .from('advisors')
      .update({
        personal_production: newPersonal,
        team_production: newTeam,
        lifetime_production: newLifetime,
      })
      .eq('id', update.advisorId);
  }

  /**
   * Generates payout records for approved commissions
   */
  async generatePayouts(periodStart: Date, periodEnd: Date): Promise<number> {
    // Get all approved transactions without a payout
    const { data: transactions } = await (this.supabase as any)
      .from('commission_transactions')
      .select('advisor_id, commission_amount, transaction_type')
      .eq('organization_id', this.organizationId)
      .eq('status', 'approved')
      .is('payout_id', null);

    if (!transactions || transactions.length === 0) return 0;

    // Group by advisor
    const byAdvisor: Record<string, {
      total: number;
      overrides: number;
      bonuses: number;
      chargebacks: number;
    }> = {};

    for (const tx of transactions) {
      if (!tx.advisor_id) continue;

      if (!byAdvisor[tx.advisor_id]) {
        byAdvisor[tx.advisor_id] = { total: 0, overrides: 0, bonuses: 0, chargebacks: 0 };
      }

      const amount = tx.commission_amount || 0;

      switch (tx.transaction_type) {
        case 'override':
          byAdvisor[tx.advisor_id].overrides += amount;
          break;
        case 'bonus':
          byAdvisor[tx.advisor_id].bonuses += amount;
          break;
        case 'chargeback':
          byAdvisor[tx.advisor_id].chargebacks += Math.abs(amount);
          break;
        default:
          byAdvisor[tx.advisor_id].total += amount;
      }
    }

    // Create payout records
    let created = 0;
    for (const [advisorId, amounts] of Object.entries(byAdvisor)) {
      const netPayout = amounts.total + amounts.overrides + amounts.bonuses - amounts.chargebacks;

      if (netPayout <= 0) continue;

      const { error } = await (this.supabase as any)
        .from('commission_payouts')
        .insert({
          organization_id: this.organizationId,
          advisor_id: advisorId,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          total_commissions: amounts.total,
          total_overrides: amounts.overrides,
          total_bonuses: amounts.bonuses,
          total_chargebacks: amounts.chargebacks,
          net_payout: netPayout,
          status: 'draft',
        });

      if (!error) created++;
    }

    return created;
  }

  /**
   * Gets commission statistics for the organization
   */
  async getCommissionStats(): Promise<{
    pendingAmount: number;
    approvedAmount: number;
    paidThisMonth: number;
    activeTiers: number;
    pendingPayouts: number;
  }> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [pendingResult, approvedResult, paidResult, tiersResult, payoutsResult] = await Promise.all([
      (this.supabase as any)
        .from('commission_transactions')
        .select('commission_amount')
        .eq('organization_id', this.organizationId)
        .eq('status', 'pending'),
      (this.supabase as any)
        .from('commission_transactions')
        .select('commission_amount')
        .eq('organization_id', this.organizationId)
        .eq('status', 'approved'),
      (this.supabase as any)
        .from('commission_transactions')
        .select('commission_amount')
        .eq('organization_id', this.organizationId)
        .eq('status', 'paid')
        .gte('paid_at', monthStart.toISOString()),
      (this.supabase as any)
        .from('commission_tiers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', this.organizationId)
        .eq('is_active', true),
      (this.supabase as any)
        .from('commission_payouts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', this.organizationId)
        .in('status', ['draft', 'pending', 'approved']),
    ]);

    const sum = (data: { commission_amount: number | null }[] | null) =>
      (data || []).reduce((acc, t) => acc + (t.commission_amount || 0), 0);

    return {
      pendingAmount: sum(pendingResult.data as any),
      approvedAmount: sum(approvedResult.data as any),
      paidThisMonth: sum(paidResult.data as any),
      activeTiers: tiersResult.count ?? 0,
      pendingPayouts: payoutsResult.count ?? 0,
    };
  }
}

export function createCommissionService(
  supabase: SupabaseClient<Database>,
  organizationId: string
): CommissionService {
  return new CommissionService(supabase, organizationId);
}
