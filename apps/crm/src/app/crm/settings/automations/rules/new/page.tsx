'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Zap,
  Plus,
  Trash2,
  Save,
  Mail,
  MessageSquare,
  CheckCircle2,
  UserPlus,
  Bell,
  Webhook,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TriggerConfig {
  event_type?: string;
  entity_type?: string;
  cron?: string;
  path?: string;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Action {
  type: string;
  config: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

const EVENT_TYPES = [
  { value: 'lead.created', label: 'Lead Created', entity: 'leads' },
  { value: 'lead.updated', label: 'Lead Updated', entity: 'leads' },
  { value: 'lead.converted', label: 'Lead Converted', entity: 'leads' },
  { value: 'deal.created', label: 'Deal Created', entity: 'deals' },
  { value: 'deal.updated', label: 'Deal Updated', entity: 'deals' },
  { value: 'deal.stage_changed', label: 'Deal Stage Changed', entity: 'deals' },
  { value: 'deal.won', label: 'Deal Won', entity: 'deals' },
  { value: 'deal.lost', label: 'Deal Lost', entity: 'deals' },
  { value: 'contact.created', label: 'Contact Created', entity: 'contacts' },
  { value: 'contact.updated', label: 'Contact Updated', entity: 'contacts' },
  { value: 'task.created', label: 'Task Created', entity: 'task' },
  { value: 'task.completed', label: 'Task Completed', entity: 'task' },
  { value: 'task.overdue', label: 'Task Overdue', entity: 'task' },
  { value: 'message.received', label: 'Message Received', entity: 'message' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare },
  { value: 'create_task', label: 'Create Task', icon: CheckCircle2 },
  { value: 'update_record', label: 'Update Record', icon: Zap },
  { value: 'create_lead', label: 'Create Lead', icon: UserPlus },
  { value: 'send_notification', label: 'Send Notification', icon: Bell },
  { value: 'webhook_call', label: 'Call Webhook', icon: Webhook },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function NewAutomationRulePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'event' | 'schedule' | 'webhook'>('event');
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({});
  const [conditionMatch, setConditionMatch] = useState<'all' | 'any'>('all');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const addAction = (type: string) => {
    setActions([...actions, { type, config: {} }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, config: Record<string, unknown>) => {
    setActions(actions.map((a, i) => i === index ? { ...a, config: { ...a.config, ...config } } : a));
  };

  const handleSave = async () => {
    if (!name || actions.length === 0) {
      alert('Please provide a name and at least one action');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          conditions: { match: conditionMatch, rules: conditions },
          actions,
          is_active: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create rule');
      }
      
      router.push('/crm/settings/automations/rules');
    } catch (error) {
      console.error('Error creating rule:', error);
      alert('Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const selectedEvent = EVENT_TYPES.find(e => e.value === triggerConfig.event_type);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm/settings/automations/rules"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Create Automation Rule</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define triggers, conditions, and actions
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Rule Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Send welcome email when lead created"
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
            />
          </div>
        </div>

        {/* Trigger */}
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Trigger</h2>
          
          <div className="flex gap-2">
            {(['event', 'schedule', 'webhook'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTriggerType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  triggerType === type
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {type === 'event' ? 'When Event Occurs' : type === 'schedule' ? 'On Schedule' : 'Webhook'}
              </button>
            ))}
          </div>
          
          {triggerType === 'event' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Event Type
              </label>
              <select
                value={triggerConfig.event_type || ''}
                onChange={(e) => {
                  const event = EVENT_TYPES.find(ev => ev.value === e.target.value);
                  setTriggerConfig({ 
                    event_type: e.target.value, 
                    entity_type: event?.entity 
                  });
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Select event...</option>
                {EVENT_TYPES.map((event) => (
                  <option key={event.value} value={event.value}>{event.label}</option>
                ))}
              </select>
            </div>
          )}
          
          {triggerType === 'schedule' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cron Expression
              </label>
              <input
                type="text"
                value={triggerConfig.cron || ''}
                onChange={(e) => setTriggerConfig({ cron: e.target.value })}
                placeholder="0 9 * * 1-5 (9am weekdays)"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-500 mt-1">
                Examples: 0 9 * * * (daily at 9am), 0 0 * * 1 (weekly Monday)
              </p>
            </div>
          )}
          
          {triggerType === 'webhook' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Webhook Path
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">/api/webhooks/custom/</span>
                <input
                  type="text"
                  value={triggerConfig.path || ''}
                  onChange={(e) => setTriggerConfig({ path: e.target.value })}
                  placeholder="my-hook"
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Conditions */}
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Conditions (Optional)</h2>
            <button
              onClick={addCondition}
              className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
            >
              <Plus className="w-4 h-4" /> Add Condition
            </button>
          </div>
          
          {conditions.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Match</span>
                <select
                  value={conditionMatch}
                  onChange={(e) => setConditionMatch(e.target.value as 'all' | 'any')}
                  className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="all">All conditions</option>
                  <option value="any">Any condition</option>
                </select>
              </div>
              
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                      placeholder="Field (e.g., data.email)"
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value })}
                      className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => removeCondition(index)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {conditions.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No conditions - rule will run for all matching events
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Actions *</h2>
          
          {/* Action Type Selector */}
          <div className="flex flex-wrap gap-2">
            {ACTION_TYPES.map((actionType) => (
              <button
                key={actionType.value}
                onClick={() => addAction(actionType.value)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"
              >
                <actionType.icon className="w-4 h-4" />
                {actionType.label}
              </button>
            ))}
          </div>
          
          {/* Added Actions */}
          {actions.length > 0 && (
            <div className="space-y-3">
              {actions.map((action, index) => {
                const actionDef = ACTION_TYPES.find(a => a.value === action.type);
                return (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                        {actionDef && <actionDef.icon className="w-4 h-4" />}
                        {actionDef?.label || action.type}
                      </div>
                      <button
                        onClick={() => removeAction(index)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Action-specific config */}
                    {action.type === 'send_email' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="To: {{record.email}}"
                          value={(action.config.to as string) || ''}
                          onChange={(e) => updateAction(index, { to: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Subject"
                          value={(action.config.subject as string) || ''}
                          onChange={(e) => updateAction(index, { subject: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                        <textarea
                          placeholder="Email body (supports {{variables}})"
                          value={(action.config.body as string) || ''}
                          onChange={(e) => updateAction(index, { body: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
                        />
                      </div>
                    )}
                    
                    {action.type === 'send_sms' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="To: {{record.phone}}"
                          value={(action.config.to as string) || ''}
                          onChange={(e) => updateAction(index, { to: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                        <textarea
                          placeholder="Message (supports {{variables}})"
                          value={(action.config.body as string) || ''}
                          onChange={(e) => updateAction(index, { body: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
                        />
                      </div>
                    )}
                    
                    {action.type === 'create_task' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Task title"
                          value={(action.config.title as string) || ''}
                          onChange={(e) => updateAction(index, { title: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Due in days (e.g., 3)"
                          value={(action.config.due_days as string) || ''}
                          onChange={(e) => updateAction(index, { due_days: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                    
                    {action.type === 'webhook_call' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Webhook URL"
                          value={(action.config.url as string) || ''}
                          onChange={(e) => updateAction(index, { url: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {actions.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add at least one action to execute when the rule triggers
            </p>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Link
            href="/crm/settings/automations/rules"
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !name || actions.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
