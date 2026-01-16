'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  Zap,
  Save,
  ArrowLeft,
  Loader2,
  ListTodo,
} from 'lucide-react';
import { ActionBuilder } from './ActionBuilder';
import type { CrmModule } from '@/lib/crm/types';
import type { CrmMacro, WorkflowAction } from '@/lib/automation/types';

interface MacroBuilderProps {
  macro?: CrmMacro;
  modules: CrmModule[];
  onSave: (macro: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

const ROLE_OPTIONS = [
  { value: 'crm_admin', label: 'Admin' },
  { value: 'crm_manager', label: 'Manager' },
  { value: 'crm_agent', label: 'Agent' },
  { value: 'crm_viewer', label: 'Viewer' },
];

const COLOR_OPTIONS = [
  { value: 'teal', label: 'Teal' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'pink', label: 'Pink' },
  { value: 'orange', label: 'Orange' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
];

export function MacroBuilder({
  macro,
  modules,
  onSave,
  onCancel,
}: MacroBuilderProps) {
  const [name, setName] = useState(macro?.name || '');
  const [description, setDescription] = useState(macro?.description || '');
  const [moduleId, setModuleId] = useState(macro?.module_id || '');
  const [isEnabled, setIsEnabled] = useState(macro?.is_enabled ?? true);
  const [color, setColor] = useState(macro?.color || 'teal');
  const [actions, setActions] = useState<WorkflowAction[]>(macro?.actions || []);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(
    macro?.allowed_roles || ['crm_admin', 'crm_manager', 'crm_agent']
  );

  const [saving, setSaving] = useState(false);

  const isEdit = !!macro?.id;

  async function handleSave() {
    if (!name || !moduleId) return;

    setSaving(true);
    try {
      await onSave({
        module_id: moduleId,
        name,
        description: description || null,
        icon: 'zap',
        color,
        actions,
        is_enabled: isEnabled,
        allowed_roles: allowedRoles,
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleRole(role: string) {
    if (allowedRoles.includes(role)) {
      setAllowedRoles(allowedRoles.filter(r => r !== role));
    } else {
      setAllowedRoles([...allowedRoles, role]);
    }
  }

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
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}20` }}
            >
              <Zap className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {isEdit ? 'Edit Macro' : 'Create Macro'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                One-click action bundles for quick operations
              </p>
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !name || !moduleId}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isEdit ? 'Save Changes' : 'Create Macro'}
        </Button>
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
                <Label htmlFor="name">Macro Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Qualify Lead"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this macro do?"
                  rows={2}
                />
              </div>
              <div>
                <Label>Module</Label>
                <Select value={moduleId} onValueChange={setModuleId} disabled={isEdit}>
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
                {isEdit && (
                  <p className="text-xs text-slate-500 mt-1">
                    Module cannot be changed after creation
                  </p>
                )}
              </div>
              <div>
                <Label>Color</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: opt.value }}
                          />
                          {opt.label}
                        </div>
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
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permissions</CardTitle>
              <CardDescription>Who can run this macro?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Checkbox
                    checked={allowedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {role.label}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-green-500" />
                Actions
              </CardTitle>
              <CardDescription>What should happen when this macro runs?</CardDescription>
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
    </div>
  );
}
