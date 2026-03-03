import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Payout Compliance Service
 *
 * Enforces separation of duties, anomaly detection, and export controls
 * for the payout system. All sensitive operations go through DB functions
 * (SECURITY DEFINER) to maintain audit integrity.
 */

export interface ComplianceConfig {
  self_approve_threshold: number;
  dual_approve_threshold: number;
  max_single_payout: number;
  spike_multiplier: number;
  log_exports: boolean;
}

export interface FraudFlag {
  id: string;
  organization_id: string;
  advisor_id: string;
  batch_id: string | null;
  flag_type: string;
  severity: string;
  status: string;
  amount: number | null;
  baseline_amount: number | null;
  multiplier: number | null;
  details: Record<string, unknown>;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  actor_type: string;
  prev_status: string | null;
  new_status: string | null;
  amount: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export class PayoutComplianceService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Run anomaly detection on a batch before approval.
   * Returns flags raised (spike detection, threshold breach, duplicate bank).
   */
  async detectAnomalies(batchId: string) {
    const { data, error } = await this.supabase.rpc('detect_payout_anomalies', {
      p_batch_id: batchId,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Resolve or dismiss a fraud flag.
   */
  async resolveFraudFlag(
    flagId: string,
    actorId: string,
    status: 'resolved' | 'dismissed',
    notes?: string
  ) {
    const { data, error } = await this.supabase.rpc('resolve_fraud_flag', {
      p_flag_id: flagId,
      p_actor_id: actorId,
      p_status: status,
      p_notes: notes || null,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Create a reversal for a ledger entry.
   */
  async createReversal(ledgerEntryId: string, reason: string, actorId: string) {
    const { data, error } = await this.supabase.rpc('create_payout_reversal', {
      p_ledger_entry_id: ledgerEntryId,
      p_reason: reason,
      p_actor_id: actorId,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Create a clawback adjustment for an advisor.
   */
  async createClawback(
    orgId: string,
    advisorId: string,
    amount: number,
    reason: string,
    actorId: string,
    commissionId?: string
  ) {
    const { data, error } = await this.supabase.rpc('create_payout_clawback', {
      p_org_id: orgId,
      p_advisor_id: advisorId,
      p_amount: amount,
      p_reason: reason,
      p_commission_id: commissionId || null,
      p_actor_id: actorId,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Log a payout export action.
   */
  async logExport(
    orgId: string,
    actorId: string,
    batchId?: string,
    format: string = 'csv'
  ) {
    const { data, error } = await this.supabase.rpc('log_payout_export', {
      p_org_id: orgId,
      p_actor_id: actorId,
      p_batch_id: batchId || null,
      p_format: format,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Get compliance config for an org.
   */
  async getConfig(orgId: string): Promise<ComplianceConfig> {
    const { data, error } = await this.supabase.rpc('get_payout_compliance_config', {
      p_org_id: orgId,
    });
    if (error) throw error;
    return data as ComplianceConfig;
  }
}
