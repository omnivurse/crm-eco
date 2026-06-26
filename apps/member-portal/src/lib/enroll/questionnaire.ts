import 'server-only';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import type { RuleConditionGroup } from '@crm-eco/lib/rules';
import { RULE_CONDITION_OPERATORS } from '@crm-eco/lib/rules';
import type {
  QuestionnaireTemplate,
  QuestionnaireQuestion,
  QuestionnaireQuestionType,
} from '@crm-eco/enrollment';

/**
 * Server-only reader for the org's DEFAULT, PUBLISHED questionnaire template.
 *
 * The wizard's questionnaire step runs BEFORE plan selection (so eligibility
 * answers are collected before pricing), so the plan-keyed
 * get_questionnaire_for_plan() reader cannot resolve a template here. Instead we
 * load the org default — questionnaire_templates WHERE organization_id = <org>
 * AND is_default = true AND status = 'published' (the partial-unique index
 * idx_questionnaire_templates_org_default guarantees at most one). When none
 * exists this returns null and the wizard leaves the step inert/skipped, so the
 * portal's behavior is unchanged for orgs without a default template.
 *
 * Reads go through the normal cookie/SSR client, so the questionnaire tables'
 * SELECT RLS (organization_id = get_user_organization_id()) scopes every row to
 * the caller's org. No service role, no broad grants.
 */

// ---------------------------------------------------------------------------
// DB row shapes (as stored by the admin builder + the migration schema).
// ---------------------------------------------------------------------------

interface DbQuestionRow {
  id: string;
  key: string;
  label: string;
  // DB CHECK vocab: text | number | radio | checkbox | select | date | upload | section
  type: string;
  options: unknown;
  ordinal: number;
  section: string | null;
  required: boolean;
  help_text: string | null;
}

interface DbLogicRow {
  id: string;
  source_question_id: string;
  target_question_id: string;
  // CHECK vocab: show | hide | require | skip
  action: string;
  // { field, operator, value } — single-condition mirror of RuleCondition.
  condition: unknown;
  ordinal: number;
}

// ---------------------------------------------------------------------------
// Type-vocab reconciliation (DB CHECK set === renderable TS union)
// ---------------------------------------------------------------------------
//
// As of the B3b reconciliation, QuestionnaireQuestion.type is aligned 1:1 with
// the DB question `type` CHECK (text/number/radio/checkbox/select/date/upload/
// section) and the wizard step renders a dedicated control for each. So the DB
// type passes through verbatim — no lossy degradation. We still VALIDATE the
// stored value against the canonical union so a row with an unexpected type
// (e.g. from a future/foreign writer) degrades to a plain text input instead of
// rendering nothing or crashing.
const QUESTION_TYPES: readonly QuestionnaireQuestionType[] = [
  'text',
  'number',
  'radio',
  'checkbox',
  'select',
  'date',
  'upload',
  'section',
];

function mapDbTypeToWizardType(dbType: string): QuestionnaireQuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(dbType)
    ? (dbType as QuestionnaireQuestionType)
    : 'text';
}

// Normalize the stored options jsonb into the step's {value,label}[] shape.
// The builder is expected to store [{value,label}], but tolerate bare string
// arrays and {value,label}-ish objects so a slightly-off template still renders.
function normalizeOptions(raw: unknown): Array<{ value: string; label: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const opts = raw
    .map((o): { value: string; label: string } | null => {
      if (typeof o === 'string') return { value: o, label: o };
      if (o && typeof o === 'object') {
        const rec = o as Record<string, unknown>;
        const value = rec.value ?? rec.key ?? rec.id;
        if (value == null) return null;
        const label = rec.label ?? rec.name ?? value;
        return { value: String(value), label: String(label) };
      }
      return null;
    })
    .filter((o): o is { value: string; label: string } => o !== null);
  return opts.length > 0 ? opts : undefined;
}

function isKnownOperator(op: unknown): op is RuleConditionGroup['conditions'][number]['operator'] {
  return typeof op === 'string' && (RULE_CONDITION_OPERATORS as readonly string[]).includes(op);
}

/**
 * Fold the flat questionnaire_logic[] into per-question `visible_when` groups.
 *
 * The DB models logic as separate rows (source -> target, one {field,operator,
 * value} condition each); the step expects each question to optionally carry a
 * RuleConditionGroup that is evaluated against the answer map (keyed by question
 * KEY). We:
 *   - keep only `show`/`hide` actions (the only ones the step consumes; `require`/
 *     `skip` have no consumer yet),
 *   - resolve each condition's `field` to the SOURCE question's key (the answer
 *     map is keyed by key) — falling back to the stored field when it already
 *     names a known key,
 *   - group every rule that targets the same question into one AND group.
 * A `hide`-when rule is inverted into a `show`-when by mapping is_empty/is_not_empty
 * and eq/neq pairs where possible; when an action can't be cleanly inverted it is
 * dropped (the question then always shows — the safe default).
 */
function buildVisibleWhenByTarget(
  logic: DbLogicRow[],
  keyById: Map<string, string>,
  validKeys: Set<string>,
): Map<string, RuleConditionGroup> {
  const byTarget = new Map<string, RuleConditionGroup['conditions']>();

  for (const row of logic) {
    if (row.action !== 'show' && row.action !== 'hide') continue;

    const cond = (row.condition && typeof row.condition === 'object')
      ? (row.condition as Record<string, unknown>)
      : null;
    if (!cond) continue;

    // The admin builder persists the FULL authored RuleConditionGroup under
    // `condition.group` alongside a top-level mirror of the FIRST condition (so
    // the DB CHECK / validate trigger see a legal operator). For a `show` rule
    // with multiple authored conditions, honor the whole group instead of
    // silently collapsing to the first condition. `hide` (which needs operator
    // inversion) and single-condition rules fall through to the per-row path
    // below, preserving existing behavior.
    const persistedGroup =
      cond.group && typeof cond.group === 'object'
        ? (cond.group as Record<string, unknown>)
        : null;
    if (
      row.action === 'show' &&
      persistedGroup &&
      Array.isArray(persistedGroup.conditions) &&
      persistedGroup.conditions.length > 1
    ) {
      const sourceKey = keyById.get(row.source_question_id);
      const groupConditions: RuleConditionGroup['conditions'] = [];
      for (const rawC of persistedGroup.conditions as unknown[]) {
        if (!rawC || typeof rawC !== 'object') continue;
        const c = rawC as Record<string, unknown>;
        if (!isKnownOperator(c.operator)) continue;
        const storedField = typeof c.field === 'string' ? c.field : undefined;
        const field =
          (storedField && validKeys.has(storedField) ? storedField : undefined) ??
          sourceKey;
        if (!field) continue;
        groupConditions.push({
          field,
          operator: c.operator,
          value: (c.value ?? null) as RuleConditionGroup['conditions'][number]['value'],
        });
      }
      if (groupConditions.length > 0) {
        const list = byTarget.get(row.target_question_id) ?? [];
        list.push(...groupConditions);
        byTarget.set(row.target_question_id, list);
      }
      continue;
    }

    const operator = cond.operator;
    if (!isKnownOperator(operator)) continue;

    // Prefer the source question's key (the answer map is keyed by key). Fall
    // back to a stored `field` only when it already names a real question key.
    const storedField = typeof cond.field === 'string' ? cond.field : undefined;
    const sourceKey = keyById.get(row.source_question_id);
    const field =
      sourceKey ??
      (storedField && validKeys.has(storedField) ? storedField : undefined);
    if (!field) continue;

    let effectiveOperator = operator;
    // `hide`-when is the inverse of `show`-when. Invert the operator where there
    // is a clean complement; otherwise skip the rule (question stays visible).
    if (row.action === 'hide') {
      const inverse: Partial<Record<typeof operator, typeof operator>> = {
        eq: 'neq',
        neq: 'eq',
        in: 'not_in',
        not_in: 'in',
        is_empty: 'is_not_empty',
        is_not_empty: 'is_empty',
      };
      const inv = inverse[operator];
      if (!inv) continue;
      effectiveOperator = inv;
    }

    const value = (cond.value ?? null) as RuleConditionGroup['conditions'][number]['value'];

    const list = byTarget.get(row.target_question_id) ?? [];
    list.push({ field, operator: effectiveOperator, value });
    byTarget.set(row.target_question_id, list);
  }

  const result = new Map<string, RuleConditionGroup>();
  for (const [targetId, conditions] of byTarget) {
    if (conditions.length === 0) continue;
    result.set(targetId, { logic: 'AND', conditions });
  }
  return result;
}

/**
 * Load the caller-org's default published questionnaire template, shaped to the
 * QuestionnaireTemplate type the wizard step consumes. Returns undefined when no
 * default published template exists (step stays inert) or when there is no org
 * context.
 */
export async function getDefaultQuestionnaireTemplate(
  organizationId: string,
): Promise<QuestionnaireTemplate | undefined> {
  if (!organizationId) return undefined;

  const supabase = await createServerSupabaseClient();

  // 1) The org's single default + published template (partial-unique guarantees
  //    at most one default per org; status gates publish lifecycle).
  const { data: templateRow, error: templateError } = await (supabase as any)
    .from('questionnaire_templates')
    .select('id, key, name, description, version, status, is_default')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .eq('status', 'published')
    .maybeSingle();

  if (templateError) {
    console.error('getDefaultQuestionnaireTemplate: template read failed', templateError);
    return undefined;
  }
  if (!templateRow) return undefined;

  // 2) Its questions + logic (ordered the same way the plan-keyed reader orders
  //    them: ordinal, then created_at). RLS scopes both to the caller's org.
  const [{ data: questionRows, error: questionsError }, { data: logicRows, error: logicError }] =
    await Promise.all([
      (supabase as any)
        .from('questionnaire_questions')
        .select('id, key, label, type, options, ordinal, section, required, help_text')
        .eq('template_id', templateRow.id)
        .order('ordinal', { ascending: true })
        .order('created_at', { ascending: true }),
      (supabase as any)
        .from('questionnaire_logic')
        .select('id, source_question_id, target_question_id, action, condition, ordinal')
        .eq('template_id', templateRow.id)
        .order('ordinal', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

  if (questionsError) {
    console.error('getDefaultQuestionnaireTemplate: questions read failed', questionsError);
    return undefined;
  }
  if (logicError) {
    // Logic is optional; a logic read failure should not block a usable template.
    console.error('getDefaultQuestionnaireTemplate: logic read failed', logicError);
  }

  const questions: DbQuestionRow[] = questionRows ?? [];
  if (questions.length === 0) {
    // A template with no questions is inert by the wizard's own gate; skip it.
    return undefined;
  }

  const keyById = new Map<string, string>(questions.map((q) => [q.id, q.key]));
  const validKeys = new Set<string>(questions.map((q) => q.key));
  const visibleWhenByTarget = buildVisibleWhenByTarget(
    (logicRows ?? []) as DbLogicRow[],
    keyById,
    validKeys,
  );

  const mappedQuestions: QuestionnaireQuestion[] = questions.map((q) => {
    const visibleWhen = visibleWhenByTarget.get(q.id);
    const options = normalizeOptions(q.options);
    return {
      key: q.key,
      label: q.label,
      type: mapDbTypeToWizardType(q.type),
      ...(q.help_text ? { help_text: q.help_text } : {}),
      required: Boolean(q.required),
      ...(options ? { options } : {}),
      ...(visibleWhen ? { visible_when: visibleWhen } : {}),
    };
  });

  return {
    id: templateRow.id,
    ...(templateRow.name ? { title: templateRow.name } : {}),
    ...(templateRow.description ? { description: templateRow.description } : {}),
    questions: mappedQuestions,
  };
}
