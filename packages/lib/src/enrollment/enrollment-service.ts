import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../types';
import { logEnrollmentAudit } from './audit';

type Enrollment = Database['public']['Tables']['enrollments']['Row'];

export interface CreateEnrollmentPayload {
  organizationId: string;
  primaryMemberId: string;
  advisorId?: string | null;
  selectedPlanId: string;
  effectiveDate: string;
  householdSize?: number;
  baseMonthlyCoat: number;
  permanentBillDay?: number;
  dependents?: Array<{
    dependentId: string;
    relationship: string;
    additionalCost?: number;
  }>;
  enrollmentSource?: string;
  channel?: string;
  customFields?: { [key: string]: Json | undefined };
  actorProfileId?: string;
  /**
   * Idempotency key for exactly-once enrollment creation. When supplied, a repeated
   * submit with the same (organization, key) returns the existing enrollment instead
   * of creating a duplicate (enforced by create_enrollment_tx + a partial unique index,
   * migration 202605300013). Derive from a stable per-submit token (wizard draft id,
   * etc.) — NOT from a fresh random value per call.
   */
  idempotencyKey?: string;
}

export interface ChangePlanPayload {
  enrollmentId: string;
  organizationId: string;
  newPlanId: string;
  newBaseMonthlyCoat: number;
  effectiveDate: string;
  inactiveReason?: string;
  actorProfileId?: string;
}

export interface CancelEnrollmentPayload {
  enrollmentId: string;
  organizationId: string;
  inactiveReason: string;
  endDate?: string;
  actorProfileId?: string;
}

/**
 * Domain service for enrollment lifecycle operations.
 * All mutating operations are wrapped in transactions via RPC where possible.
 */
export class EnrollmentService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a new enrollment with dependents in a single transaction.
   * Uses the `create_enrollment_tx` RPC for atomicity.
   */
  async createEnrollment(payload: CreateEnrollmentPayload): Promise<{ enrollment: Enrollment }> {
    const { data, error } = await this.supabase.rpc('create_enrollment_tx', {
      p_org_id: payload.organizationId,
      p_payload: {
        primary_member_id: payload.primaryMemberId,
        advisor_id: payload.advisorId || null,
        selected_plan_id: payload.selectedPlanId,
        effective_date: payload.effectiveDate,
        household_size: payload.householdSize || 1,
        base_monthly_cost: payload.baseMonthlyCoat,
        permanent_bill_day: payload.permanentBillDay || 20,
        dependents: payload.dependents || [],
        enrollment_source: payload.enrollmentSource || 'admin',
        channel: payload.channel || 'direct',
        custom_fields: payload.customFields || {},
        idempotency_key: payload.idempotencyKey ?? null,
      },
    });

    if (error) throw new Error(`createEnrollment failed: ${error.message}`);
    const enrollmentId = (data as unknown as { enrollment_id: string }).enrollment_id;

    await logEnrollmentAudit({
      supabase: this.supabase,
      organizationId: payload.organizationId,
      enrollmentId,
      actorProfileId: payload.actorProfileId,
      eventType: 'created',
      newStatus: 'draft',
      message: 'Enrollment created via EnrollmentService',
    });

    const { data: enrollment, error: fetchErr } = await this.supabase
      .from('enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (fetchErr) throw new Error(`Fetch after create failed: ${fetchErr.message}`);
    return { enrollment: enrollment as Enrollment };
  }

  /**
   * Change plan on an existing enrollment. Creates a new enrollment for the new plan
   * and cancels the old one (plan changes result in a new enrollment in this system).
   */
  async changePlan(payload: ChangePlanPayload): Promise<{ oldEnrollmentId: string; newEnrollment: Enrollment }> {
    const { data: oldEnrollment, error: fetchErr } = await this.supabase
      .from('enrollments')
      .select('*')
      .eq('id', payload.enrollmentId)
      .eq('organization_id', payload.organizationId)
      .single();

    if (fetchErr || !oldEnrollment) {
      throw new Error(`Enrollment ${payload.enrollmentId} not found`);
    }

    const { error: cancelErr } = await this.supabase
      .from('enrollments')
      .update({
        status: 'cancelled',
        inactive_reason: payload.inactiveReason || 'plan_change',
        end_date: payload.effectiveDate,
        last_modified_by: payload.actorProfileId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.enrollmentId);

    if (cancelErr) throw new Error(`Cancel old enrollment failed: ${cancelErr.message}`);

    await logEnrollmentAudit({
      supabase: this.supabase,
      organizationId: payload.organizationId,
      enrollmentId: payload.enrollmentId,
      actorProfileId: payload.actorProfileId,
      eventType: 'plan_change_cancelled',
      oldStatus: oldEnrollment.status,
      newStatus: 'cancelled',
      message: `Cancelled for plan change to ${payload.newPlanId}`,
    });

    const newEnrollmentResult = await this.createEnrollment({
      organizationId: payload.organizationId,
      primaryMemberId: oldEnrollment.primary_member_id,
      advisorId: oldEnrollment.advisor_id,
      selectedPlanId: payload.newPlanId,
      effectiveDate: payload.effectiveDate,
      householdSize: oldEnrollment.household_size || 1,
      baseMonthlyCoat: payload.newBaseMonthlyCoat,
      permanentBillDay: oldEnrollment.permanent_bill_day || 20,
      enrollmentSource: 'plan_change',
      channel: oldEnrollment.channel || 'direct',
      actorProfileId: payload.actorProfileId,
      // A retried plan-change to the same target plan must not spawn duplicate new enrollments.
      idempotencyKey: `plan_change_${payload.enrollmentId}_${payload.newPlanId}_${payload.effectiveDate}`,
    });

    return { oldEnrollmentId: payload.enrollmentId, newEnrollment: newEnrollmentResult.enrollment };
  }

  /**
   * Cancel an enrollment. Triggers cascade billing_schedule cancellation via DB triggers.
   */
  async cancelEnrollment(payload: CancelEnrollmentPayload): Promise<void> {
    const { data: enrollment, error: fetchErr } = await this.supabase
      .from('enrollments')
      .select('status')
      .eq('id', payload.enrollmentId)
      .eq('organization_id', payload.organizationId)
      .single();

    if (fetchErr || !enrollment) {
      throw new Error(`Enrollment ${payload.enrollmentId} not found`);
    }

    if (enrollment.status === 'cancelled') {
      throw new Error('Enrollment is already cancelled');
    }

    const { error: updateErr } = await this.supabase
      .from('enrollments')
      .update({
        status: 'cancelled',
        inactive_reason: payload.inactiveReason,
        end_date: payload.endDate || new Date().toISOString().split('T')[0],
        last_modified_by: payload.actorProfileId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.enrollmentId);

    if (updateErr) throw new Error(`cancelEnrollment failed: ${updateErr.message}`);

    await logEnrollmentAudit({
      supabase: this.supabase,
      organizationId: payload.organizationId,
      enrollmentId: payload.enrollmentId,
      actorProfileId: payload.actorProfileId,
      eventType: 'cancelled',
      oldStatus: enrollment.status,
      newStatus: 'cancelled',
      message: `Cancelled: ${payload.inactiveReason}`,
    });
  }

  // activateFutureEnrollment removed — coverage goes live via
  // finalize_member_enrollment_tx (membership pending) + activate-due-memberships
  // cron. Enrollments stay `approved` (commission invariant).
}
