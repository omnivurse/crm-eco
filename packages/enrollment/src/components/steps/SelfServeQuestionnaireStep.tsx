'use client';

import { useMemo, useState } from 'react';
import { Input, Label, Button, Card, CardContent } from '@crm-eco/ui';
import { Loader2, ArrowRight } from 'lucide-react';
import { evaluateRuleConditionGroup } from '@crm-eco/lib/rules';
import type {
  QuestionnaireTemplate,
  QuestionnaireQuestion,
  QuestionnaireAnswers,
} from '../../types';

interface SelfServeQuestionnaireStepProps {
  /**
   * The DB-driven template (questions + conditional logic). When undefined, the
   * step renders nothing and reports nothing — the wizard skips it. This is the
   * inert MVP state until a template is wired/loaded.
   */
  template?: QuestionnaireTemplate;
  /** Previously-saved answers, used to re-hydrate on resume. */
  answers?: QuestionnaireAnswers;
  onComplete: (templateId: string, answers: QuestionnaireAnswers) => void;
  loading: boolean;
}

/**
 * Coerce a raw input value to the answer shape implied by the question type.
 * Mirrors the lightweight, client-side normalization the compliance step does
 * for its checkbox/text fields.
 */
function coerceValue(question: QuestionnaireQuestion, raw: unknown): unknown {
  switch (question.type) {
    case 'number': {
      if (raw === '' || raw === null || raw === undefined) return undefined;
      const n = Number(raw);
      return Number.isNaN(n) ? undefined : n;
    }
    case 'checkbox':
      // Multi-select checkbox group -> string[] of chosen option values.
      return Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    // text / radio / select / date / upload all carry a plain string value.
    default:
      return raw;
  }
}

function isAnswerEmpty(question: QuestionnaireQuestion, value: unknown): boolean {
  if (question.type === 'checkbox') {
    return !Array.isArray(value) || value.length === 0;
  }
  // section is a non-input layout element and is never validated (filtered out
  // before this is reached), so the remaining types are all string/number.
  return value === null || value === undefined || value === '';
}

/**
 * A `section` is a layout heading/divider, not a data field: it carries no
 * answer, is never required-validated, and is excluded from the emitted answer
 * map. Every other type is an input that produces an answer.
 */
function isInputQuestion(question: QuestionnaireQuestion): boolean {
  return question.type !== 'section';
}

export function SelfServeQuestionnaireStep({
  template,
  answers,
  onComplete,
  loading,
}: SelfServeQuestionnaireStepProps) {
  const [formData, setFormData] = useState<QuestionnaireAnswers>(() => ({
    ...(answers ?? {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Conditional visibility is derived from the current answers using the SHARED
  // operator vocabulary (same engine as the CRM approval rules). A question with
  // no `visible_when` always shows.
  const visibleQuestions = useMemo<QuestionnaireQuestion[]>(() => {
    if (!template) return [];
    return template.questions.filter((q) =>
      q.visible_when ? evaluateRuleConditionGroup(q.visible_when, formData) : true
    );
  }, [template, formData]);

  // INERT MVP STATE: no template => render nothing, emit nothing. The wizard
  // treats this step as a no-op and skips it.
  if (!template || template.questions.length === 0) {
    return null;
  }

  const setAnswer = (question: QuestionnaireQuestion, raw: unknown) => {
    setFormData((prev) => ({ ...prev, [question.key]: coerceValue(question, raw) }));
  };

  const toggleCheckbox = (question: QuestionnaireQuestion, optionValue: string) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[question.key]) ? (prev[question.key] as string[]) : [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [question.key]: next };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const q of visibleQuestions) {
      // `section` is a non-input heading: never required-validated.
      if (isInputQuestion(q) && q.required && isAnswerEmpty(q, formData[q.key])) {
        newErrors[q.key] = 'This question is required';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Only emit answers for questions that are currently visible AND are inputs
    // (a `section` carries no answer), so hidden (logic-suppressed) or layout-only
    // questions never leak values downstream.
    const visibleAnswerKeys = new Set(
      visibleQuestions.filter(isInputQuestion).map((q) => q.key)
    );
    const emitted: QuestionnaireAnswers = {};
    for (const key of Object.keys(formData)) {
      if (visibleAnswerKeys.has(key)) emitted[key] = formData[key];
    }
    onComplete(template.id, emitted);
  };

  const renderField = (question: QuestionnaireQuestion) => {
    const value = formData[question.key];

    switch (question.type) {
      case 'radio':
        // Single-choice option group -> string answer.
        return (
          <div className="space-y-2" role="radiogroup" aria-label={question.label}>
            {(question.options ?? []).map((opt) => {
              const checked = value === opt.value;
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 text-left text-sm text-slate-700 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={question.key}
                    value={opt.value}
                    checked={checked}
                    onChange={() => setAnswer(question, opt.value)}
                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        );

      case 'checkbox':
        // Multi-select option group -> string[] answer.
        return (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => {
              const checked = Array.isArray(value) && (value as string[]).includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 text-left text-sm text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name={question.key}
                    value={opt.value}
                    checked={checked}
                    onChange={() => toggleCheckbox(question, opt.value)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        );

      case 'select':
        return (
          <select
            id={question.key}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setAnswer(question, e.target.value)}
            className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${
              errors[question.key] ? 'border-red-500' : 'border-input'
            }`}
          >
            <option value="">Select...</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <Input
            id={question.key}
            type="number"
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => setAnswer(question, e.target.value)}
            className={errors[question.key] ? 'border-red-500' : ''}
          />
        );

      case 'date':
        // Native date input -> 'YYYY-MM-DD' string answer.
        return (
          <Input
            id={question.key}
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setAnswer(question, e.target.value)}
            className={errors[question.key] ? 'border-red-500' : ''}
          />
        );

      case 'upload':
        // Minimal upload: capture the selected file's name as the answer (no
        // binary upload path exists yet — the persisted value is JSON-safe).
        return (
          <Input
            id={question.key}
            type="file"
            onChange={(e) => setAnswer(question, e.target.files?.[0]?.name ?? '')}
            className={errors[question.key] ? 'border-red-500' : ''}
          />
        );

      case 'text':
      default:
        return (
          <Input
            id={question.key}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setAnswer(question, e.target.value)}
            className={errors[question.key] ? 'border-red-500' : ''}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(template.title || template.description) && (
        <div>
          {template.title && (
            <h4 className="font-semibold text-slate-900 mb-1">{template.title}</h4>
          )}
          {template.description && (
            <p className="text-sm text-slate-600">{template.description}</p>
          )}
        </div>
      )}

      {visibleQuestions.map((question) =>
        question.type === 'section' ? (
          // A `section` is a non-input layout heading/divider: no Card, no Label,
          // no field, no answer. It groups the inputs that follow it.
          <div key={question.key} className="pt-2 border-t border-slate-200 first:border-t-0 first:pt-0">
            <h4 className="font-semibold text-slate-900">{question.label}</h4>
            {question.help_text && (
              <p className="text-sm text-slate-500 mt-1">{question.help_text}</p>
            )}
          </div>
        ) : (
          <Card key={question.key}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor={question.key}>
                  {question.label}
                  {question.required ? ' *' : ''}
                </Label>
                {question.help_text && (
                  <p className="text-sm text-slate-500">{question.help_text}</p>
                )}
                {renderField(question)}
                {errors[question.key] && (
                  <p className="text-sm text-red-600">{errors[question.key]}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
