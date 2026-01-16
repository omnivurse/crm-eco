'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { ValidationRule, ValidationRuleType } from '@/lib/validation-rules/types';

interface Module {
  id: string;
  key: string;
  name: string;
}

interface Field {
  id: string;
  key: string;
  label: string;
  type: string;
}

const RULE_TYPES: { value: ValidationRuleType; label: string; description: string }[] = [
  { value: 'required_if', label: 'Required If', description: 'Field required when conditions are met' },
  { value: 'format', label: 'Format', description: 'Validate format (email, phone, URL, regex)' },
  { value: 'range', label: 'Range', description: 'Min/max value for numbers or dates' },
  { value: 'comparison', label: 'Comparison', description: 'Compare to another field value' },
  { value: 'unique', label: 'Unique', description: 'Value must be unique within module' },
];

const FORMAT_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'alphanumeric', label: 'Alphanumeric' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'regex', label: 'Custom Regex' },
];

const COMPARISON_OPERATORS = [
  { value: 'eq', label: 'Equal to' },
  { value: 'ne', label: 'Not equal to' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
];

const TRIGGERS = [
  { value: 'create', label: 'On Create' },
  { value: 'update', label: 'On Update' },
  { value: 'stage_change', label: 'On Stage Change' },
];

type RuleFormState = {
  module_id: string;
  name: string;
  description: string;
  rule_type: ValidationRuleType;
  target_field: string;
  error_message: string;
  applies_on: string[];
  is_enabled: boolean;
  priority: number;
  // Config fields
  format_type?: string;
  pattern?: string;
  min?: string;
  max?: string;
  compare_field?: string;
  comparison_operator?: string;
};

const defaultFormState: RuleFormState = {
  module_id: '',
  name: '',
  description: '',
  rule_type: 'required_if',
  target_field: '',
  error_message: 'This field is required',
  applies_on: ['create', 'update'],
  is_enabled: true,
  priority: 100,
};

export default function ValidationRulesSettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [fields, setFields] = useState<Record<string, Field[]>>({});
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ValidationRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(defaultFormState);
  const [saving, setSaving] = useState(false);

  // Load data
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrgId(profile.organization_id);

      const [rulesRes, modulesRes] = await Promise.all([
        supabase.from('crm_validation_rules').select('*').eq('org_id', profile.organization_id).order('priority'),
        supabase.from('crm_modules').select('id, key, name').eq('org_id', profile.organization_id).eq('is_enabled', true),
      ]);

      setRules((rulesRes.data || []) as ValidationRule[]);
      setModules((modulesRes.data || []) as Module[]);
      
      // Load fields for each module
      const fieldsByModule: Record<string, Field[]> = {};
      for (const mod of modulesRes.data || []) {
        const { data: moduleFields } = await supabase
          .from('crm_fields')
          .select('id, key, label, type')
          .eq('module_id', mod.id);
        fieldsByModule[mod.id] = (moduleFields || []) as Field[];
      }
      setFields(fieldsByModule);
      
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  // Build config from form state
  const buildConfig = (): Record<string, unknown> => {
    switch (form.rule_type) {
      case 'format':
        return {
          format_type: form.format_type || 'email',
          pattern: form.format_type === 'regex' ? form.pattern : undefined,
        };
      case 'range':
        return {
          min: form.min ? Number(form.min) : undefined,
          max: form.max ? Number(form.max) : undefined,
          field_type: 'number',
        };
      case 'comparison':
        return {
          compare_field: form.compare_field,
          operator: form.comparison_operator || 'eq',
          field_type: 'number',
        };
      case 'unique':
        return { case_sensitive: false };
      default:
        return {};
    }
  };

  // Parse config to form state
  const parseConfig = (rule: ValidationRule): Partial<RuleFormState> => {
    const config = rule.config as Record<string, unknown>;
    switch (rule.rule_type) {
      case 'format':
        return {
          format_type: config.format_type as string,
          pattern: config.pattern as string,
        };
      case 'range':
        return {
          min: config.min !== undefined ? String(config.min) : '',
          max: config.max !== undefined ? String(config.max) : '',
        };
      case 'comparison':
        return {
          compare_field: config.compare_field as string,
          comparison_operator: config.operator as string,
        };
      default:
        return {};
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        org_id: orgId,
        module_id: form.module_id,
        name: form.name,
        description: form.description || null,
        rule_type: form.rule_type,
        target_field: form.target_field,
        conditions: { logic: 'AND', conditions: [] },
        config: buildConfig(),
        error_message: form.error_message,
        applies_on: form.applies_on,
        is_enabled: form.is_enabled,
        priority: form.priority,
      };

      if (editing) {
        await supabase.from('crm_validation_rules').update(data).eq('id', editing.id);
      } else {
        await supabase.from('crm_validation_rules').insert(data);
      }

      const { data: updated } = await supabase
        .from('crm_validation_rules')
        .select('*')
        .eq('org_id', orgId)
        .order('priority');
      
      setRules((updated || []) as ValidationRule[]);
      setDialogOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this validation rule?')) return;
    await supabase.from('crm_validation_rules').delete().eq('id', id);
    setRules(rules.filter(r => r.id !== id));
  };

  const handleToggleEnabled = async (rule: ValidationRule) => {
    await supabase
      .from('crm_validation_rules')
      .update({ is_enabled: !rule.is_enabled })
      .eq('id', rule.id);
    
    setRules(rules.map(r => 
      r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r
    ));
  };

  const openEdit = (rule: ValidationRule) => {
    setEditing(rule);
    setForm({
      module_id: rule.module_id,
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type,
      target_field: rule.target_field,
      error_message: rule.error_message,
      applies_on: rule.applies_on,
      is_enabled: rule.is_enabled,
      priority: rule.priority,
      ...parseConfig(rule),
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      ...defaultFormState,
      module_id: modules[0]?.id || '',
    });
    setDialogOpen(true);
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || moduleId;
  const getFieldLabel = (moduleId: string, fieldKey: string) => {
    const field = fields[moduleId]?.find(f => f.key === fieldKey);
    return field?.label || fieldKey;
  };
  const getModuleFields = () => fields[form.module_id] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Validation Rules</h1>
        <p className="text-muted-foreground">
          Configure field-level validation rules that run server-side and cannot be bypassed.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-500" />
              Validation Rules
            </CardTitle>
            <CardDescription>
              Define rules to validate field values on create, update, or stage change.
            </CardDescription>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Triggers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No validation rules defined
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>{getModuleName(rule.module_id)}</TableCell>
                    <TableCell>{getFieldLabel(rule.module_id, rule.target_field)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {RULE_TYPES.find(t => t.value === rule.rule_type)?.label || rule.rule_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {rule.applies_on.map(trigger => (
                          <Badge key={trigger} variant="secondary" className="text-xs">
                            {trigger}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleEnabled(rule)}
                        className="flex items-center gap-1"
                      >
                        {rule.is_enabled ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400" />
                        )}
                        <span className={rule.is_enabled ? 'text-green-500' : 'text-slate-400'}>
                          {rule.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rule Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Validation Rule</DialogTitle>
            <DialogDescription>
              Configure when and how this validation should run.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Module</Label>
                <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v, target_field: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((mod) => (
                      <SelectItem key={mod.id} value={mod.id}>{mod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Field</Label>
                <Select value={form.target_field} onValueChange={(v) => setForm({ ...form, target_field: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {getModuleFields().map((field) => (
                      <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Amount must be positive"
              />
            </div>

            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select value={form.rule_type} onValueChange={(v) => setForm({ ...form, rule_type: v as ValidationRuleType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rule-specific config */}
            {form.rule_type === 'format' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Format Type</Label>
                  <Select value={form.format_type || 'email'} onValueChange={(v) => setForm({ ...form, format_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_TYPES.map((fmt) => (
                        <SelectItem key={fmt.value} value={fmt.value}>{fmt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.format_type === 'regex' && (
                  <div className="space-y-2">
                    <Label>Regex Pattern</Label>
                    <Input
                      value={form.pattern || ''}
                      onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                      placeholder="e.g., ^[A-Z]{2}[0-9]+$"
                    />
                  </div>
                )}
              </div>
            )}

            {form.rule_type === 'range' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum</Label>
                  <Input
                    type="number"
                    value={form.min || ''}
                    onChange={(e) => setForm({ ...form, min: e.target.value })}
                    placeholder="e.g., 0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum</Label>
                  <Input
                    type="number"
                    value={form.max || ''}
                    onChange={(e) => setForm({ ...form, max: e.target.value })}
                    placeholder="e.g., 1000000"
                  />
                </div>
              </div>
            )}

            {form.rule_type === 'comparison' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Compare To Field</Label>
                  <Select value={form.compare_field || ''} onValueChange={(v) => setForm({ ...form, compare_field: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {getModuleFields().filter(f => f.key !== form.target_field).map((field) => (
                        <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select value={form.comparison_operator || 'eq'} onValueChange={(v) => setForm({ ...form, comparison_operator: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPARISON_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Error Message</Label>
              <Input
                value={form.error_message}
                onChange={(e) => setForm({ ...form, error_message: e.target.value })}
                placeholder="Message shown when validation fails"
              />
            </div>

            {/* Triggers */}
            <div className="space-y-2">
              <Label>Run On</Label>
              <div className="flex gap-4">
                {TRIGGERS.map((trigger) => (
                  <label key={trigger.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.applies_on.includes(trigger.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, applies_on: [...form.applies_on, trigger.value] });
                        } else {
                          setForm({ ...form, applies_on: form.applies_on.filter(t => t !== trigger.value) });
                        }
                      }}
                    />
                    <span className="text-sm">{trigger.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_enabled}
                  onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
                />
                <Label>Enabled</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 100 })}
                  className="w-20"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.module_id || !form.target_field}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
