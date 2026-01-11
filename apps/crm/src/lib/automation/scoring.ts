/**
 * CRM Automation Pack - Scoring Engine
 * Computes record scores based on scoring rules
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CrmRecord } from '../crm/types';
import type {
  CrmScoringRules,
  ScoringRule,
  AutomationContext,
} from './types';
import { resolveFieldValue, evaluateCondition } from './conditions';

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
// Score Calculation
// ============================================================================

/**
 * Calculate the score for a single scoring rule
 */
function evaluateScoringRule(rule: ScoringRule, record: CrmRecord): number {
  const matches = evaluateCondition(
    {
      field: rule.field,
      operator: rule.operator,
      value: rule.value,
    },
    record
  );

  return matches ? rule.points : 0;
}

/**
 * Calculate total score for a record based on scoring rules
 */
export function calculateScore(
  scoringRules: CrmScoringRules,
  record: CrmRecord
): { score: number; breakdown: { rule: ScoringRule; points: number }[] } {
  if (!scoringRules.is_enabled || !scoringRules.rules || scoringRules.rules.length === 0) {
    return { score: 0, breakdown: [] };
  }

  const breakdown: { rule: ScoringRule; points: number }[] = [];
  let totalScore = 0;

  for (const rule of scoringRules.rules) {
    const points = evaluateScoringRule(rule, record);
    if (points !== 0) {
      breakdown.push({ rule, points });
      totalScore += points;
    }
  }

  return { score: totalScore, breakdown };
}

/**
 * Apply scoring rules to a record and update the score field
 */
export async function applyScoring(
  record: CrmRecord,
  context: AutomationContext,
  dryRun: boolean = false
): Promise<{ score: number; updated: boolean; breakdown: { field: string; points: number }[] }> {
  const supabase = await createClient();

  // Get enabled scoring rules for this module
  const { data: scoringRulesData } = await supabase
    .from('crm_scoring_rules')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('module_id', context.moduleId)
    .eq('is_enabled', true);

  if (!scoringRulesData || scoringRulesData.length === 0) {
    return { score: 0, updated: false, breakdown: [] };
  }

  // Combine all scoring rules
  let totalScore = 0;
  const allBreakdown: { field: string; points: number }[] = [];

  for (const scoringRulesRow of scoringRulesData) {
    const scoringRules = scoringRulesRow as CrmScoringRules;
    const { score, breakdown } = calculateScore(scoringRules, record);
    totalScore += score;

    for (const item of breakdown) {
      allBreakdown.push({
        field: item.rule.field,
        points: item.points,
      });
    }
  }

  // Get the score field key from the first scoring rule (or default to 'score')
  const scoreFieldKey = (scoringRulesData[0] as CrmScoringRules).score_field_key || 'score';

  if (dryRun) {
    return { score: totalScore, updated: false, breakdown: allBreakdown };
  }

  // Update the record's score
  const updatedData = {
    ...record.data,
    [scoreFieldKey]: totalScore,
    _score_breakdown: allBreakdown,
    _score_updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('crm_records')
    .update({ data: updatedData })
    .eq('id', record.id);

  if (error) {
    console.error('Failed to update score:', error);
    return { score: totalScore, updated: false, breakdown: allBreakdown };
  }

  return { score: totalScore, updated: true, breakdown: allBreakdown };
}

/**
 * Recalculate scores for all records in a module
 */
export async function recalculateModuleScores(
  orgId: string,
  moduleId: string,
  batchSize: number = 100
): Promise<{ processed: number; updated: number }> {
  const supabase = await createClient();

  let processed = 0;
  let updated = 0;
  let offset = 0;

  while (true) {
    // Get a batch of records
    const { data: records, error } = await supabase
      .from('crm_records')
      .select('*')
      .eq('org_id', orgId)
      .eq('module_id', moduleId)
      .range(offset, offset + batchSize - 1);

    if (error || !records || records.length === 0) {
      break;
    }

    // Process each record
    for (const record of records) {
      const context: AutomationContext = {
        orgId,
        moduleId,
        record: record as CrmRecord,
        trigger: 'on_update',
        dryRun: false,
      };

      const result = await applyScoring(record as CrmRecord, context, false);
      processed++;
      if (result.updated) {
        updated++;
      }
    }

    offset += batchSize;

    // If we got fewer records than the batch size, we're done
    if (records.length < batchSize) {
      break;
    }
  }

  return { processed, updated };
}

/**
 * Get score distribution for a module
 */
export async function getScoreDistribution(
  orgId: string,
  moduleId: string,
  scoreFieldKey: string = 'score'
): Promise<{ buckets: { min: number; max: number; count: number }[]; average: number }> {
  const supabase = await createClient();

  // Get all records with scores
  const { data: records } = await supabase
    .from('crm_records')
    .select(`data->>${scoreFieldKey} as score`)
    .eq('org_id', orgId)
    .eq('module_id', moduleId)
    .not(`data->>${scoreFieldKey}`, 'is', null);

  if (!records || records.length === 0) {
    return { buckets: [], average: 0 };
  }

  const scores = records
    .map(r => parseFloat(r.score as string))
    .filter(s => !isNaN(s));

  if (scores.length === 0) {
    return { buckets: [], average: 0 };
  }

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Create buckets
  const bucketCount = 5;
  const bucketSize = Math.ceil((max - min + 1) / bucketCount);
  const buckets: { min: number; max: number; count: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = i === bucketCount - 1 ? max : bucketMin + bucketSize - 1;
    const count = scores.filter(s => s >= bucketMin && s <= bucketMax).length;
    buckets.push({ min: bucketMin, max: bucketMax, count });
  }

  return { buckets, average };
}
