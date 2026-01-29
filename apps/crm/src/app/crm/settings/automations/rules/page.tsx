'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import Link from 'next/link';
import {
  Zap,
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'event' | 'schedule' | 'webhook';
  trigger_config: {
    event_type?: string;
    entity_type?: string;
    cron?: string;
    path?: string;
  };
  conditions: {
    match: 'all' | 'any';
    rules: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
  };
  actions: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  last_run_status: string | null;
  error_count: number;
  created_at: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTrigger(rule: AutomationRule): string {
  if (rule.trigger_type === 'event') {
    return rule.trigger_config.event_type?.replace('.', ' ').replace(/_/g, ' ') || 'Event';
  }
  if (rule.trigger_type === 'schedule') {
    return `Scheduled (${rule.trigger_config.cron})`;
  }
  if (rule.trigger_type === 'webhook') {
    return `Webhook: ${rule.trigger_config.path}`;
  }
  return rule.trigger_type;
}

function formatActions(rule: AutomationRule): string {
  return rule.actions.map(a => a.type.replace(/_/g, ' ')).join(', ');
}

function getActionIcon(actionType: string) {
  if (actionType.includes('email')) return <Mail className="w-4 h-4" />;
  if (actionType.includes('sms')) return <MessageSquare className="w-4 h-4" />;
  if (actionType.includes('task')) return <CheckCircle2 className="w-4 h-4" />;
  return <Zap className="w-4 h-4" />;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AutomationRulesPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Live search with debounce
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 200 });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/automation/rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      await fetch(`/api/automation/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      fetchRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await fetch(`/api/automation/rules/${ruleId}`, {
        method: 'DELETE',
      });
      fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const filteredRules = useMemo(() => {
    const searchLower = debouncedQuery.toLowerCase();
    if (!searchLower) return rules;
    return rules.filter(rule =>
      rule.name.toLowerCase().includes(searchLower) ||
      (rule.description || '').toLowerCase().includes(searchLower)
    );
  }, [rules, debouncedQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automation Rules</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Create event-driven automations for your CRM
          </p>
        </div>
        <Link
          href="/crm/settings/automations/rules/new"
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search rules..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
        />
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse" />
          ))
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-12 glass-card border border-slate-200 dark:border-slate-700 rounded-xl">
            <Zap className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No automation rules yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create your first rule to automate repetitive tasks
            </p>
            <Link
              href="/crm/settings/automations/rules/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              Create Rule
            </Link>
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-teal-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg ${rule.is_active ? 'bg-teal-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Zap className={`w-5 h-5 ${rule.is_active ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{rule.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        rule.is_active 
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTrigger(rule)}
                      </span>
                      <span>→</span>
                      <span className="flex items-center gap-1">
                        {rule.actions.map((action, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {getActionIcon(action.type)}
                          </span>
                        ))}
                        {formatActions(rule)}
                      </span>
                    </div>
                    {rule.run_count > 0 && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Runs: {rule.run_count}</span>
                        {rule.last_run_at && (
                          <span>Last: {new Date(rule.last_run_at).toLocaleString()}</span>
                        )}
                        {rule.error_count > 0 && (
                          <span className="text-red-500">Errors: {rule.error_count}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title={rule.is_active ? 'Pause' : 'Activate'}
                  >
                    {rule.is_active ? (
                      <Pause className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Play className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  <Link
                    href={`/crm/settings/automations/rules/${rule.id}`}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4 text-slate-500" />
                  </Link>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
