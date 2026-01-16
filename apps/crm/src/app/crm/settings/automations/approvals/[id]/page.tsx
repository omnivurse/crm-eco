'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Badge,
  Label,
} from '@crm-eco/ui';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  GripVertical,
} from 'lucide-react';
import type { ApprovalStep, ApprovalStepType } from '@/lib/approvals/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Module {
  id: string;
  name: string;
  key: string;
}

interface ProcessData {
  id?: string;
  name: string;
  description: string;
  module_id: string;
  is_enabled: boolean;
  trigger_type: string;
  trigger_config: {
    stage_from?: string;
    stage_to?: string;
    field?: string;
  };
  steps: ApprovalStep[];
  auto_approve_after_hours: number | null;
}

const defaultProcess: ProcessData = {
  name: '',
  description: '',
  module_id: '',
  is_enabled: true,
  trigger_type: 'stage_transition',
  trigger_config: {},
  steps: [{ type: 'role', value: 'crm_manager' }],
  auto_approve_after_hours: null,
};

export default function ApprovalProcessEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === 'new';

  const [process, setProcess] = useState<ProcessData>(defaultProcess);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
    if (!isNew) {
      fetchProcess();
    }
  }, [id, isNew]);

  async function fetchModules() {
    try {
      const res = await fetch('/api/crm/modules');
      const data = await res.json();
      setModules(data || []);
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }
  }

  async function fetchProcess() {
    try {
      const res = await fetch(`/api/approvals/processes?id=${id}`);
      const data = await res.json();
      if (data.process) {
        setProcess({
          id: data.process.id,
          name: data.process.name,
          description: data.process.description || '',
          module_id: data.process.module_id,
          is_enabled: data.process.is_enabled,
          trigger_type: data.process.trigger_type,
          trigger_config: data.process.trigger_config || {},
          steps: data.process.steps || [],
          auto_approve_after_hours: data.process.auto_approve_after_hours,
        });
      }
    } catch (err) {
      setError('Failed to load approval process');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!process.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!process.module_id) {
      setError('Module is required');
      return;
    }
    if (process.steps.length === 0) {
      setError('At least one approval step is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/approvals/processes', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? {
          module_id: process.module_id,
          name: process.name,
          description: process.description || undefined,
          is_enabled: process.is_enabled,
          trigger_type: process.trigger_type,
          trigger_config: process.trigger_config,
          steps: process.steps,
          auto_approve_after_hours: process.auto_approve_after_hours,
        } : {
          id: process.id,
          name: process.name,
          description: process.description || undefined,
          is_enabled: process.is_enabled,
          trigger_type: process.trigger_type,
          trigger_config: process.trigger_config,
          steps: process.steps,
          auto_approve_after_hours: process.auto_approve_after_hours,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save');
        return;
      }

      router.push('/crm/settings/automations/approvals');
    } catch (err) {
      setError('Failed to save approval process');
    } finally {
      setSaving(false);
    }
  }

  function addStep() {
    setProcess({
      ...process,
      steps: [...process.steps, { type: 'role', value: 'crm_manager' }],
    });
  }

  function removeStep(index: number) {
    setProcess({
      ...process,
      steps: process.steps.filter((_, i) => i !== index),
    });
  }

  function updateStep(index: number, updates: Partial<ApprovalStep>) {
    setProcess({
      ...process,
      steps: process.steps.map((step, i) =>
        i === index ? { ...step, ...updates } : step
      ),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings/automations/approvals">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isNew ? 'Create Approval Process' : 'Edit Approval Process'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure the approval workflow steps and triggers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Label htmlFor="enabled" className="text-sm">Enabled</Label>
            <Switch
              id="enabled"
              checked={process.is_enabled}
              onCheckedChange={(checked) => setProcess({ ...process, is_enabled: checked })}
            />
          </div>
          <Button variant="outline" onClick={() => router.push('/crm/settings/automations/approvals')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={process.name}
                  onChange={(e) => setProcess({ ...process, name: e.target.value })}
                  placeholder="e.g., High Value Deal Approval"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={process.description}
                  onChange={(e) => setProcess({ ...process, description: e.target.value })}
                  placeholder="Describe when this approval process should be used..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="module">Module *</Label>
                <Select
                  value={process.module_id}
                  onValueChange={(value) => setProcess({ ...process, module_id: value })}
                  disabled={!isNew}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((mod) => (
                      <SelectItem key={mod.id} value={mod.id}>
                        {mod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger Type</Label>
                <Select
                  value={process.trigger_type}
                  onValueChange={(value) => setProcess({ ...process, trigger_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stage_transition">Stage Transition</SelectItem>
                    <SelectItem value="field_change">Field Change</SelectItem>
                    <SelectItem value="record_create">Record Create</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {process.trigger_type === 'stage_transition' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Stage</Label>
                    <Input
                      value={process.trigger_config.stage_from || ''}
                      onChange={(e) => setProcess({
                        ...process,
                        trigger_config: { ...process.trigger_config, stage_from: e.target.value }
                      })}
                      placeholder="* (any)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To Stage</Label>
                    <Input
                      value={process.trigger_config.stage_to || ''}
                      onChange={(e) => setProcess({
                        ...process,
                        trigger_config: { ...process.trigger_config, stage_to: e.target.value }
                      })}
                      placeholder="* (any)"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Steps */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Approval Steps</CardTitle>
                <CardDescription>
                  Define who needs to approve and in what order
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </CardHeader>
            <CardContent>
              {process.steps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No approval steps defined</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={addStep}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {process.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 border rounded-lg bg-muted/20"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <Badge variant="secondary" className="w-8 justify-center">
                        {index + 1}
                      </Badge>

                      <Select
                        value={step.type}
                        onValueChange={(value) => updateStep(index, { type: value as ApprovalStepType })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="role">Role</SelectItem>
                          <SelectItem value="user">Specific User</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="record_owner">Record Owner</SelectItem>
                        </SelectContent>
                      </Select>

                      {(step.type === 'role' || step.type === 'user') && (
                        <Input
                          value={step.value}
                          onChange={(e) => updateStep(index, { value: e.target.value })}
                          placeholder={step.type === 'role' ? 'e.g., crm_manager' : 'User ID'}
                          className="flex-1"
                        />
                      )}

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={step.require_comment || false}
                          onCheckedChange={(checked) => updateStep(index, { require_comment: checked })}
                        />
                        <span className="text-sm text-muted-foreground">Comment required</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => removeStep(index)}
                        disabled={process.steps.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timeout">Auto-approve after (hours)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={process.auto_approve_after_hours || ''}
                  onChange={(e) => setProcess({
                    ...process,
                    auto_approve_after_hours: e.target.value ? parseInt(e.target.value) : null
                  })}
                  placeholder="Leave empty to disable"
                  min={0}
                />
                <p className="text-xs text-muted-foreground">
                  Automatically approve if no action is taken within this time
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Role-based:</strong> Any user with the specified CRM role can approve
              </p>
              <p>
                <strong>Specific User:</strong> Only the specified user can approve
              </p>
              <p>
                <strong>Manager:</strong> The approver&apos;s manager must approve
              </p>
              <p>
                <strong>Record Owner:</strong> The owner of the record must approve
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
