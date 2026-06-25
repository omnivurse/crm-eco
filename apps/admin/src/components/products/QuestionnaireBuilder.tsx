'use client';

/**
 * QuestionnaireBuilder — admin no-code questionnaire builder. [B3a-UI]
 *
 * Mirrors the established product-builder patterns:
 *   - page-embedded multi-tab shell + per-entity sub-dialogs (PricingMatrixEditor)
 *   - flat-form sub-dialog with a type picker + build/parse config (ProductEligibilityModal)
 *
 * Write path: the questionnaire SERVER ACTIONS in
 * @/app/(dashboard)/questionnaires/actions — the SINGLE write path. Every
 * create/update/delete (templates, questions, logic, default selection, status
 * lifecycle, plan binding) calls the corresponding 'use server' action, which
 * authorizes the actor, stamps organization_id, double-scopes by id +
 * organization_id, and centralizes validation + DB-error mapping (returning an
 * ActionResult this component toasts on failure). This component performs NO
 * direct-client writes.
 *
 * The questionnaire RLS (supabase/drafts/202606240002_questionnaire_engine.sql)
 * remains authoritative — the actions use the cookie/SSR Supabase client, so
 * writes are still gated to `organization_id = get_user_organization_id() AND
 * get_user_role() IN ('owner','admin','staff')`.
 *
 * Read path: the RLS-gated cookie/SSR browser client (`createClient()` from
 * @crm-eco/lib/supabase/client) is still used for SELECTs (template list,
 * questions, logic) so the builder can hydrate without an extra round-trip.
 *
 * Type vocabulary: the question type picker emits ONLY values that are legal
 * under the DB CHECK `questionnaire_questions_type_check`
 * (text/number/radio/checkbox/select/date/upload/section) — see QUESTION_TYPES.
 *
 * Operator vocabulary: conditional-logic conditions use the SHARED operator
 * vocab from @crm-eco/lib/rules (RULE_CONDITION_OPERATORS), which the DB mirrors
 * via questionnaire_logic_operators(). The logic editor emits a
 * RuleConditionGroup and persists each condition as the `condition` jsonb
 * `{ field, operator, value }` the questionnaire_logic table + validate trigger
 * expect.
 *
 * Self-contained: imports only existing admin UI primitives (@crm-eco/ui),
 * lucide-react icons, sonner, the RLS client, and the shared rules vocab. It
 * deliberately does NOT import @crm-eco/shared.
 */

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Switch,
  Textarea,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui';
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  GitBranch,
  CheckCircle2,
  Archive,
  Star,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RULE_CONDITION_OPERATORS,
  type RuleConditionOperator,
  type RuleCondition,
  type RuleConditionGroup,
} from '@crm-eco/lib/rules';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate as deleteTemplateAction,
  setDefaultTemplate,
  setTemplateStatus,
  bindTemplateToPlan,
  addQuestion,
  updateQuestion,
  deleteQuestion as deleteQuestionAction,
  addLogicRule,
  updateLogicRule,
  deleteLogicRule as deleteLogicRuleAction,
  type ActionResult,
  type QuestionnaireActionError,
} from '@/app/(dashboard)/questionnaires/actions';

// ---------------------------------------------------------------------------
// DB row contracts (byte-aligned with 202606240002_questionnaire_engine.sql)
// ---------------------------------------------------------------------------

type TemplateStatus = 'draft' | 'published' | 'archived';

interface QuestionnaireTemplateRow {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  version: number;
  status: TemplateStatus;
  is_default: boolean;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface QuestionnaireQuestionRow {
  id: string;
  organization_id: string;
  template_id: string;
  key: string;
  label: string;
  type: QuestionType;
  options: QuestionOption[];
  ordinal: number;
  section: string | null;
  required: boolean;
  help_text: string | null;
  metadata: Record<string, unknown>;
}

interface QuestionnaireLogicRow {
  id: string;
  organization_id: string;
  template_id: string;
  source_question_id: string;
  target_question_id: string;
  action: LogicAction;
  /**
   * Persisted shape mirrors the shared RuleConditionGroup so the AND/OR group
   * authored in the builder round-trips. The DB CHECK + validate trigger only
   * inspect `condition->>'operator'`; we store the full group plus a top-level
   * `operator` (the first condition's) so the CHECK has something legal to read.
   */
  condition: PersistedCondition;
  ordinal: number;
}

/**
 * jsonb stored in questionnaire_logic.condition. We keep the full
 * RuleConditionGroup (so the builder can re-edit AND/OR + multiple conditions)
 * AND surface a top-level `operator`/`field`/`value` mirror of the FIRST
 * condition so the row-level CHECK (`condition->>'operator' IN (...)`) and the
 * validate trigger see a legal operator. Both layers tolerate a missing operator.
 */
interface PersistedCondition {
  field?: string;
  operator?: RuleConditionOperator;
  value?: RuleCondition['value'];
  group?: RuleConditionGroup;
}

// ---------------------------------------------------------------------------
// Question type vocabulary — EXACTLY the DB CHECK set. The picker cannot emit
// anything the DB would reject. (Reconciliation note for B3 read-path below.)
// ---------------------------------------------------------------------------

type QuestionType =
  | 'text'
  | 'number'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'date'
  | 'upload'
  | 'section';

interface QuestionOption {
  value: string;
  label: string;
}

const QUESTION_TYPES: ReadonlyArray<{
  value: QuestionType;
  label: string;
  description: string;
  hasOptions: boolean;
  icon: LucideIcon;
}> = [
  { value: 'text', label: 'Short Text', description: 'Free-text single line', hasOptions: false, icon: FileText },
  { value: 'number', label: 'Number', description: 'Numeric input', hasOptions: false, icon: FileText },
  { value: 'radio', label: 'Single Choice', description: 'Pick exactly one option', hasOptions: true, icon: FileText },
  { value: 'checkbox', label: 'Multi Choice', description: 'Pick one or more options', hasOptions: true, icon: FileText },
  { value: 'select', label: 'Dropdown', description: 'Pick one from a dropdown', hasOptions: true, icon: FileText },
  { value: 'date', label: 'Date', description: 'Calendar date', hasOptions: false, icon: FileText },
  { value: 'upload', label: 'File Upload', description: 'Document / file attachment', hasOptions: false, icon: FileText },
  { value: 'section', label: 'Section Header', description: 'Layout header, not an input', hasOptions: false, icon: FileText },
];

function typeHasOptions(type: QuestionType): boolean {
  return QUESTION_TYPES.find((t) => t.value === type)?.hasOptions ?? false;
}

function typeLabel(type: QuestionType): string {
  return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

// ---------------------------------------------------------------------------
// Logic action vocabulary — EXACTLY the DB CHECK set (show/hide/require/skip).
// ---------------------------------------------------------------------------

type LogicAction = 'show' | 'hide' | 'require' | 'skip';

const LOGIC_ACTIONS: ReadonlyArray<{ value: LogicAction; label: string }> = [
  { value: 'show', label: 'Show target' },
  { value: 'hide', label: 'Hide target' },
  { value: 'require', label: 'Require target' },
  { value: 'skip', label: 'Skip target' },
];

const OPERATOR_LABELS: Record<RuleConditionOperator, string> = {
  eq: 'equals',
  neq: 'does not equal',
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal',
  lte: 'less than or equal',
  contains: 'contains',
  in: 'is one of',
  not_in: 'is not one of',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

/** Operators that take no right-hand value. */
const VALUELESS_OPERATORS: ReadonlyArray<RuleConditionOperator> = ['is_empty', 'is_not_empty'];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Map a failed server-action result to a user-facing message. The actions
 * return a structured { error } code (+ optional message); we translate the
 * code to friendly copy, falling back to a per-call default. This is the single
 * place the UI interprets action errors — every write goes through the actions.
 */
function actionErrorMessage(
  error: QuestionnaireActionError,
  fallback: string,
): string {
  switch (error) {
    case 'unauthorized':
      return 'Your session has expired — sign in again.';
    case 'no_tenant':
      return 'No active organization could be resolved.';
    case 'forbidden':
      return "You don't have permission to make this change.";
    case 'duplicate':
      return fallback;
    case 'constraint_violation':
      return fallback;
    case 'not_found':
      return 'That item no longer exists.';
    case 'invalid_input':
    case 'save_failed':
    default:
      return fallback;
  }
}

/**
 * Run a server action and toast on failure. Returns true on success so callers
 * can branch (e.g. close a dialog + reload) without repeating the ok-check.
 */
async function runAction(
  // Accepts any action result — data-bearing (ActionResult<{id}>) or void
  // (ActionResult<undefined>, which has no `data`); only ok/error are read.
  result: { ok: true; data?: unknown } | { ok: false; error: QuestionnaireActionError; message?: string },
  fallback: string,
): Promise<boolean> {
  if (result.ok) return true;
  toast.error(actionErrorMessage(result.error, fallback));
  return false;
}

// ===========================================================================
// Top-level builder
// ===========================================================================

interface QuestionnaireBuilderProps {
  organizationId: string;
  /** Optional plan to bind a published template to (plans.questionnaire_template_id). */
  planId?: string;
  planName?: string;
}

export function QuestionnaireBuilder({ organizationId, planId, planName }: QuestionnaireBuilderProps) {
  const supabase = createClient();

  const [templates, setTemplates] = useState<QuestionnaireTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Which template is open in the editor (null = list view).
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Template create/edit dialog
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuestionnaireTemplateRow | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      // The questionnaire_* tables are not yet in the generated Database type
      // (draft migration), so cast the client — same pattern the product pages
      // use for not-yet-typed columns/tables (e.g. `supabase.from('plans')...as any`).
      const { data, error: err } = await (supabase as any)
        .from('questionnaire_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true })
        .order('version', { ascending: false });

      if (err) throw err;
      setTemplates((data as QuestionnaireTemplateRow[]) || []);
    } catch (err) {
      console.error('Error loading questionnaire templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      toast.error('Failed to load questionnaire templates');
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // -- Template CRUD --------------------------------------------------------

  const saveTemplate = async (form: TemplateFormValues) => {
    setSaving(true);
    try {
      const result = editingTemplate
        ? await updateTemplate({
            templateId: editingTemplate.id,
            name: form.name,
            key: form.key,
            description: form.description || null,
          })
        : await createTemplate({
            key: form.key,
            name: form.name,
            description: form.description || null,
          });

      const ok = await runAction(
        result,
        result.ok
          ? ''
          : result.error === 'duplicate'
            ? 'A template with that key + version already exists for this org'
            : 'Failed to save template'
      );
      if (!ok) return;

      toast.success(editingTemplate ? 'Template updated' : 'Template created');
      await loadTemplates();
      setShowNewTemplate(false);
      setEditingTemplate(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (template: QuestionnaireTemplateRow) => {
    if (
      !confirm(
        `Delete template "${template.name}"? This removes its questions and logic. Recorded answers (questionnaire_answers) are protected and will block deletion if any exist.`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const result = await deleteTemplateAction(template.id);
      const ok = await runAction(
        result,
        'Failed to delete template — it may be in use by an enrollment'
      );
      if (!ok) return;
      toast.success('Template deleted');
      if (activeTemplateId === template.id) setActiveTemplateId(null);
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  };

  /**
   * Set a template as the org default. The DB enforces at-most-one default per
   * org via a partial-unique index, so we flip the prior default off first.
   */
  const setDefault = async (template: QuestionnaireTemplateRow) => {
    setSaving(true);
    try {
      const result = await setDefaultTemplate(template.id);
      const ok = await runAction(result, 'Failed to set default template');
      if (!ok) return;
      toast.success(`"${template.name}" is now the default questionnaire`);
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  };

  /** Transition a template through draft -> published -> archived. */
  const setStatus = async (template: QuestionnaireTemplateRow, status: TemplateStatus) => {
    setSaving(true);
    try {
      const result = await setTemplateStatus(template.id, status);
      const ok = await runAction(result, 'Failed to update template status');
      if (!ok) return;
      toast.success(`Template ${status === 'published' ? 'published' : status}`);
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  };

  /** Bind a published template to this plan (plans.questionnaire_template_id). */
  const bindToPlan = async (template: QuestionnaireTemplateRow) => {
    if (!planId) return;
    setSaving(true);
    try {
      const result = await bindTemplateToPlan(planId, template.id);
      const ok = await runAction(result, 'Failed to link template to plan');
      if (!ok) return;
      toast.success(`"${template.name}" linked to ${planName ?? 'this plan'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) ?? null;

  // ---- Editor view (a template is open) ----
  if (activeTemplate) {
    return (
      <TemplateEditor
        supabase={supabase}
        template={activeTemplate}
        onBack={() => setActiveTemplateId(null)}
      />
    );
  }

  // ---- List view ----
  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Questionnaire Templates
            </CardTitle>
            <CardDescription>
              Build the eligibility / intake questionnaire shown during self-serve enrollment.
              Only a <strong>published</strong> template is served; the org <strong>default</strong> is
              loaded when no plan-specific questionnaire is set.
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setEditingTemplate(null);
              setShowNewTemplate(true);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No questionnaire templates yet</p>
              <p className="text-sm">Create a template, add questions, then publish it.</p>
            </div>
          ) : (
            <div className="divide-y">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{template.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {template.key} v{template.version}
                      </Badge>
                      <StatusBadge status={template.status} />
                      {template.is_default && (
                        <Badge variant="default" className="gap-1">
                          <Star className="h-3 w-3" /> Default
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <Button variant="outline" size="sm" onClick={() => setActiveTemplateId(template.id)}>
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {template.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatus(template, 'published')}
                        disabled={saving}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Publish
                      </Button>
                    )}
                    {template.status === 'published' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatus(template, 'archived')}
                        disabled={saving}
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Archive
                      </Button>
                    )}
                    {template.status === 'archived' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatus(template, 'draft')}
                        disabled={saving}
                      >
                        Restore
                      </Button>
                    )}
                    {!template.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefault(template)}
                        disabled={saving}
                        title="Set as org default questionnaire"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    {planId && template.status === 'published' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => bindToPlan(template)}
                        disabled={saving}
                        title={`Link to ${planName ?? 'this plan'}`}
                      >
                        Link to plan
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowNewTemplate(true);
                      }}
                      title="Rename / edit details"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => deleteTemplate(template)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={showNewTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewTemplate(false);
            setEditingTemplate(null);
          }
        }}
        template={editingTemplate}
        onSave={saveTemplate}
        saving={saving}
      />
    </div>
  );
}

// ===========================================================================
// Status badge
// ===========================================================================

function StatusBadge({ status }: { status: TemplateStatus }) {
  if (status === 'published') return <Badge variant="default">Published</Badge>;
  if (status === 'archived') return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

// ===========================================================================
// Template create/edit dialog
// ===========================================================================

interface TemplateFormValues {
  name: string;
  key: string;
  description: string;
}

function TemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: QuestionnaireTemplateRow | null;
  onSave: (values: TemplateFormValues) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    queueMicrotask(() => {
      if (template) {
        setName(template.name);
        setKey(template.key);
        setKeyTouched(true);
        setDescription(template.description || '');
      } else {
        setName('');
        setKey('');
        setKeyTouched(false);
        setDescription('');
      }
    });
  }, [template, open]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!keyTouched) setKey(slugify(value));
  };

  const handleSubmit = () => {
    if (!name.trim() || !key.trim()) {
      toast.error('Name and key are required');
      return;
    }
    onSave({ name: name.trim(), key: key.trim(), description });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'New Questionnaire Template'}</DialogTitle>
          <DialogDescription>
            A template is a versioned, org-scoped set of questions. New templates start as a draft.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Medical Eligibility Intake"
            />
          </div>
          <div className="space-y-2">
            <Label>Key *</Label>
            <Input
              value={key}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(slugify(e.target.value));
              }}
              placeholder="e.g., medical_eligibility_intake"
              disabled={!!template}
            />
            <p className="text-xs text-slate-500">
              Stable identifier, unique per (org, key, version). {template ? 'Locked after creation.' : 'Auto-derived from the name.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what this questionnaire collects"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name || !key}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {template ? 'Save' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Template editor (Questions / Logic tabs)
// ===========================================================================

function TemplateEditor({
  supabase,
  template,
  onBack,
}: {
  supabase: ReturnType<typeof createClient>;
  template: QuestionnaireTemplateRow;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'questions' | 'logic'>('questions');
  const [questions, setQuestions] = useState<QuestionnaireQuestionRow[]>([]);
  const [logic, setLogic] = useState<QuestionnaireLogicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState<QuestionnaireQuestionRow | null>(null);
  const [showNewQuestion, setShowNewQuestion] = useState(false);

  const [editingLogic, setEditingLogic] = useState<QuestionnaireLogicRow | null>(null);
  const [showNewLogic, setShowNewLogic] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Cast the client: questionnaire_* tables aren't in the generated Database
      // type yet (draft migration). Same pattern as the product pages.
      const sb = supabase as any;
      const [qRes, lRes] = await Promise.all([
        sb
          .from('questionnaire_questions')
          .select('*')
          .eq('template_id', template.id)
          .order('ordinal', { ascending: true })
          .order('created_at', { ascending: true }),
        sb
          .from('questionnaire_logic')
          .select('*')
          .eq('template_id', template.id)
          .order('ordinal', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);
      if (qRes.error) throw qRes.error;
      if (lRes.error) throw lRes.error;
      setQuestions((qRes.data as QuestionnaireQuestionRow[]) || []);
      setLogic((lRes.data as QuestionnaireLogicRow[]) || []);
    } catch (err) {
      console.error('Error loading template detail:', err);
      toast.error('Failed to load questions / logic');
    } finally {
      setLoading(false);
    }
  }, [supabase, template.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const readonly = template.status === 'archived';

  // -- Question CRUD --------------------------------------------------------

  const saveQuestion = async (form: QuestionFormValues) => {
    setSaving(true);
    try {
      const options = typeHasOptions(form.type) ? form.options : [];
      const result = editingQuestion
        ? await updateQuestion({
            questionId: editingQuestion.id,
            key: form.key,
            label: form.label,
            type: form.type,
            required: form.required,
            section: form.section || null,
            helpText: form.help_text || null,
            options,
          })
        : await addQuestion({
            templateId: template.id,
            key: form.key,
            label: form.label,
            type: form.type,
            required: form.required,
            section: form.section || null,
            helpText: form.help_text || null,
            options,
            ordinal: questions.length,
          });

      const ok = await runAction(
        result,
        !result.ok && result.error === 'duplicate'
          ? 'A question with that key already exists in this template'
          : 'Failed to save question'
      );
      if (!ok) return;

      toast.success(editingQuestion ? 'Question updated' : 'Question added');
      await loadData();
      setShowNewQuestion(false);
      setEditingQuestion(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (q: QuestionnaireQuestionRow) => {
    if (!confirm(`Delete question "${q.label}"?`)) return;
    setSaving(true);
    try {
      const result = await deleteQuestionAction(q.id);
      const ok = await runAction(
        result,
        'Failed to delete question — it may be referenced by logic or a recorded answer'
      );
      if (!ok) return;
      toast.success('Question deleted');
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  /** Swap ordinals with the adjacent question. */
  const moveQuestion = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const a = questions[index];
    const b = questions[target];
    setSaving(true);
    try {
      const [resA, resB] = await Promise.all([
        updateQuestion({ questionId: a.id, ordinal: b.ordinal }),
        updateQuestion({ questionId: b.id, ordinal: a.ordinal }),
      ]);
      if (!resA.ok || !resB.ok) {
        toast.error('Failed to reorder');
        return;
      }
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  // -- Logic CRUD -----------------------------------------------------------

  const saveLogic = async (form: LogicFormValues) => {
    setSaving(true);
    try {
      // The action persists the full group AND a top-level operator mirror
      // (first condition) so the DB CHECK / validate trigger see a legal
      // operator. We hand it the first condition plus the group; the operator
      // must be present for the action's validation to pass.
      const first = form.group.conditions[0];
      if (!first?.operator || !first.field) {
        toast.error('Add at least one complete condition');
        return;
      }
      const condition = {
        field: first.field,
        operator: first.operator,
        value: first.value ?? null,
        group: form.group,
      };

      const result = editingLogic
        ? await updateLogicRule({
            logicId: editingLogic.id,
            sourceQuestionId: form.source_question_id,
            targetQuestionId: form.target_question_id,
            action: form.action,
            condition,
          })
        : await addLogicRule({
            templateId: template.id,
            sourceQuestionId: form.source_question_id,
            targetQuestionId: form.target_question_id,
            action: form.action,
            condition,
            ordinal: logic.length,
          });

      const ok = await runAction(
        result,
        !result.ok && result.error === 'constraint_violation'
          ? 'Source and target must both belong to this template'
          : 'Failed to save logic rule'
      );
      if (!ok) return;

      toast.success(editingLogic ? 'Rule updated' : 'Rule added');
      await loadData();
      setShowNewLogic(false);
      setEditingLogic(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteLogic = async (rule: QuestionnaireLogicRow) => {
    if (!confirm('Delete this logic rule?')) return;
    setSaving(true);
    try {
      const result = await deleteLogicRuleAction(rule.id);
      const ok = await runAction(result, 'Failed to delete rule');
      if (!ok) return;
      toast.success('Rule deleted');
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const questionLabel = (id: string) => questions.find((q) => q.id === id)?.label ?? '(deleted)';
  const questionKey = (id: string) => questions.find((q) => q.id === id)?.key ?? '?';

  return (
    <div className="space-y-6">
      {/* Editor header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Templates
          </Button>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {template.name}
              <StatusBadge status={template.status} />
              {template.is_default && (
                <Badge variant="default" className="gap-1">
                  <Star className="h-3 w-3" /> Default
                </Badge>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              {template.key} v{template.version}
            </p>
          </div>
        </div>
      </div>

      {readonly && (
        <div className="p-3 rounded-lg bg-slate-100 border text-slate-600 text-sm">
          This template is archived and read-only. Restore it from the template list to edit.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { key: 'questions' as const, label: 'Questions', icon: ClipboardList, count: questions.length },
          { key: 'logic' as const, label: 'Conditional Logic', icon: GitBranch, count: logic.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <Badge variant="outline" className="ml-1">
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'questions' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>Ordered fields shown to the enrollee.</CardDescription>
            </div>
            <Button
              size="sm"
              disabled={readonly}
              onClick={() => {
                setEditingQuestion(null);
                setShowNewQuestion(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No questions yet.</p>
            ) : (
              <div className="divide-y">
                {questions.map((q, index) => (
                  <div key={q.id} className="flex items-center gap-3 py-3">
                    <div className="flex flex-col">
                      <button
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        disabled={readonly || index === 0 || saving}
                        onClick={() => moveQuestion(index, -1)}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        disabled={readonly || index === questions.length - 1 || saving}
                        onClick={() => moveQuestion(index, 1)}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{q.label}</span>
                        <Badge variant="outline">{typeLabel(q.type)}</Badge>
                        {q.required && <Badge variant="secondary">Required</Badge>}
                        {q.section && <Badge variant="outline">§ {q.section}</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{q.key}</p>
                      {typeHasOptions(q.type) && q.options?.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          Options: {q.options.map((o) => o.label).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={readonly}
                        onClick={() => {
                          setEditingQuestion(q);
                          setShowNewQuestion(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        disabled={readonly || saving}
                        onClick={() => deleteQuestion(q)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Conditional Logic</CardTitle>
              <CardDescription>
                Show / hide / require / skip a target question based on the answer to another.
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={readonly || questions.length < 2}
              onClick={() => {
                setEditingLogic(null);
                setShowNewLogic(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </CardHeader>
          <CardContent>
            {questions.length < 2 ? (
              <p className="text-center text-slate-500 py-8">
                Add at least two questions before authoring logic.
              </p>
            ) : logic.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No logic rules yet.</p>
            ) : (
              <div className="divide-y">
                {logic.map((rule) => {
                  const group = rule.condition?.group;
                  return (
                    <div key={rule.id} className="flex items-start gap-3 py-3">
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="default" className="capitalize">
                            {rule.action}
                          </Badge>
                          <span className="font-medium">{questionLabel(rule.target_question_id)}</span>
                          <span className="text-slate-400">when</span>
                          <span className="font-mono text-xs">{questionKey(rule.source_question_id)}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {group && group.conditions.length > 0
                            ? group.conditions
                                .map(
                                  (c) =>
                                    `${c.field} ${OPERATOR_LABELS[c.operator]}${
                                      VALUELESS_OPERATORS.includes(c.operator)
                                        ? ''
                                        : ` "${Array.isArray(c.value) ? c.value.join(', ') : c.value ?? ''}"`
                                    }`
                                )
                                .join(` ${group.logic} `)
                            : 'no condition set'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={readonly}
                          onClick={() => {
                            setEditingLogic(rule);
                            setShowNewLogic(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          disabled={readonly || saving}
                          onClick={() => deleteLogic(rule)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <QuestionDialog
        open={showNewQuestion}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewQuestion(false);
            setEditingQuestion(null);
          }
        }}
        question={editingQuestion}
        existingKeys={questions.map((q) => q.key)}
        onSave={saveQuestion}
        saving={saving}
      />

      <LogicDialog
        open={showNewLogic}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewLogic(false);
            setEditingLogic(null);
          }
        }}
        rule={editingLogic}
        questions={questions}
        onSave={saveLogic}
        saving={saving}
      />
    </div>
  );
}

// ===========================================================================
// Question create/edit dialog
// ===========================================================================

interface QuestionFormValues {
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  section: string;
  help_text: string;
  options: QuestionOption[];
}

function QuestionDialog({
  open,
  onOpenChange,
  question,
  existingKeys,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionnaireQuestionRow | null;
  existingKeys: string[];
  onSave: (values: QuestionFormValues) => Promise<void>;
  saving: boolean;
}) {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<QuestionType>('text');
  const [required, setRequired] = useState(false);
  const [section, setSection] = useState('');
  const [helpText, setHelpText] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      if (question) {
        setLabel(question.label);
        setKey(question.key);
        setKeyTouched(true);
        setType(question.type);
        setRequired(question.required);
        setSection(question.section || '');
        setHelpText(question.help_text || '');
        setOptions(Array.isArray(question.options) ? question.options : []);
      } else {
        setLabel('');
        setKey('');
        setKeyTouched(false);
        setType('text');
        setRequired(false);
        setSection('');
        setHelpText('');
        setOptions([]);
      }
    });
  }, [question, open]);

  const handleLabelChange = (value: string) => {
    setLabel(value);
    if (!keyTouched) setKey(slugify(value));
  };

  const addOption = () => setOptions((prev) => [...prev, { value: '', label: '' }]);
  const updateOption = (index: number, patch: Partial<QuestionOption>) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  const removeOption = (index: number) => setOptions((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = () => {
    if (!label.trim() || !key.trim()) {
      toast.error('Label and key are required');
      return;
    }
    if (!question && existingKeys.includes(key.trim())) {
      toast.error('A question with that key already exists in this template');
      return;
    }
    if (typeHasOptions(type)) {
      const clean = options
        .map((o) => ({ value: (o.value || slugify(o.label)).trim(), label: o.label.trim() }))
        .filter((o) => o.label);
      if (clean.length === 0) {
        toast.error('Choice questions need at least one option');
        return;
      }
      onSave({ key: key.trim(), label: label.trim(), type, required, section, help_text: helpText, options: clean });
      return;
    }
    onSave({ key: key.trim(), label: label.trim(), type, required, section, help_text: helpText, options: [] });
  };

  const isSection = type === 'section';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? 'Edit Question' : 'Add Question'}</DialogTitle>
          <DialogDescription>
            {isSection
              ? 'A section header is a layout divider, not an answerable field.'
              : 'Configure the field shown to the enrollee.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type picker */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {QUESTION_TYPES.map((t) => (
                <div
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                    type === t.value ? 'border-teal-500 bg-teal-50' : 'hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-slate-500">{t.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label>{isSection ? 'Section Title *' : 'Question Label *'}</Label>
            <Input
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder={isSection ? 'e.g., Medical History' : 'e.g., Do you use tobacco?'}
            />
          </div>

          {/* Key */}
          <div className="space-y-2">
            <Label>Key *</Label>
            <Input
              value={key}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(slugify(e.target.value));
              }}
              placeholder="auto-derived from the label"
              disabled={!!question}
            />
            <p className="text-xs text-slate-500">
              Stable identifier, unique per template. {question ? 'Locked after creation.' : ''} Logic
              conditions reference this key.
            </p>
          </div>

          {/* Options (choice types only) */}
          {typeHasOptions(type) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options *</Label>
                <Button variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Option
                </Button>
              </div>
              {options.length === 0 && (
                <p className="text-xs text-slate-500">No options yet — add at least one.</p>
              )}
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt.label}
                      onChange={(e) => updateOption(i, { label: e.target.value })}
                      placeholder="Label shown to user"
                    />
                    <Input
                      value={opt.value}
                      onChange={(e) => updateOption(i, { value: slugify(e.target.value) })}
                      placeholder="value (auto)"
                      className="w-40"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 shrink-0"
                      onClick={() => removeOption(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section grouping (non-section questions) */}
          {!isSection && (
            <div className="space-y-2">
              <Label>Section</Label>
              <Input
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="Optional grouping label (e.g., Medical History)"
              />
            </div>
          )}

          {/* Help text */}
          {!isSection && (
            <div className="space-y-2">
              <Label>Help Text</Label>
              <Textarea
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Optional helper text shown under the field"
              />
            </div>
          )}

          {/* Required */}
          {!isSection && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Required</p>
                <p className="text-sm text-slate-500">Enrollee must answer to continue</p>
              </div>
              <Switch checked={required} onCheckedChange={setRequired} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !label || !key}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {question ? 'Save' : 'Add Question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Logic rule create/edit dialog
// ===========================================================================

interface LogicFormValues {
  source_question_id: string;
  target_question_id: string;
  action: LogicAction;
  group: RuleConditionGroup;
}

function LogicDialog({
  open,
  onOpenChange,
  rule,
  questions,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: QuestionnaireLogicRow | null;
  questions: QuestionnaireQuestionRow[];
  onSave: (values: LogicFormValues) => Promise<void>;
  saving: boolean;
}) {
  const answerable = questions.filter((q) => q.type !== 'section');

  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [action, setAction] = useState<LogicAction>('show');
  const [groupLogic, setGroupLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { field: '', operator: 'eq', value: '' },
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      if (rule) {
        setSourceId(rule.source_question_id);
        setTargetId(rule.target_question_id);
        setAction(rule.action);
        const grp = rule.condition?.group;
        if (grp && grp.conditions.length > 0) {
          setGroupLogic(grp.logic);
          setConditions(grp.conditions);
        } else if (rule.condition?.operator) {
          setGroupLogic('AND');
          setConditions([
            {
              field: rule.condition.field ?? '',
              operator: rule.condition.operator,
              value: rule.condition.value ?? '',
            },
          ]);
        } else {
          setGroupLogic('AND');
          setConditions([{ field: '', operator: 'eq', value: '' }]);
        }
      } else {
        setSourceId(answerable[0]?.id ?? '');
        setTargetId(answerable[1]?.id ?? answerable[0]?.id ?? '');
        setAction('show');
        setGroupLogic('AND');
        setConditions([{ field: answerable[0]?.key ?? '', operator: 'eq', value: '' }]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, open]);

  // Keep the condition `field` aligned with the chosen source question's key.
  const sourceKey = questions.find((q) => q.id === sourceId)?.key ?? '';

  const updateCondition = (index: number, patch: Partial<RuleCondition>) =>
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const addCondition = () =>
    setConditions((prev) => [...prev, { field: sourceKey, operator: 'eq', value: '' }]);
  const removeCondition = (index: number) =>
    setConditions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleSubmit = () => {
    if (!sourceId || !targetId) {
      toast.error('Pick a source and a target question');
      return;
    }
    if (sourceId === targetId) {
      toast.error('Source and target must be different questions');
      return;
    }
    const cleaned: RuleCondition[] = conditions
      .map((c) => {
        // default the condition field to the source question's key
        const field = c.field?.trim() || sourceKey;
        let value: RuleCondition['value'];
        if (VALUELESS_OPERATORS.includes(c.operator)) {
          value = null;
        } else if (c.operator === 'in' || c.operator === 'not_in') {
          // membership operators expect an array (evaluateCondition checks
          // Array.isArray(right)); split the comma-separated input.
          value = Array.isArray(c.value)
            ? c.value
            : String(c.value ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        } else {
          value = c.value;
        }
        return { field, operator: c.operator, value };
      })
      .filter((c) => c.field);
    if (cleaned.length === 0) {
      toast.error('Add at least one condition');
      return;
    }
    onSave({
      source_question_id: sourceId,
      target_question_id: targetId,
      action,
      group: { logic: groupLogic, conditions: cleaned },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Logic Rule' : 'Add Logic Rule'}</DialogTitle>
          <DialogDescription>
            Both the source and target question must belong to this template (enforced by the DB).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action */}
          <div className="space-y-2">
            <Label>Action</Label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={action}
              onChange={(e) => setAction(e.target.value as LogicAction)}
            >
              {LOGIC_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target */}
          <div className="space-y-2">
            <Label>Target question (the one affected)</Label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select…</option>
              {answerable.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label} ({q.key})
                </option>
              ))}
            </select>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Based on the answer to (source question)</Label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={sourceId}
              onChange={(e) => {
                const newId = e.target.value;
                setSourceId(newId);
                const newKey = questions.find((q) => q.id === newId)?.key ?? '';
                // realign any conditions still pointing at the old source key
                setConditions((prev) =>
                  prev.map((c) => (c.field === sourceKey || !c.field ? { ...c, field: newKey } : c))
                );
              }}
            >
              <option value="">Select…</option>
              {answerable.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label} ({q.key})
                </option>
              ))}
            </select>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              {conditions.length > 1 && (
                <select
                  className="border rounded-md px-2 py-1 text-sm"
                  value={groupLogic}
                  onChange={(e) => setGroupLogic(e.target.value as 'AND' | 'OR')}
                >
                  <option value="AND">Match ALL (AND)</option>
                  <option value="OR">Match ANY (OR)</option>
                </select>
              )}
            </div>
            <div className="space-y-2">
              {conditions.map((c, i) => {
                const valueless = VALUELESS_OPERATORS.includes(c.operator);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={c.field}
                      onChange={(e) => updateCondition(i, { field: e.target.value })}
                      placeholder={sourceKey || 'field key'}
                      className="w-36"
                    />
                    <select
                      className="border rounded-lg px-2 py-2 text-sm"
                      value={c.operator}
                      onChange={(e) =>
                        updateCondition(i, { operator: e.target.value as RuleConditionOperator })
                      }
                    >
                      {RULE_CONDITION_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={
                        valueless
                          ? ''
                          : Array.isArray(c.value)
                            ? c.value.join(', ')
                            : c.value?.toString() ?? ''
                      }
                      onChange={(e) => updateCondition(i, { value: e.target.value })}
                      placeholder={
                        valueless
                          ? '— no value —'
                          : c.operator === 'in' || c.operator === 'not_in'
                            ? 'comma,separated,values'
                            : 'value'
                      }
                      disabled={valueless}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 shrink-0"
                      disabled={conditions.length === 1}
                      onClick={() => removeCondition(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-3 w-3 mr-1" />
              Add Condition
            </Button>
            <p className="text-xs text-slate-500">
              The condition <span className="font-mono">field</span> defaults to the source
              question&apos;s key. Operators come from the shared rule vocabulary.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !sourceId || !targetId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {rule ? 'Save Rule' : 'Add Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
