'use client';

import { useState, useEffect } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import { cn } from '@crm-eco/ui/lib/utils';
import { Mail, Clock, GitBranch, Loader2, CornerDownRight } from 'lucide-react';
import { toast } from 'sonner';
import type {
  BranchAction,
  ConditionConfig,
  ConditionOperator,
  ConditionType,
  SequenceStep,
  StepType,
} from '@/lib/sequences/types';
import { branchTargets, stepLabel } from '@/lib/sequences/branching';
import { toastCopy } from '@/lib/crm/toast-copy';

interface SequenceStepEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (step: Partial<SequenceStep>) => Promise<void>;
  step?: SequenceStep | null;
  /** Siblings, so a condition can name the step it jumps to. */
  steps?: SequenceStep[];
}

/** Only conditions the engine can actually evaluate are offered. */
const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: 'email_opened', label: 'Opened a previous email' },
  { value: 'email_not_opened', label: 'Did NOT open a previous email' },
  { value: 'link_clicked', label: 'Clicked a link' },
  { value: 'link_not_clicked', label: 'Did NOT click a link' },
  { value: 'replied', label: 'Replied' },
  { value: 'not_replied', label: 'Did NOT reply' },
  { value: 'field_value', label: 'Contact field value' },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_not_set', label: 'is empty' },
];

const WINDOW_OPTIONS = [
  { value: '0', label: 'Any time' },
  { value: '12', label: 'Within 12 hours' },
  { value: '24', label: 'Within 24 hours' },
  { value: '48', label: 'Within 48 hours' },
  { value: '72', label: 'Within 72 hours' },
  { value: '168', label: 'Within 7 days' },
];

const STEP_TYPES: { value: StepType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'email',
    label: 'Send Email',
    icon: <Mail className="w-5 h-5" />,
    description: 'Send an email to the contact',
  },
  {
    value: 'wait',
    label: 'Wait',
    icon: <Clock className="w-5 h-5" />,
    description: 'Wait for a period of time',
  },
  {
    value: 'condition',
    label: 'Condition',
    icon: <GitBranch className="w-5 h-5" />,
    description: 'Branch based on a condition',
  },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

/** Blank condition state for a new step. */
function emptyCondition() {
  return {
    condition_type: 'email_opened' as ConditionType,
    condition_window: '24',
    condition_field: '',
    condition_operator: 'equals' as ConditionOperator,
    condition_value: '',
    then_action: 'next' as BranchAction,
    then_step_id: '',
    else_action: 'next' as BranchAction,
    else_step_id: '',
  };
}

/** Read an existing step's condition_config back into form state. */
function conditionFromStep(step: SequenceStep) {
  const config = (step.condition_config ?? null) as ConditionConfig | null;
  const blank = emptyCondition();
  if (!config) return blank;

  return {
    condition_type: config.type ?? blank.condition_type,
    condition_window:
      typeof config.window_hours === 'number' ? String(config.window_hours) : blank.condition_window,
    condition_field: config.field ?? '',
    condition_operator: config.operator ?? blank.condition_operator,
    condition_value: config.value === undefined || config.value === null ? '' : String(config.value),
    // A bare step id with no action is how earlier configs expressed a jump.
    then_action: config.then_action ?? (config.then_step_id ? 'step' : 'next'),
    then_step_id: config.then_step_id ?? '',
    else_action: config.else_action ?? (config.else_step_id ? 'step' : 'next'),
    else_step_id: config.else_step_id ?? '',
  };
}

export function SequenceStepEditor({
  open,
  onClose,
  onSave,
  step,
  steps = [],
}: SequenceStepEditorProps) {
  const [saving, setSaving] = useState(false);
  const [stepType, setStepType] = useState<StepType>('email');
  const [formData, setFormData] = useState({
    name: '',
    delay_days: 0,
    delay_hours: 0,
    delay_minutes: 0,
    subject: '',
    body_html: '',
    body_text: '',
    from_name: '',
    from_email: '',
    send_time: '',
    send_days: [] as string[],
    ...emptyCondition(),
  });

  useEffect(() => {
    if (step) {
      setStepType(step.step_type);
      setFormData({
        name: step.name || '',
        delay_days: step.delay_days || 0,
        delay_hours: step.delay_hours || 0,
        delay_minutes: step.delay_minutes || 0,
        subject: step.subject || '',
        body_html: step.body_html || '',
        body_text: step.body_text || '',
        from_name: step.from_name || '',
        from_email: step.from_email || '',
        send_time: step.send_time || '',
        send_days: step.send_days || [],
        ...conditionFromStep(step),
      });
    } else {
      // Reset form for new step
      setStepType('email');
      setFormData({
        name: '',
        delay_days: 0,
        delay_hours: 0,
        delay_minutes: 0,
        subject: '',
        body_html: '',
        body_text: '',
        from_name: '',
        from_email: '',
        send_time: '',
        send_days: [] as string[],
        ...emptyCondition(),
      });
    }
  }, [step, open]);

  async function handleSave() {
    // Validation
    if (stepType === 'email' && !formData.subject.trim()) {
      toast.error('Please enter an email subject');
      return;
    }

    if (stepType === 'wait' && formData.delay_days === 0 && formData.delay_hours === 0 && formData.delay_minutes === 0) {
      toast.error('Please set a wait duration');
      return;
    }

    if (stepType === 'condition') {
      if (!formData.name.trim()) {
        toast.error('Please enter a condition name');
        return;
      }
      if (formData.condition_type === 'field_value' && !formData.condition_field.trim()) {
        toast.error(toastCopy.chooseFirst('a field to check'));
        return;
      }
      if (formData.then_action === 'step' && !formData.then_step_id) {
        toast.error(toastCopy.chooseFirst('the step to jump to when the condition is met'));
        return;
      }
      if (formData.else_action === 'step' && !formData.else_step_id) {
        toast.error(
          toastCopy.chooseFirst('the step to jump to when the condition is not met'),
        );
        return;
      }
    }

    setSaving(true);
    try {
      // Built explicitly rather than spreading form state: the condition
      // fields are not columns, they belong inside condition_config, and the
      // API silently drops anything it does not recognise.
      const payload: Partial<SequenceStep> = {
        step_type: stepType,
        name: formData.name,
        delay_days: formData.delay_days,
        delay_hours: formData.delay_hours,
        delay_minutes: formData.delay_minutes,
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_text,
        from_name: formData.from_name,
        from_email: formData.from_email,
        send_time: formData.send_time,
        send_days: formData.send_days,
      };

      if (stepType === 'condition') {
        const isFieldCheck = formData.condition_type === 'field_value';
        const windowHours = Number(formData.condition_window);

        const config: ConditionConfig = {
          type: formData.condition_type,
          then_action: formData.then_action,
          else_action: formData.else_action,
        };

        if (!isFieldCheck && Number.isFinite(windowHours) && windowHours > 0) {
          config.window_hours = windowHours;
        }

        if (isFieldCheck) {
          config.field = formData.condition_field.trim();
          config.operator = formData.condition_operator;
          // "is set" / "is empty" take no comparison value.
          if (
            formData.condition_operator !== 'is_set' &&
            formData.condition_operator !== 'is_not_set'
          ) {
            config.value = formData.condition_value;
          }
        }

        if (formData.then_action === 'step') config.then_step_id = formData.then_step_id;
        if (formData.else_action === 'step') config.else_step_id = formData.else_step_id;

        payload.condition_config = config;
      }

      await onSave(payload);
    } catch (error) {
      console.error('Error saving step:', error);
      toast.error('Failed to save step');
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day: number) {
    const dayStr = String(day);
    setFormData(prev => ({
      ...prev,
      send_days: prev.send_days.includes(dayStr)
        ? prev.send_days.filter(d => d !== dayStr)
        : [...prev.send_days, dayStr].sort((a, b) => Number(a) - Number(b)),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : 'Add Step'}</DialogTitle>
          <DialogDescription>
            {step ? 'Update the step configuration' : 'Choose a step type and configure it'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step Type Selection */}
          {!step && (
            <div className="space-y-2">
              <Label>Step Type</Label>
              <div className="grid grid-cols-3 gap-3">
                {STEP_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setStepType(type.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all',
                      stepType === type.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      stepType === type.value
                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    )}>
                      {type.icon}
                    </div>
                    <span className={cn(
                      'font-medium text-sm',
                      stepType === type.value
                        ? 'text-violet-900 dark:text-violet-100'
                        : 'text-slate-900 dark:text-white'
                    )}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delay Settings */}
          <div className="space-y-2">
            <Label>Delay Before This Step</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Input
                  type="number"
                  min="0"
                  value={formData.delay_days}
                  onChange={(e) => setFormData({ ...formData, delay_days: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <span className="text-xs text-slate-500 mt-1 block">Days</span>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={formData.delay_hours}
                  onChange={(e) => setFormData({ ...formData, delay_hours: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <span className="text-xs text-slate-500 mt-1 block">Hours</span>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={formData.delay_minutes}
                  onChange={(e) => setFormData({ ...formData, delay_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <span className="text-xs text-slate-500 mt-1 block">Minutes</span>
              </div>
            </div>
          </div>

          {/* Email Step Configuration */}
          {stepType === 'email' && (
            <Tabs defaultValue="content" className="space-y-4">
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Step Name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Welcome Email, Follow-up #1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line *</Label>
                  <Input
                    id="subject"
                    placeholder="Enter email subject..."
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    Use merge fields: {'{{contact.first_name}}'}, {'{{contact.company}}'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body_html">Email Body</Label>
                  <Textarea
                    id="body_html"
                    placeholder="Write your email content here..."
                    value={formData.body_html}
                    onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    You can use HTML or plain text. Merge fields are supported.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from_name">From Name</Label>
                  <Input
                    id="from_name"
                    placeholder="Leave blank to use default"
                    value={formData.from_name}
                    onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from_email">From Email</Label>
                  <Input
                    id="from_email"
                    type="email"
                    placeholder="Leave blank to use default"
                    value={formData.from_email}
                    onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="space-y-2">
                  <Label>Send Time (optional)</Label>
                  <Input
                    type="time"
                    value={formData.send_time}
                    onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    Leave empty to send immediately when delay completes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Send Days (optional)</Label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                          formData.send_days.includes(String(day.value))
                            ? 'bg-violet-500 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Leave empty to send any day. Select specific days to restrict sending.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Wait Step Configuration */}
          {stepType === 'wait' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wait_name">Step Name (optional)</Label>
                <Input
                  id="wait_name"
                  placeholder="e.g., Wait 3 days"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <p className="text-sm text-slate-500">
                Configure the wait duration using the delay settings above.
              </p>
            </div>
          )}

          {/* Condition Step Configuration */}
          {stepType === 'condition' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="condition_name">Condition Name</Label>
                <Input
                  id="condition_name"
                  placeholder="e.g., Check if email opened"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Condition Type</Label>
                  <select
                    value={formData.condition_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition_type: e.target.value as ConditionType,
                      })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    {CONDITION_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.condition_type === 'field_value' ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="condition_field">Field</Label>
                      <Input
                        id="condition_field"
                        placeholder="e.g., status"
                        value={formData.condition_field}
                        onChange={(e) =>
                          setFormData({ ...formData, condition_field: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Comparison</Label>
                      <select
                        value={formData.condition_operator}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            condition_operator: e.target.value as ConditionOperator,
                          })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                      >
                        {CONDITION_OPERATORS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="condition_value">Value</Label>
                      <Input
                        id="condition_value"
                        placeholder="e.g., active"
                        disabled={
                          formData.condition_operator === 'is_set' ||
                          formData.condition_operator === 'is_not_set'
                        }
                        value={formData.condition_value}
                        onChange={(e) =>
                          setFormData({ ...formData, condition_value: e.target.value })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Evaluation Window</Label>
                    <select
                      value={formData.condition_window}
                      onChange={(e) =>
                        setFormData({ ...formData, condition_window: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    >
                      {WINDOW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      Measured from when the most recent email in this sequence was sent.
                    </p>
                  </div>
                )}

                {/* Where each answer sends the contact. */}
                <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                    <CornerDownRight className="h-4 w-4" />
                    Branching
                  </div>

                  {(
                    [
                      { key: 'then', label: 'If yes' },
                      { key: 'else', label: 'If no' },
                    ] as const
                  ).map(({ key, label }) => {
                    const actionKey = `${key}_action` as 'then_action' | 'else_action';
                    const stepKey = `${key}_step_id` as 'then_step_id' | 'else_step_id';
                    const action = formData[actionKey];

                    return (
                      <div key={key} className="grid gap-2 sm:grid-cols-[5rem_1fr_1fr] sm:items-center">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">
                          {label}
                        </Label>
                        <select
                          value={action}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [actionKey]: e.target.value as BranchAction,
                              ...(e.target.value === 'step' ? {} : { [stepKey]: '' }),
                            })
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        >
                          <option value="next">Continue to next step</option>
                          <option value="step">Jump to a step…</option>
                          <option value="exit">Exit the sequence</option>
                        </select>

                        {action === 'step' ? (
                          <select
                            value={formData[stepKey]}
                            onChange={(e) =>
                              setFormData({ ...formData, [stepKey]: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                          >
                            <option value="">Select a step…</option>
                            {branchTargets(steps, step?.id).map((target) => (
                              <option key={target.id} value={target.id}>
                                {stepLabel(target)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="hidden sm:block" />
                        )}
                      </div>
                    );
                  })}

                  {steps.length <= 1 && (
                    <p className="text-xs text-slate-500">
                      Add more steps first if you want this condition to jump to a specific one.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              step ? 'Update Step' : 'Add Step'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
