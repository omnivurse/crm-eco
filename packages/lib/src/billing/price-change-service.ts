import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

export interface SchedulePriceChangeInput {
  organizationId: string;
  planId: string;
  scheduledDate: string;
  newPricingSnapshot: Record<string, unknown>;
  oldPricingSnapshot?: Record<string, unknown>;
  notifyMembers?: boolean;
  notes?: string;
  createdBy?: string;
}

export interface PriceChangePreview {
  scheduleId: string;
  affectedEnrollments: number;
  totalDelta: number;
  enrollments: Array<{
    enrollmentId: string;
    memberName: string;
    oldAmount: number;
    newAmount: number;
    delta: number;
  }>;
}

interface PreviewEnrollmentRow {
  id: string;
  base_monthly_cost: number | null;
  primary_member: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
}

/**
 * Domain service for scheduled price changes against a plan.
 *
 * Price changes are scheduled (preview → schedule → execute → audit), so the
 * impact can be reviewed and members can be notified before billing changes.
 */
export class PriceChangeService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Schedule a price change for a future date.
   */
  async schedule(input: SchedulePriceChangeInput): Promise<{ scheduleId: string }> {
    const { count } = await this.supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', input.organizationId)
      .eq('selected_plan_id', input.planId)
      .eq('status', 'approved');

    const { data, error } = await this.supabase
      .from('price_change_schedules')
      .insert({
        organization_id: input.organizationId,
        plan_id: input.planId,
        scheduled_date: input.scheduledDate,
        new_pricing_snapshot: input.newPricingSnapshot as never,
        old_pricing_snapshot: (input.oldPricingSnapshot ?? null) as never,
        notify_members: input.notifyMembers ?? true,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
        affected_enrollments_count: count ?? 0,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) throw new Error(`schedulePriceChange failed: ${error?.message}`);
    return { scheduleId: data.id };
  }

  /**
   * Preview the impact of a scheduled price change without applying it.
   */
  async preview(scheduleId: string): Promise<PriceChangePreview> {
    const { data: schedule, error } = await this.supabase
      .from('price_change_schedules')
      .select('id, organization_id, plan_id, new_pricing_snapshot')
      .eq('id', scheduleId)
      .single();

    if (error || !schedule) throw new Error('Schedule not found');

    const newSnap = (schedule.new_pricing_snapshot ?? {}) as { monthly_share?: number };
    const newAmount = Number(newSnap.monthly_share ?? 0);

    const { data: enrollments } = await this.supabase
      .from('enrollments')
      .select(`
        id,
        base_monthly_cost,
        primary_member:members!enrollments_primary_member_id_fkey(first_name, last_name)
      `)
      .eq('organization_id', schedule.organization_id)
      .eq('selected_plan_id', schedule.plan_id ?? '')
      .eq('status', 'approved');

    const rows = ((enrollments ?? []) as unknown as PreviewEnrollmentRow[]).map((e) => {
      const oldAmount = Number(e.base_monthly_cost ?? 0);
      // Supabase joins can come back as either single or array depending on cardinality
      const member = Array.isArray(e.primary_member) ? e.primary_member[0] : e.primary_member;
      const memberName = member
        ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
        : 'Unknown';
      return {
        enrollmentId: e.id,
        memberName,
        oldAmount,
        newAmount,
        delta: newAmount - oldAmount,
      };
    });

    return {
      scheduleId,
      affectedEnrollments: rows.length,
      totalDelta: rows.reduce((sum, r) => sum + r.delta, 0),
      enrollments: rows,
    };
  }

  /**
   * Cancel a pending scheduled price change. The optional `reason` is persisted
   * to `notes` so admins can audit why a schedule was cancelled.
   */
  async cancel(scheduleId: string, reason?: string): Promise<void> {
    const update: Record<string, unknown> = {
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    };
    if (reason) update.notes = reason;

    const { error } = await this.supabase
      .from('price_change_schedules')
      .update(update)
      .eq('id', scheduleId)
      .eq('status', 'pending');
    if (error) throw new Error(`cancelPriceChange failed: ${error.message}`);
  }

  /**
   * Execute a pending scheduled price change. Creates immutable
   * `price_change_audit` rows and updates `enrollments.base_monthly_cost`
   * (which cascades to billing_schedules.amount via the sync trigger).
   *
   * Designed to be called either by an Edge Function/cron or an admin user.
   */
  async execute(scheduleId: string, executedBy?: string): Promise<{ processed: number; failed: number }> {
    const { data: schedule, error } = await this.supabase
      .from('price_change_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
    if (error || !schedule) throw new Error('Schedule not found');
    if (schedule.status !== 'pending') {
      throw new Error(`Cannot execute schedule in status: ${schedule.status}`);
    }

    await this.supabase
      .from('price_change_schedules')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', scheduleId);

    const newAmount = Number(
      ((schedule.new_pricing_snapshot ?? {}) as { monthly_share?: number }).monthly_share ?? 0,
    );

    const { data: enrollments } = await this.supabase
      .from('enrollments')
      .select('id, base_monthly_cost, organization_id')
      .eq('organization_id', schedule.organization_id)
      .eq('selected_plan_id', schedule.plan_id ?? '')
      .eq('status', 'approved');

    let processed = 0;
    let failed = 0;
    const errors: Array<{ enrollmentId: string; error: string }> = [];

    for (const enrollment of enrollments ?? []) {
      try {
        const oldAmount = Number(enrollment.base_monthly_cost ?? 0);

        await this.supabase.from('price_change_audit').insert({
          organization_id: schedule.organization_id,
          schedule_id: scheduleId,
          enrollment_id: enrollment.id,
          old_amount: oldAmount,
          new_amount: newAmount,
          change_reason: schedule.notes ?? 'scheduled price change',
        });

        const { error: updateErr } = await this.supabase
          .from('enrollments')
          .update({
            base_monthly_cost: newAmount,
            last_modified_by: executedBy ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id);

        if (updateErr) throw updateErr;
        processed++;
      } catch (err) {
        failed++;
        errors.push({
          enrollmentId: enrollment.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    await this.supabase
      .from('price_change_schedules')
      .update({
        status: failed === 0 ? 'completed' : 'failed',
        processed_count: processed,
        failed_count: failed,
        executed_at: new Date().toISOString(),
        executed_by: executedBy ?? null,
        error_log: errors.length ? (errors as never) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduleId);

    return { processed, failed };
  }
}
