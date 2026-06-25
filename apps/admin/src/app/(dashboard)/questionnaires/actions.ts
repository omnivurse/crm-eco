'use server';

/**
 * Questionnaire builder — admin server actions (B3a).
 * ----------------------------------------------------------------
 * No-code builder write path for the questionnaire engine introduced in
 * supabase/drafts/202606240002_questionnaire_engine.sql (already applied to the
 * local DB). Covers templates, questions, conditional logic, default-template
 * selection, and publish lifecycle.
 *
 * SAFETY / RLS (authoritative):
 *   Every write goes through the NORMAL cookie/SSR Supabase client
 *   (createServerSupabaseClient) — NOT service-role, NOT has_crm_role. The DB
 *   RLS policies from the migration are the real gatekeeper:
 *     WRITE  -> organization_id = get_user_organization_id()
 *               AND get_user_role() IN ('owner','admin','staff')
 *     SELECT -> organization_id = get_user_organization_id()
 *   (get_user_role() resolves from public.profiles.role, NOT the membership
 *   role.) The getActiveTenant() role check below is DEFENSE-IN-DEPTH so we fail
 *   fast with a friendly error instead of bouncing off an RLS 403 — RLS remains
 *   authoritative. Every insert/update stamps organization_id = the actor's
 *   tenant so the RLS WITH CHECK passes.
 *
 * INVARIANTS enforced by the DB that these actions cooperate with (and map to
 * clean results instead of throwing):
 *   - questionnaire_templates: UNIQUE (organization_id, key, version) and the
 *     partial-unique idx_questionnaire_templates_org_default
 *     (UNIQUE (organization_id) WHERE is_default = true) => at most one default
 *     per org. setDefaultTemplate clears the prior default in the same call.
 *   - questionnaire_questions: type ∈ DB CHECK set
 *     (text|number|radio|checkbox|select|date|upload|section — mirrored by the
 *     QuestionnaireQuestionType union in @crm-eco/enrollment); UNIQUE
 *     (template_id, key).
 *   - questionnaire_logic: action ∈ show|hide|require|skip; condition.operator ∈
 *     the SHARED 11-operator vocab (@crm-eco/lib/rules RULE_CONDITION_OPERATORS,
 *     mirrored DB-side by questionnaire_logic_operators()); source & target
 *     questions must belong to template_id (trg_questionnaire_logic_validate).
 *
 * Source of truth for question types and the operator vocab is REUSED, never
 * forked: QuestionnaireQuestionType from @crm-eco/enrollment and
 * RULE_CONDITION_OPERATORS from @crm-eco/lib/rules.
 */

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  RULE_CONDITION_OPERATORS,
  type RuleConditionOperator,
  type RuleConditionGroup,
} from '@crm-eco/lib/rules';
import { getActiveTenant, type TenantRole } from '@/lib/tenant';

/**
 * Question-type vocabulary. Local mirror of the DB CHECK
 * (questionnaire_questions_type_check in
 * supabase/drafts/202606240002_questionnaire_engine.sql) and of the
 * QuestionnaireQuestionType union in @crm-eco/enrollment. Defined here — rather
 * than imported from @crm-eco/enrollment — because the admin app does NOT depend
 * on @crm-eco/enrollment (only @crm-eco/lib, @crm-eco/rates, @crm-eco/shared,
 * @crm-eco/ui), and adding that cross-package dependency just for one string
 * union is unwarranted. The DB CHECK is the authoritative source of truth; this
 * union MUST stay byte-identical to it and to the enrollment union.
 */
export type QuestionnaireQuestionType =
  | 'text'
  | 'number'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'date'
  | 'upload'
  | 'section';

// ============================================================================
// Result type + error vocabulary
// ============================================================================

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: QuestionnaireActionError; message?: string };

export type QuestionnaireActionError =
  /** No authenticated user / session. */
  | 'unauthorized'
  /** No org resolvable for the current user. */
  | 'no_tenant'
  /** User's tenant role is not in the write set (owner/admin/staff). */
  | 'forbidden'
  /** Required input missing or malformed (e.g. empty key, bad type, bad operator). */
  | 'invalid_input'
  /** A uniqueness constraint was hit (23505): duplicate key/version, second default, etc. */
  | 'duplicate'
  /** A CHECK / FK / trigger constraint rejected the row (23514 / 23503 / raised check_violation). */
  | 'constraint_violation'
  /** Target row not found in the caller's org (or RLS hid it). */
  | 'not_found'
  /** Catch-all DB/server failure. */
  | 'save_failed';

/**
 * Roles allowed to write questionnaire objects. Mirrors the RLS WRITE predicate
 * `get_user_role() IN ('owner','admin','staff')`. Note: RLS checks
 * profiles.role; this membership-role check is defense-in-depth only.
 */
const QUESTIONNAIRE_WRITE_ROLES: readonly TenantRole[] = [
  'owner',
  'admin',
  'staff',
];

/** DB CHECK set for questionnaire_questions.type (mirror of QuestionnaireQuestionType). */
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

/** DB CHECK set for questionnaire_logic.action. */
export type QuestionnaireLogicAction = 'show' | 'hide' | 'require' | 'skip';
const LOGIC_ACTIONS: readonly QuestionnaireLogicAction[] = [
  'show',
  'hide',
  'require',
  'skip',
];

/** DB lifecycle for questionnaire_templates.status. */
export type QuestionnaireTemplateStatus = 'draft' | 'published' | 'archived';

// ============================================================================
// Input contracts
// ============================================================================

export interface QuestionOption {
  value: string;
  label: string;
}

/**
 * condition jsonb shape for a logic row. The DB CHECK + validate trigger only
 * inspect `condition->>'operator'`, so a top-level { field, operator, value }
 * mirror of the FIRST condition is REQUIRED for the row to be legal. The
 * builder additionally authors an AND/OR `group`; when present it is persisted
 * alongside the mirror so the full group round-trips back into the editor.
 */
export interface LogicCondition {
  field: string;
  operator: RuleConditionOperator;
  value: string | number | boolean | string[] | null;
  /**
   * Optional full AND/OR group. When supplied, persisted as condition.group so
   * the builder can re-edit multi-condition logic. The top-level
   * field/operator/value still mirror the first condition for the DB CHECK.
   */
  group?: RuleConditionGroup;
}

export interface CreateTemplateInput {
  /** Stable key, unique per (org, key, version). */
  key: string;
  name: string;
  /** Defaults to 1; must be >= 1. */
  version?: number;
  description?: string | null;
  /** Free-form template metadata. Defaults to {}. */
  metadata?: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  templateId: string;
  name?: string;
  description?: string | null;
  /** Allowed: rename the key (still subject to UNIQUE (org,key,version)). */
  key?: string;
  metadata?: Record<string, unknown>;
}

export interface AddQuestionInput {
  templateId: string;
  key: string;
  label: string;
  type: QuestionnaireQuestionType;
  /** options array for radio/checkbox/select; ignored (stored []) otherwise. */
  options?: QuestionOption[];
  /** Render order. When omitted, appended after the current max ordinal. */
  ordinal?: number;
  section?: string | null;
  required?: boolean;
  helpText?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateQuestionInput {
  questionId: string;
  key?: string;
  label?: string;
  type?: QuestionnaireQuestionType;
  options?: QuestionOption[];
  ordinal?: number;
  section?: string | null;
  required?: boolean;
  helpText?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AddLogicRuleInput {
  templateId: string;
  sourceQuestionId: string;
  targetQuestionId: string;
  action: QuestionnaireLogicAction;
  condition: LogicCondition;
  ordinal?: number;
}

export interface UpdateLogicRuleInput {
  logicId: string;
  sourceQuestionId?: string;
  targetQuestionId?: string;
  action?: QuestionnaireLogicAction;
  condition?: LogicCondition;
}

// ============================================================================
// Shared guard: resolve actor + org + role, all RLS-aligned.
// ============================================================================

type Guard =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      organizationId: string;
    }
  | { ok: false; error: QuestionnaireActionError };

async function authorize(): Promise<Guard> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: 'no_tenant' };

  // App-level mirror of the RLS write predicate (defense-in-depth).
  if (!QUESTIONNAIRE_WRITE_ROLES.includes(tenant.role)) {
    return { ok: false, error: 'forbidden' };
  }

  return { ok: true, supabase, organizationId: tenant.organizationId };
}

/**
 * Map a Supabase/Postgres error to a clean ActionResult. Centralizes 23505
 * (unique), 23514 (check), 23503 (FK), and the trigger's raised check_violation
 * for questionnaire_logic.
 */
function mapDbError(
  error: unknown,
  context: string,
): { ok: false; error: QuestionnaireActionError; message?: string } {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message;

  if (code === '23505') {
    return { ok: false, error: 'duplicate', message };
  }
  if (code === '23514' || code === '23503') {
    // CHECK or FK violation (includes the logic-validate trigger which raises
    // check_violation for cross-template source/target and bad operators).
    return { ok: false, error: 'constraint_violation', message };
  }
  console.error(`[questionnaire:${context}]`, error);
  return { ok: false, error: 'save_failed', message };
}

function revalidateBuilder() {
  // Surface refreshed template state on the builder routes.
  revalidatePath('/questionnaires');
}

/**
 * Build the questionnaire_logic.condition jsonb. Always emits the top-level
 * { field, operator, value } mirror the DB CHECK / validate trigger read; when
 * the caller supplies an AND/OR `group`, it is persisted alongside so the
 * builder can re-edit multi-condition logic on the next load.
 */
function buildConditionJson(condition: LogicCondition): Record<string, unknown> {
  const json: Record<string, unknown> = {
    field: condition.field,
    operator: condition.operator,
    value: condition.value ?? null,
  };
  if (condition.group) json.group = condition.group;
  return json;
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Create a draft template in the caller's org.
 * Contract: returns { id } on success. New templates are always status='draft'
 * and is_default=false — publish/setDefault are separate, explicit transitions.
 * Maps the UNIQUE (org,key,version) collision to `duplicate`.
 */
export async function createTemplate(
  input: CreateTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  const key = input.key?.trim();
  const name = input.name?.trim();
  if (!key || !name) {
    return { ok: false, error: 'invalid_input', message: 'key and name are required' };
  }

  const version = input.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'invalid_input', message: 'version must be an integer >= 1' };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .insert({
      organization_id: guard.organizationId,
      key,
      name,
      version,
      status: 'draft',
      is_default: false,
      description: input.description?.trim() || null,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (error) return mapDbError(error, 'createTemplate');

  revalidateBuilder();
  return { ok: true, data: { id: data.id as string } };
}

/**
 * Update mutable template fields (name/description/key/metadata). Does NOT
 * change status or is_default (use publishTemplate / setDefaultTemplate).
 * Org-scoped by id + organization_id (RLS also enforces it).
 */
export async function updateTemplate(
  input: UpdateTemplateInput,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!input.templateId) {
    return { ok: false, error: 'invalid_input', message: 'templateId is required' };
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'invalid_input', message: 'name cannot be empty' };
    updates.name = name;
  }
  if (input.key !== undefined) {
    const key = input.key.trim();
    if (!key) return { ok: false, error: 'invalid_input', message: 'key cannot be empty' };
    updates.key = key;
  }
  if (input.description !== undefined) {
    updates.description = input.description?.trim() || null;
  }
  if (input.metadata !== undefined) {
    updates.metadata = input.metadata;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'invalid_input', message: 'no fields to update' };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .update(updates)
    .eq('id', input.templateId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'updateTemplate');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

/**
 * Promote a template draft -> published so the self-serve readers
 * (get_questionnaire_for_plan / the org-default reader) will surface it.
 * Only 'draft' templates are promotable here; 'archived' must be reactivated
 * separately. Idempotent on an already-published row (returns ok).
 */
export async function publishTemplate(
  templateId: string,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!templateId) {
    return { ok: false, error: 'invalid_input', message: 'templateId is required' };
  }

  // Confirm ownership + current status (RLS-scoped read).
  const { data: existing, error: readErr } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .select('id, status')
    .eq('id', templateId)
    .eq('organization_id', guard.organizationId)
    .maybeSingle();

  if (readErr) return mapDbError(readErr, 'publishTemplate.read');
  if (!existing) return { ok: false, error: 'not_found' };
  if (existing.status === 'published') return { ok: true };
  if (existing.status === 'archived') {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'cannot publish an archived template; reactivate it first',
    };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .update({ status: 'published' })
    .eq('id', templateId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'publishTemplate');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

/**
 * Make `templateId` the single org-default. Clears any existing default in the
 * caller's org FIRST so the partial-unique idx_questionnaire_templates_org_default
 * never rejects the flip, then sets the target. Both writes are RLS-scoped to the
 * org. (Not a DB transaction across calls, but each statement is atomic and the
 * clear-before-set ordering avoids the unique collision; a 23505 still maps to
 * `duplicate` defensively.)
 */
export async function setDefaultTemplate(
  templateId: string,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!templateId) {
    return { ok: false, error: 'invalid_input', message: 'templateId is required' };
  }

  // Ensure the target exists in this org before we clear the old default.
  const { data: target, error: readErr } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .select('id')
    .eq('id', templateId)
    .eq('organization_id', guard.organizationId)
    .maybeSingle();

  if (readErr) return mapDbError(readErr, 'setDefaultTemplate.read');
  if (!target) return { ok: false, error: 'not_found' };

  // 1) Clear the current default(s) in this org (excluding the target).
  const { error: clearErr } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .update({ is_default: false })
    .eq('organization_id', guard.organizationId)
    .eq('is_default', true)
    .neq('id', templateId);

  if (clearErr) return mapDbError(clearErr, 'setDefaultTemplate.clear');

  // 2) Set the target as default.
  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .update({ is_default: true })
    .eq('id', templateId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'setDefaultTemplate');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

/**
 * Single lifecycle transition for questionnaire_templates.status, covering
 * publish / archive / restore with the SAME transition guards the builder UI
 * previously enforced inline:
 *   - publish  : only from 'draft' (archived must be restored first); idempotent
 *                on an already-published row.
 *   - archive  : only from 'published'; idempotent on an already-archived row.
 *   - restore  : archived -> draft; idempotent on an already-draft row.
 * This consolidates publishTemplate's logic and the UI's setStatus into one
 * validated, RLS-scoped write path. publishTemplate is retained as a thin alias
 * for callers that only need the publish case.
 */
export async function setTemplateStatus(
  templateId: string,
  status: QuestionnaireTemplateStatus,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!templateId) {
    return { ok: false, error: 'invalid_input', message: 'templateId is required' };
  }
  if (status !== 'draft' && status !== 'published' && status !== 'archived') {
    return {
      ok: false,
      error: 'invalid_input',
      message: "status must be one of: draft, published, archived",
    };
  }

  // Confirm ownership + read current status (RLS-scoped) so we can enforce the
  // legal transitions and short-circuit idempotent no-ops.
  const { data: existing, error: readErr } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .select('id, status')
    .eq('id', templateId)
    .eq('organization_id', guard.organizationId)
    .maybeSingle();

  if (readErr) return mapDbError(readErr, 'setTemplateStatus.read');
  if (!existing) return { ok: false, error: 'not_found' };

  const current = existing.status as QuestionnaireTemplateStatus;
  if (current === status) return { ok: true }; // idempotent

  // Transition guards (mirror the prior UI affordances: Publish on draft,
  // Archive on published, Restore on archived).
  if (status === 'published' && current !== 'draft') {
    return {
      ok: false,
      error: 'invalid_input',
      message:
        current === 'archived'
          ? 'cannot publish an archived template; restore it first'
          : `cannot publish a template in status '${current}'`,
    };
  }
  if (status === 'archived' && current !== 'published') {
    return {
      ok: false,
      error: 'invalid_input',
      message: `cannot archive a template in status '${current}'; publish it first`,
    };
  }
  if (status === 'draft' && current !== 'archived') {
    return {
      ok: false,
      error: 'invalid_input',
      message: `cannot restore a template in status '${current}'`,
    };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .update({ status })
    .eq('id', templateId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'setTemplateStatus');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

/**
 * Delete a template (org-scoped). ON DELETE CASCADE drops its questions and
 * logic; questionnaire_answers.question_id is ON DELETE RESTRICT, so a template
 * whose questions have recorded answers cannot be deleted — that surfaces as
 * code 23503 and maps to `constraint_violation` (answer history is protected).
 */
export async function deleteTemplate(
  templateId: string,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!templateId) {
    return { ok: false, error: 'invalid_input', message: 'templateId is required' };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .delete()
    .eq('id', templateId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'deleteTemplate');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

/**
 * Bind (or unbind) a published template to a plan via
 * plans.questionnaire_template_id. Both the plan and the template are scoped to
 * the caller's org. Pass templateId=null to unbind. We verify the template
 * exists in-org before binding (clean not_found instead of an FK 23503), but
 * intentionally do NOT require status='published' here so an admin can pre-bind;
 * the self-serve readers only surface published templates regardless.
 *
 * RLS: plans writes are gated by the same org/role predicate as the rest of the
 * admin product surface; the .eq('organization_id') double-scope keeps the write
 * tenant-isolated.
 */
export async function bindTemplateToPlan(
  planId: string,
  templateId: string | null,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!planId) {
    return { ok: false, error: 'invalid_input', message: 'planId is required' };
  }

  // When binding (not unbinding), confirm the template is in the caller's org.
  if (templateId) {
    const { data: template, error: tplErr } = await (guard.supabase as any)
      .from('questionnaire_templates')
      .select('id')
      .eq('id', templateId)
      .eq('organization_id', guard.organizationId)
      .maybeSingle();

    if (tplErr) return mapDbError(tplErr, 'bindTemplateToPlan.template');
    if (!template) {
      return { ok: false, error: 'not_found', message: 'template not found' };
    }
  }

  const { data, error } = await (guard.supabase as any)
    .from('plans')
    .update({ questionnaire_template_id: templateId })
    .eq('id', planId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'bindTemplateToPlan');
  if (!data || data.length === 0) {
    return { ok: false, error: 'not_found', message: 'plan not found' };
  }

  revalidateBuilder();
  return { ok: true };
}

// ============================================================================
// QUESTIONS
// ============================================================================

/**
 * Append (or insert at an explicit ordinal) a question to a template.
 * Validates type ∈ DB CHECK set and stamps organization_id from the parent
 * template (which must belong to the caller's org). When `ordinal` is omitted,
 * the question is appended after the current max ordinal in the template.
 * Maps UNIQUE (template_id, key) collisions to `duplicate`.
 */
export async function addQuestion(
  input: AddQuestionInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  const key = input.key?.trim();
  const label = input.label?.trim();
  if (!input.templateId || !key || !label) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'templateId, key, and label are required',
    };
  }
  if (!QUESTION_TYPES.includes(input.type)) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `type must be one of: ${QUESTION_TYPES.join(', ')}`,
    };
  }

  // Confirm the parent template is in the caller's org (RLS would also reject,
  // but this gives a clean not_found and a stable organization_id to stamp).
  const { data: template, error: tplErr } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .select('id')
    .eq('id', input.templateId)
    .eq('organization_id', guard.organizationId)
    .maybeSingle();

  if (tplErr) return mapDbError(tplErr, 'addQuestion.template');
  if (!template) return { ok: false, error: 'not_found', message: 'template not found' };

  // Resolve ordinal: explicit value, else append after current max.
  let ordinal = input.ordinal;
  if (ordinal === undefined) {
    const { data: maxRow } = await (guard.supabase as any)
      .from('questionnaire_questions')
      .select('ordinal')
      .eq('template_id', input.templateId)
      .order('ordinal', { ascending: false })
      .limit(1)
      .maybeSingle();
    ordinal = maxRow ? (maxRow.ordinal as number) + 1 : 0;
  }

  // options only meaningful for choice types; persist [] otherwise.
  const choiceType =
    input.type === 'radio' || input.type === 'checkbox' || input.type === 'select';
  const options = choiceType ? input.options ?? [] : [];

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_questions')
    .insert({
      organization_id: guard.organizationId,
      template_id: input.templateId,
      key,
      label,
      type: input.type,
      options,
      ordinal,
      section: input.section?.trim() || null,
      required: input.required ?? false,
      help_text: input.helpText?.trim() || null,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (error) return mapDbError(error, 'addQuestion');

  revalidateBuilder();
  return { ok: true, data: { id: data.id as string } };
}

/**
 * Update mutable fields on a single question. Validates `type` against the DB
 * CHECK set when provided. Org-scoped by id + organization_id.
 * When `type` is changed to a non-choice type, options are reset to [] unless
 * the caller passes their own options.
 */
export async function updateQuestion(
  input: UpdateQuestionInput,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!input.questionId) {
    return { ok: false, error: 'invalid_input', message: 'questionId is required' };
  }
  if (input.type !== undefined && !QUESTION_TYPES.includes(input.type)) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `type must be one of: ${QUESTION_TYPES.join(', ')}`,
    };
  }

  const updates: Record<string, unknown> = {};
  if (input.key !== undefined) {
    const key = input.key.trim();
    if (!key) return { ok: false, error: 'invalid_input', message: 'key cannot be empty' };
    updates.key = key;
  }
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) return { ok: false, error: 'invalid_input', message: 'label cannot be empty' };
    updates.label = label;
  }
  if (input.type !== undefined) updates.type = input.type;
  if (input.ordinal !== undefined) updates.ordinal = input.ordinal;
  if (input.section !== undefined) updates.section = input.section?.trim() || null;
  if (input.required !== undefined) updates.required = input.required;
  if (input.helpText !== undefined) updates.help_text = input.helpText?.trim() || null;
  if (input.metadata !== undefined) updates.metadata = input.metadata;

  if (input.options !== undefined) {
    updates.options = input.options;
  } else if (
    input.type !== undefined &&
    input.type !== 'radio' &&
    input.type !== 'checkbox' &&
    input.type !== 'select'
  ) {
    // Switched to a non-choice type without supplying options -> clear stale options.
    updates.options = [];
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'invalid_input', message: 'no fields to update' };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_questions')
    .update(updates)
    .eq('id', input.questionId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'updateQuestion');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

/**
 * Delete a question. ON DELETE CASCADE on questionnaire_logic drops any logic
 * rows referencing it as source or target. NOTE: questionnaire_answers.question_id
 * is ON DELETE RESTRICT, so a question with recorded answers cannot be deleted —
 * that surfaces as code 23503 and maps to `constraint_violation` (answer history
 * is protected by design).
 */
export async function deleteQuestion(
  questionId: string,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!questionId) {
    return { ok: false, error: 'invalid_input', message: 'questionId is required' };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_questions')
    .delete()
    .eq('id', questionId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'deleteQuestion');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

// ============================================================================
// LOGIC RULES
// ============================================================================

/**
 * Add a show/hide/require/skip logic rule wiring source -> target WITHIN one
 * template. condition uses the SHARED operator vocab (@crm-eco/lib/rules); the
 * DB mirrors it via questionnaire_logic_operators(). The same-template
 * integrity of source/target is enforced by trg_questionnaire_logic_validate —
 * a cross-template pairing raises check_violation (mapped to
 * `constraint_violation`). We validate action + operator up front for a clean
 * `invalid_input` before the round-trip.
 */
export async function addLogicRule(
  input: AddLogicRuleInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!input.templateId || !input.sourceQuestionId || !input.targetQuestionId) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'templateId, sourceQuestionId, and targetQuestionId are required',
    };
  }
  if (!LOGIC_ACTIONS.includes(input.action)) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `action must be one of: ${LOGIC_ACTIONS.join(', ')}`,
    };
  }
  const condition = input.condition;
  if (!condition || !condition.field || !condition.operator) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'condition.field and condition.operator are required',
    };
  }
  if (!RULE_CONDITION_OPERATORS.includes(condition.operator)) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `operator must be one of: ${RULE_CONDITION_OPERATORS.join(', ')}`,
    };
  }

  // Confirm the template belongs to the caller's org (clean not_found + stable
  // organization_id stamp). The trigger validates source/target membership.
  const { data: template, error: tplErr } = await (guard.supabase as any)
    .from('questionnaire_templates')
    .select('id')
    .eq('id', input.templateId)
    .eq('organization_id', guard.organizationId)
    .maybeSingle();

  if (tplErr) return mapDbError(tplErr, 'addLogicRule.template');
  if (!template) return { ok: false, error: 'not_found', message: 'template not found' };

  let ordinal = input.ordinal;
  if (ordinal === undefined) {
    const { data: maxRow } = await (guard.supabase as any)
      .from('questionnaire_logic')
      .select('ordinal')
      .eq('template_id', input.templateId)
      .order('ordinal', { ascending: false })
      .limit(1)
      .maybeSingle();
    ordinal = maxRow ? (maxRow.ordinal as number) + 1 : 0;
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_logic')
    .insert({
      organization_id: guard.organizationId,
      template_id: input.templateId,
      source_question_id: input.sourceQuestionId,
      target_question_id: input.targetQuestionId,
      action: input.action,
      condition: buildConditionJson(condition),
      ordinal,
    })
    .select('id')
    .single();

  if (error) return mapDbError(error, 'addLogicRule');

  revalidateBuilder();
  return { ok: true, data: { id: data.id as string } };
}

/**
 * Update a single logic rule (org-scoped by id + organization_id). Validates
 * action + condition.operator the same way addLogicRule does. The source/target
 * same-template integrity remains enforced by trg_questionnaire_logic_validate
 * (a cross-template pairing maps to `constraint_violation`). When `condition` is
 * supplied, the optional AND/OR group is persisted alongside the first-condition
 * mirror so the DB CHECK still sees a legal operator.
 */
export async function updateLogicRule(
  input: UpdateLogicRuleInput,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!input.logicId) {
    return { ok: false, error: 'invalid_input', message: 'logicId is required' };
  }
  if (input.action !== undefined && !LOGIC_ACTIONS.includes(input.action)) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `action must be one of: ${LOGIC_ACTIONS.join(', ')}`,
    };
  }

  const updates: Record<string, unknown> = {};
  if (input.sourceQuestionId !== undefined) {
    if (!input.sourceQuestionId) {
      return { ok: false, error: 'invalid_input', message: 'sourceQuestionId cannot be empty' };
    }
    updates.source_question_id = input.sourceQuestionId;
  }
  if (input.targetQuestionId !== undefined) {
    if (!input.targetQuestionId) {
      return { ok: false, error: 'invalid_input', message: 'targetQuestionId cannot be empty' };
    }
    updates.target_question_id = input.targetQuestionId;
  }
  if (input.action !== undefined) updates.action = input.action;
  if (input.condition !== undefined) {
    const condition = input.condition;
    if (!condition.field || !condition.operator) {
      return {
        ok: false,
        error: 'invalid_input',
        message: 'condition.field and condition.operator are required',
      };
    }
    if (!RULE_CONDITION_OPERATORS.includes(condition.operator)) {
      return {
        ok: false,
        error: 'invalid_input',
        message: `operator must be one of: ${RULE_CONDITION_OPERATORS.join(', ')}`,
      };
    }
    updates.condition = buildConditionJson(condition);
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'invalid_input', message: 'no fields to update' };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_logic')
    .update(updates)
    .eq('id', input.logicId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'updateLogicRule');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}

/**
 * Delete a single logic rule. Org-scoped by id + organization_id.
 */
export async function deleteLogicRule(
  logicId: string,
): Promise<ActionResult> {
  const guard = await authorize();
  if (!guard.ok) return guard;

  if (!logicId) {
    return { ok: false, error: 'invalid_input', message: 'logicId is required' };
  }

  const { data, error } = await (guard.supabase as any)
    .from('questionnaire_logic')
    .delete()
    .eq('id', logicId)
    .eq('organization_id', guard.organizationId)
    .select('id');

  if (error) return mapDbError(error, 'deleteLogicRule');
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  revalidateBuilder();
  return { ok: true };
}
