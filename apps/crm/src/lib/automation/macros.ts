/**
 * CRM Automation Pack - Macros
 * One-click action bundles for quick record operations
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CrmRecord } from '../crm/types';
import type {
  CrmMacro,
  CrmMacroRun,
  WorkflowAction,
  ActionResult,
  AutomationContext,
} from './types';
import { executeActions } from './actions';

// ============================================================================
// Supabase Client Helpers
// ============================================================================

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

// ============================================================================
// Macro Execution
// ============================================================================

export interface ExecuteMacroOptions {
  macroId: string;
  recordId: string;
  userId?: string;
  profileId?: string;
  dryRun?: boolean;
}

export interface MacroExecutionResult {
  runId: string;
  macroId: string;
  macroName: string;
  status: 'success' | 'failed' | 'partial';
  actionsExecuted: ActionResult[];
  error?: string;
}

/**
 * Execute a macro against a record
 */
export async function executeMacro(options: ExecuteMacroOptions): Promise<MacroExecutionResult> {
  const { macroId, recordId, userId, profileId, dryRun = false } = options;
  const supabase = await createClient();

  // Get the macro
  const { data: macro, error: macroError } = await supabase
    .from('crm_macros')
    .select('*')
    .eq('id', macroId)
    .single();

  if (macroError || !macro) {
    return {
      runId: '',
      macroId,
      macroName: 'Unknown',
      status: 'failed',
      actionsExecuted: [],
      error: 'Macro not found',
    };
  }

  if (!macro.is_enabled) {
    return {
      runId: '',
      macroId,
      macroName: macro.name,
      status: 'failed',
      actionsExecuted: [],
      error: 'Macro is disabled',
    };
  }

  // Get the record
  const { data: record, error: recordError } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (recordError || !record) {
    return {
      runId: '',
      macroId,
      macroName: macro.name,
      status: 'failed',
      actionsExecuted: [],
      error: 'Record not found',
    };
  }

  // Verify macro module matches record module
  if (macro.module_id !== record.module_id) {
    return {
      runId: '',
      macroId,
      macroName: macro.name,
      status: 'failed',
      actionsExecuted: [],
      error: 'Macro is not applicable to this record type',
    };
  }

  // Create macro run record (unless dry run)
  let runId = '';
  if (!dryRun) {
    const { data: run, error: runError } = await supabase
      .from('crm_macro_runs')
      .insert({
        org_id: record.org_id,
        macro_id: macroId,
        record_id: recordId,
        status: 'running',
        executed_by: profileId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      console.error('Failed to create macro run:', runError);
    } else {
      runId = run.id;
    }
  }

  // Build automation context
  const context: AutomationContext = {
    orgId: record.org_id,
    moduleId: record.module_id,
    record: record as CrmRecord,
    trigger: 'on_update', // Macros are essentially manual updates
    dryRun,
    userId,
    profileId,
  };

  // Execute the macro's actions
  const actions = (macro.actions || []) as WorkflowAction[];
  let actionsExecuted: ActionResult[] = [];
  let status: 'success' | 'failed' | 'partial' = 'success';
  let error: string | undefined;

  try {
    actionsExecuted = await executeActions(actions, record as CrmRecord, context);

    // Determine overall status
    const failedCount = actionsExecuted.filter(a => a.status === 'failed').length;
    const successCount = actionsExecuted.filter(a => a.status === 'success').length;

    if (failedCount === actionsExecuted.length) {
      status = 'failed';
      error = actionsExecuted.find(a => a.status === 'failed')?.error;
    } else if (failedCount > 0) {
      status = 'partial';
    }
  } catch (e) {
    status = 'failed';
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  // Update macro run record
  if (runId && !dryRun) {
    await supabase
      .from('crm_macro_runs')
      .update({
        status,
        actions_executed: actionsExecuted,
        error,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    // Also log to automation runs for unified history
    await supabase
      .from('crm_automation_runs')
      .insert({
        org_id: record.org_id,
        source: 'macro',
        trigger: `macro:${macro.name}`,
        module_id: record.module_id,
        record_id: recordId,
        status: status === 'partial' ? 'success' : status,
        is_dry_run: false,
        input: { macroId, macroName: macro.name },
        output: { actionsCount: actionsExecuted.length },
        actions_executed: actionsExecuted,
        error,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
  }

  return {
    runId,
    macroId,
    macroName: macro.name,
    status,
    actionsExecuted,
    error,
  };
}

/**
 * Check if a user can execute a macro based on their role
 */
export async function canExecuteMacro(
  macroId: string,
  profileId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = await createClient();

  // Get the macro
  const { data: macro, error: macroError } = await supabase
    .from('crm_macros')
    .select('allowed_roles, is_enabled, org_id')
    .eq('id', macroId)
    .single();

  if (macroError || !macro) {
    return { allowed: false, reason: 'Macro not found' };
  }

  if (!macro.is_enabled) {
    return { allowed: false, reason: 'Macro is disabled' };
  }

  // Get the user's profile and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('crm_role, organization_id')
    .eq('id', profileId)
    .single();

  if (!profile) {
    return { allowed: false, reason: 'Profile not found' };
  }

  // Check organization
  if (profile.organization_id !== macro.org_id) {
    return { allowed: false, reason: 'Not authorized for this organization' };
  }

  // Check role
  const allowedRoles = macro.allowed_roles || ['crm_admin', 'crm_manager', 'crm_agent'];
  if (!profile.crm_role || !allowedRoles.includes(profile.crm_role)) {
    return { allowed: false, reason: 'Insufficient permissions' };
  }

  return { allowed: true };
}

/**
 * Get macros available for a record
 */
export async function getMacrosForRecord(recordId: string): Promise<CrmMacro[]> {
  const supabase = await createClient();

  // Get the record to find its module
  const { data: record, error: recordError } = await supabase
    .from('crm_records')
    .select('module_id, org_id')
    .eq('id', recordId)
    .single();

  if (recordError || !record) {
    return [];
  }

  // Get the current user's profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('crm_role')
    .eq('user_id', user.id)
    .single();

  if (!profile?.crm_role) return [];

  // Get macros for this module that the user can execute
  const { data: macros, error: macrosError } = await supabase
    .from('crm_macros')
    .select('*')
    .eq('module_id', record.module_id)
    .eq('is_enabled', true)
    .contains('allowed_roles', [profile.crm_role])
    .order('display_order');

  if (macrosError) {
    console.error('Failed to fetch macros:', macrosError);
    return [];
  }

  return (macros || []) as CrmMacro[];
}

/**
 * Get recent macro runs for a record
 */
export async function getMacroRunsForRecord(recordId: string, limit = 10): Promise<CrmMacroRun[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_macro_runs')
    .select('*')
    .eq('record_id', recordId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch macro runs:', error);
    return [];
  }

  return (data || []) as CrmMacroRun[];
}
