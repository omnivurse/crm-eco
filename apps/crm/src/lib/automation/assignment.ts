/**
 * CRM Automation Pack - Assignment Engine
 * Implements owner assignment strategies with per-rule rotation state
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CrmRecord } from '../crm/types';
import type {
  CrmAssignmentRule,
  AutomationContext,
  RoundRobinConfig,
  TerritoryConfig,
  LeastLoadedConfig,
  FixedConfig,
} from './types';
import { evaluateConditions, resolveFieldValue } from './conditions';

// ============================================================================
// Supabase Client Helper
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
// Round Robin Assignment
// ============================================================================

async function executeRoundRobin(
  rule: CrmAssignmentRule,
  config: RoundRobinConfig,
  dryRun: boolean
): Promise<string | null> {
  if (!config.userIds || config.userIds.length === 0) {
    return null;
  }

  const currentIndex = config.currentIndex || 0;
  const nextIndex = (currentIndex + 1) % config.userIds.length;
  const selectedUserId = config.userIds[currentIndex];

  // Update the rotation state (per-rule cursor)
  if (!dryRun) {
    const supabase = await createClient();
    const updatedConfig: RoundRobinConfig = {
      ...config,
      currentIndex: nextIndex,
    };

    await supabase
      .from('crm_assignment_rules')
      .update({ config: updatedConfig })
      .eq('id', rule.id);
  }

  return selectedUserId;
}

// ============================================================================
// Territory Assignment
// ============================================================================

async function executeTerritory(
  config: TerritoryConfig,
  record: CrmRecord
): Promise<string | null> {
  const fieldValue = resolveFieldValue(record, config.field);
  
  if (fieldValue === null || fieldValue === undefined) {
    return config.fallbackUserId || null;
  }

  const normalizedValue = String(fieldValue).toLowerCase().trim();

  for (const territory of config.territories) {
    const matchedValues = territory.values.map(v => v.toLowerCase().trim());
    if (matchedValues.includes(normalizedValue)) {
      return territory.userId;
    }
  }

  return config.fallbackUserId || null;
}

// ============================================================================
// Least Loaded Assignment
// ============================================================================

async function executeLeastLoaded(
  config: LeastLoadedConfig,
  record: CrmRecord,
  context: AutomationContext
): Promise<string | null> {
  if (!config.userIds || config.userIds.length === 0) {
    return null;
  }

  const supabase = await createClient();

  // Count open records per user
  const counts: Record<string, number> = {};

  for (const userId of config.userIds) {
    const { count } = await supabase
      .from('crm_records')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('module_id', context.moduleId)
      .not('status', 'in', '("Closed","Converted","Won","Lost")');

    counts[userId] = count || 0;
  }

  // Find user with lowest count
  let minCount = Infinity;
  let selectedUserId: string | null = null;

  for (const userId of config.userIds) {
    if (counts[userId] < minCount) {
      minCount = counts[userId];
      selectedUserId = userId;
    }
  }

  return selectedUserId;
}

// ============================================================================
// Fixed Assignment
// ============================================================================

function executeFixed(config: FixedConfig): string | null {
  return config.userId || null;
}

// ============================================================================
// Main Assignment Executor
// ============================================================================

/**
 * Execute an assignment rule and return the assigned user ID
 */
export async function executeAssignment(
  rule: CrmAssignmentRule,
  record: CrmRecord,
  context: AutomationContext,
  dryRun: boolean = false
): Promise<string | null> {
  // Check conditions first
  if (rule.conditions && Array.isArray(rule.conditions) && rule.conditions.length > 0) {
    const conditionsMatch = evaluateConditions(rule.conditions, record);
    if (!conditionsMatch) {
      return null;
    }
  }

  switch (rule.strategy) {
    case 'round_robin':
      return executeRoundRobin(rule, rule.config as RoundRobinConfig, dryRun);

    case 'territory':
      return executeTerritory(rule.config as TerritoryConfig, record);

    case 'least_loaded':
      return executeLeastLoaded(rule.config as LeastLoadedConfig, record, context);

    case 'fixed':
      return executeFixed(rule.config as FixedConfig);

    default:
      console.warn(`Unknown assignment strategy: ${rule.strategy}`);
      return null;
  }
}

/**
 * Find and execute the first matching assignment rule for a record
 */
export async function findAndExecuteAssignment(
  record: CrmRecord,
  context: AutomationContext,
  dryRun: boolean = false
): Promise<{ ruleId: string; userId: string } | null> {
  const supabase = await createClient();

  // Get enabled assignment rules for this module, ordered by priority
  const { data: rules } = await supabase
    .from('crm_assignment_rules')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('module_id', context.moduleId)
    .eq('is_enabled', true)
    .order('priority', { ascending: true });

  if (!rules || rules.length === 0) {
    return null;
  }

  // Try each rule until one matches
  for (const rule of rules) {
    const userId = await executeAssignment(
      rule as CrmAssignmentRule,
      record,
      context,
      dryRun
    );

    if (userId) {
      return { ruleId: rule.id, userId };
    }
  }

  return null;
}

/**
 * Get assignment statistics for a module
 */
export async function getAssignmentStats(
  orgId: string,
  moduleId: string
): Promise<Record<string, { openCount: number; totalCount: number }>> {
  const supabase = await createClient();

  // Get all CRM users in the org
  const { data: users } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId)
    .not('crm_role', 'is', null);

  if (!users) return {};

  const stats: Record<string, { openCount: number; totalCount: number }> = {};

  for (const user of users) {
    // Open count
    const { count: openCount } = await supabase
      .from('crm_records')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('module_id', moduleId)
      .not('status', 'in', '("Closed","Converted","Won","Lost")');

    // Total count
    const { count: totalCount } = await supabase
      .from('crm_records')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('module_id', moduleId);

    stats[user.id] = {
      openCount: openCount || 0,
      totalCount: totalCount || 0,
    };
  }

  return stats;
}
