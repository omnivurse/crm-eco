'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  GitBranch,
  Save,
  Play,
  ArrowLeft,
  Loader2,
  Zap,
  Filter,
  ListTodo,
} from 'lucide-react';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionBuilder } from './ActionBuilder';
import { TestRuleDialog } from './TestRuleDialog';
import type { CrmModule, CrmField } from '@/lib/crm/types';
import type { CrmWorkflow, TriggerType, ConditionGroup, WorkflowAction } from '@/lib/automation/types';

interface WorkflowBuilderProps {
  workflow?: CrmWorkflow;
  modules: CrmModule[];
  onSave: (workflow: Partial<CrmWorkflow>) => Promise<void>;
  onCancel: () => void;
}

export function WorkflowBuilder({
  workflow,
  modules,
  onSave,
  onCancel,
}: WorkflowBuilderProps) {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [moduleId, setModuleId] = useState(workflow?.module_id || '');
  const [triggerType, setTriggerType] = useState<TriggerType>(workflow?.trigger_type || 'on_create');
  const [isEnabled, setIsEnabled] = useState(workflow?.is_enabled ?? true);
  const [conditions, setConditions] = useState<ConditionGroup>(
    Array.isArray(workflow?.conditions) 
      ? { logic: 'AND', conditions: workflow.conditions }
      : (workflow?.conditions as ConditionGroup) || { logic: 'AND', conditions: [] }
  );
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions || []);
  const [priority, setPriority] = useState(workflow?.priority || 100);

  const [fields, setFields] = useState<CrmField[]>([]);
  const [saving, setSaving] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  const isEdit = !!workflow?.id;

  useEffect(() => {
    if (moduleId) {
      fetchFields(moduleId);
    }
  }, [moduleId]);

  async function fetchFields(modId: string) {
    try {
      const res = await fetch(`/api/crm/modules/${modId}/fields`);
      const data = await res.json();
      setFields(data || []);
    } catch (error) {
      console.error('Failed to fetch fields:', error);
    }
  }

  async function handleSave() {
    if (!name || !moduleId) return;

    setSaving(true);
    try {
      await onSave({
        id: workflow?.id,
        name,
        description,
        module_id: moduleId,
        trigger_type: triggerType,
        trigger_config: {},
        conditions,
        actions,
        is_enabled: isEnabled,
        priority,
      });
    } finally {
      setSaving(false);
    }
  }

  const triggerOptions: { value: TriggerType; label: string; description: string }[] = [
    { value: 'on_create', label: 'On Create', description: 'When a new record is created' },
    { value: 'on_update', label: 'On Update', description: 'When a record is updated' },
    { value: 'on_stage_change', label: 'On Stage Change', description: 'When a record moves to a new stage' },
    { value: 'scheduled', label: 'Scheduled', description: 'Run on a schedule' },
    { value: 'webform', label: 'Webform', description: 'When a webform is submitted' },
    { value: 'inbound_webhook', label: 'Inbound Webhook', description: 'When an external webhook is received' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-lg">
              <GitBranch className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {isEdit ? 'Edit Workflow' : 'Create Workflow'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automate actions when records change
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button variant="outline" onClick={() => setTestDialogOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Test Rule
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !name || !moduleId}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isEdit ? 'Save Changes' : 'Create Workflow'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Workflow Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., New Lead Assignment"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this workflow do?"
                  rows={2}
                />
              </div>
              <div>
                <Label>Module</Label>
                <Select value={moduleId} onValueChange={setModuleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled">Enabled</Label>
                <Switch
                  id="enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  min={1}
                  max={1000}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lower numbers run first
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Trigger */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Trigger
              </CardTitle>
              <CardDescription>When should this workflow run?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {triggerOptions.map((trigger) => (
                  <label
                    key={trigger.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      triggerType === trigger.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="trigger"
                      value={trigger.value}
                      checked={triggerType === trigger.value}
                      onChange={() => setTriggerType(trigger.value)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {trigger.label}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {trigger.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Conditions & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Conditions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-500" />
                Conditions
              </CardTitle>
              <CardDescription>When should the actions run?</CardDescription>
            </CardHeader>
            <CardContent>
              <ConditionBuilder
                fields={fields}
                conditions={conditions}
                onChange={setConditions}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-green-500" />
                Actions
              </CardTitle>
              <CardDescription>What should happen when conditions are met?</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionBuilder
                actions={actions}
                onChange={setActions}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Test Dialog */}
      {isEdit && workflow && (
        <TestRuleDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          workflowId={workflow.id}
          workflowName={workflow.name}
        />
      )}
    </div>
  );
}
