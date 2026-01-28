'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
  Switch,
} from '@crm-eco/ui';
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Shield,
  AlertTriangle,
  Calendar,
  MapPin,
  Users,
  Clock,
  FileQuestion,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface EligibilityRule {
  id: string;
  plan_id: string;
  rule_type: string;
  rule_name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_blocking: boolean;
  error_message: string | null;
  sort_order: number;
  is_active: boolean;
}

interface ProductEligibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

const RULE_TYPES = [
  { value: 'age', label: 'Age Requirement', icon: Calendar, description: 'Set minimum and maximum age limits' },
  { value: 'state', label: 'State Restriction', icon: MapPin, description: 'Include or exclude specific states' },
  { value: 'household', label: 'Household Size', icon: Users, description: 'Limit household/family size' },
  { value: 'waiting_period', label: 'Waiting Period', icon: Clock, description: 'Define waiting periods for coverage' },
  { value: 'pre_existing', label: 'Pre-existing Conditions', icon: AlertTriangle, description: 'Pre-existing condition limitations' },
  { value: 'custom', label: 'Custom Rule', icon: FileQuestion, description: 'Define a custom eligibility rule' },
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

export function ProductEligibilityModal({
  isOpen,
  onClose,
  productId,
  productName,
}: ProductEligibilityModalProps) {
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewRule, setShowNewRule] = useState(false);
  const [editingRule, setEditingRule] = useState<EligibilityRule | null>(null);
  const [selectedRuleType, setSelectedRuleType] = useState<string>('age');

  // Form state for new/edit rule
  const [ruleForm, setRuleForm] = useState({
    rule_name: '',
    description: '',
    is_blocking: true,
    error_message: '',
    // Age config
    min_age: '',
    max_age: '',
    // State config
    state_mode: 'include' as 'include' | 'exclude',
    states: [] as string[],
    // Household config
    max_household_size: '',
    // Waiting period config
    waiting_days: '',
    waiting_type: 'enrollment',
    // Pre-existing config
    lookback_months: '',
    exclusion_months: '',
    // Custom config
    custom_key: '',
    custom_value: '',
  });

  const supabase = createClient();

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_eligibility_rules')
        .select('*')
        .eq('plan_id', productId)
        .order('sort_order');

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast.error('Failed to load eligibility rules');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, productId]);

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen, loadRules]);

  const resetForm = () => {
    setRuleForm({
      rule_name: '',
      description: '',
      is_blocking: true,
      error_message: '',
      min_age: '',
      max_age: '',
      state_mode: 'include',
      states: [],
      max_household_size: '',
      waiting_days: '',
      waiting_type: 'enrollment',
      lookback_months: '',
      exclusion_months: '',
      custom_key: '',
      custom_value: '',
    });
    setSelectedRuleType('age');
  };

  const buildConfig = (): Record<string, unknown> => {
    switch (selectedRuleType) {
      case 'age':
        return {
          min_age: parseInt(ruleForm.min_age) || 0,
          max_age: parseInt(ruleForm.max_age) || 999,
        };
      case 'state':
        return {
          mode: ruleForm.state_mode,
          states: ruleForm.states,
        };
      case 'household':
        return {
          max_size: parseInt(ruleForm.max_household_size) || 10,
        };
      case 'waiting_period':
        return {
          days: parseInt(ruleForm.waiting_days) || 0,
          type: ruleForm.waiting_type,
        };
      case 'pre_existing':
        return {
          lookback_months: parseInt(ruleForm.lookback_months) || 12,
          exclusion_months: parseInt(ruleForm.exclusion_months) || 12,
        };
      case 'custom':
        return {
          key: ruleForm.custom_key,
          value: ruleForm.custom_value,
        };
      default:
        return {};
    }
  };

  const parseConfig = (rule: EligibilityRule) => {
    const config = rule.config as Record<string, unknown>;
    setSelectedRuleType(rule.rule_type);
    setRuleForm({
      rule_name: rule.rule_name,
      description: rule.description || '',
      is_blocking: rule.is_blocking,
      error_message: rule.error_message || '',
      min_age: String(config.min_age ?? ''),
      max_age: String(config.max_age ?? ''),
      state_mode: (config.mode as 'include' | 'exclude') || 'include',
      states: (config.states as string[]) || [],
      max_household_size: String(config.max_size ?? ''),
      waiting_days: String(config.days ?? ''),
      waiting_type: (config.type as string) || 'enrollment',
      lookback_months: String(config.lookback_months ?? ''),
      exclusion_months: String(config.exclusion_months ?? ''),
      custom_key: (config.key as string) || '',
      custom_value: (config.value as string) || '',
    });
  };

  const handleSaveRule = async () => {
    if (!ruleForm.rule_name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    setIsSaving(true);
    try {
      const ruleData = {
        plan_id: productId,
        rule_type: selectedRuleType,
        rule_name: ruleForm.rule_name,
        description: ruleForm.description || null,
        config: buildConfig(),
        is_blocking: ruleForm.is_blocking,
        error_message: ruleForm.error_message || null,
        is_active: true,
      };

      const sb = supabase as any;
      if (editingRule) {
        const { error } = await sb
          .from('product_eligibility_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success('Rule updated');
      } else {
        const { error } = await sb
          .from('product_eligibility_rules')
          .insert({
            ...ruleData,
            sort_order: rules.length,
          });

        if (error) throw error;
        toast.success('Rule created');
      }

      await loadRules();
      setShowNewRule(false);
      setEditingRule(null);
      resetForm();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this eligibility rule?')) return;

    try {
      const { error } = await supabase
        .from('product_eligibility_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      setRules(rules.filter(r => r.id !== ruleId));
      toast.success('Rule deleted');
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const handleToggleActive = async (rule: EligibilityRule) => {
    try {
      const { error } = await (supabase as any)
        .from('product_eligibility_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const toggleState = (state: string) => {
    setRuleForm(prev => ({
      ...prev,
      states: prev.states.includes(state)
        ? prev.states.filter(s => s !== state)
        : [...prev.states, state],
    }));
  };

  const getRuleIcon = (type: string) => {
    const ruleType = RULE_TYPES.find(r => r.value === type);
    return ruleType?.icon || Shield;
  };

  const getRuleDescription = (rule: EligibilityRule): string => {
    const config = rule.config as Record<string, unknown>;
    switch (rule.rule_type) {
      case 'age':
        return `Ages ${config.min_age ?? 0} - ${config.max_age ?? '∞'}`;
      case 'state':
        const states = config.states as string[] || [];
        return `${config.mode === 'include' ? 'Only' : 'Excludes'}: ${states.slice(0, 5).join(', ')}${states.length > 5 ? '...' : ''}`;
      case 'household':
        return `Max ${config.max_size} members`;
      case 'waiting_period':
        return `${config.days} day waiting period`;
      case 'pre_existing':
        return `${config.lookback_months}mo lookback, ${config.exclusion_months}mo exclusion`;
      case 'custom':
        return `${config.key}: ${config.value}`;
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Eligibility Rules
          </DialogTitle>
          <DialogDescription>
            Configure eligibility requirements for {productName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Info Banner */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">How Eligibility Rules Work</p>
                <p className="text-amber-700">
                  Rules are evaluated in order during enrollment. Blocking rules prevent enrollment if conditions aren&apos;t met.
                  Non-blocking rules show warnings but allow continuation.
                </p>
              </div>
            </div>

            {/* Add Rule Button */}
            <div className="flex justify-end">
              <Button onClick={() => { resetForm(); setShowNewRule(true); }} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>

            {/* Rules List */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Shield className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No eligibility rules configured</p>
                  <p className="text-sm">Add rules to control who can enroll in this product</p>
                </div>
              ) : (
                <div className="divide-y">
                  {rules.map((rule) => {
                    const Icon = getRuleIcon(rule.rule_type);
                    return (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-4 p-4 transition-colors ${
                          !rule.is_active ? 'opacity-50 bg-slate-50' : ''
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          rule.is_blocking ? 'bg-red-50' : 'bg-amber-50'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            rule.is_blocking ? 'text-red-600' : 'text-amber-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rule.rule_name}</span>
                            <Badge variant={rule.is_blocking ? 'destructive' : 'secondary'}>
                              {rule.is_blocking ? 'Blocking' : 'Warning'}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {rule.rule_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            {getRuleDescription(rule)}
                          </p>
                          {rule.error_message && (
                            <p className="text-xs text-red-600 mt-1">
                              Message: {rule.error_message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleActive(rule)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingRule(rule);
                              parseConfig(rule);
                              setShowNewRule(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>

        {/* Create/Edit Rule Dialog */}
        <Dialog open={showNewRule} onOpenChange={(open) => {
          if (!open) {
            setShowNewRule(false);
            setEditingRule(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Eligibility Rule' : 'Add Eligibility Rule'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Rule Type Selection */}
              {!editingRule && (
                <div className="space-y-2">
                  <Label>Rule Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {RULE_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.value}
                          onClick={() => setSelectedRuleType(type.value)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedRuleType === type.value
                              ? 'border-teal-500 bg-teal-50'
                              : 'hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="font-medium text-sm">{type.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rule Name */}
              <div className="space-y-2">
                <Label>Rule Name *</Label>
                <Input
                  value={ruleForm.rule_name}
                  onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })}
                  placeholder="e.g., Age Requirement"
                />
              </div>

              {/* Rule Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              {/* Age Rule Config */}
              {selectedRuleType === 'age' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Age</Label>
                    <Input
                      type="number"
                      value={ruleForm.min_age}
                      onChange={(e) => setRuleForm({ ...ruleForm, min_age: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Age</Label>
                    <Input
                      type="number"
                      value={ruleForm.max_age}
                      onChange={(e) => setRuleForm({ ...ruleForm, max_age: e.target.value })}
                      placeholder="64"
                    />
                  </div>
                </div>
              )}

              {/* State Rule Config */}
              {selectedRuleType === 'state' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={ruleForm.state_mode}
                      onChange={(e) => setRuleForm({ ...ruleForm, state_mode: e.target.value as 'include' | 'exclude' })}
                    >
                      <option value="include">Include only these states</option>
                      <option value="exclude">Exclude these states</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>States ({ruleForm.states.length} selected)</Label>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border rounded p-2">
                      {US_STATES.map((state) => (
                        <Badge
                          key={state}
                          variant={ruleForm.states.includes(state) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleState(state)}
                        >
                          {state}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Household Rule Config */}
              {selectedRuleType === 'household' && (
                <div className="space-y-2">
                  <Label>Maximum Household Size</Label>
                  <Input
                    type="number"
                    value={ruleForm.max_household_size}
                    onChange={(e) => setRuleForm({ ...ruleForm, max_household_size: e.target.value })}
                    placeholder="10"
                  />
                </div>
              )}

              {/* Waiting Period Config */}
              {selectedRuleType === 'waiting_period' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Waiting Period (days)</Label>
                    <Input
                      type="number"
                      value={ruleForm.waiting_days}
                      onChange={(e) => setRuleForm({ ...ruleForm, waiting_days: e.target.value })}
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Waiting Type</Label>
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={ruleForm.waiting_type}
                      onChange={(e) => setRuleForm({ ...ruleForm, waiting_type: e.target.value })}
                    >
                      <option value="enrollment">From Enrollment</option>
                      <option value="effective">From Effective Date</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Pre-existing Config */}
              {selectedRuleType === 'pre_existing' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lookback Period (months)</Label>
                    <Input
                      type="number"
                      value={ruleForm.lookback_months}
                      onChange={(e) => setRuleForm({ ...ruleForm, lookback_months: e.target.value })}
                      placeholder="12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exclusion Period (months)</Label>
                    <Input
                      type="number"
                      value={ruleForm.exclusion_months}
                      onChange={(e) => setRuleForm({ ...ruleForm, exclusion_months: e.target.value })}
                      placeholder="12"
                    />
                  </div>
                </div>
              )}

              {/* Custom Rule Config */}
              {selectedRuleType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Custom Key</Label>
                    <Input
                      value={ruleForm.custom_key}
                      onChange={(e) => setRuleForm({ ...ruleForm, custom_key: e.target.value })}
                      placeholder="e.g., tobacco_user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Value</Label>
                    <Input
                      value={ruleForm.custom_value}
                      onChange={(e) => setRuleForm({ ...ruleForm, custom_value: e.target.value })}
                      placeholder="e.g., false"
                    />
                  </div>
                </div>
              )}

              {/* Blocking Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Blocking Rule</p>
                  <p className="text-sm text-slate-500">
                    {ruleForm.is_blocking
                      ? 'Prevents enrollment if not met'
                      : 'Shows warning but allows enrollment'}
                  </p>
                </div>
                <Switch
                  checked={ruleForm.is_blocking}
                  onCheckedChange={(checked) => setRuleForm({ ...ruleForm, is_blocking: checked })}
                />
              </div>

              {/* Error Message */}
              <div className="space-y-2">
                <Label>Error Message</Label>
                <Input
                  value={ruleForm.error_message}
                  onChange={(e) => setRuleForm({ ...ruleForm, error_message: e.target.value })}
                  placeholder="Message shown when rule fails"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowNewRule(false);
                setEditingRule(null);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveRule} disabled={isSaving || !ruleForm.rule_name}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRule ? 'Update Rule' : 'Add Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
