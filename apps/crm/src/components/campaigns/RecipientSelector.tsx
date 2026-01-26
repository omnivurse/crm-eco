'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Users,
  Filter,
  Search,
  CheckCircle2,
  X,
  AlertCircle,
  Database,
  ListFilter,
  Upload,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CrmModule {
  id: string;
  key: string;
  name: string;
  name_plural: string | null;
}

interface CrmView {
  id: string;
  name: string;
  module_id: string;
}

interface Recipient {
  record_id: string;
  module_key: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface RecipientSelectorProps {
  selectedRecipients: Recipient[];
  onRecipientsChange: (recipients: Recipient[]) => void;
  organizationId: string;
  className?: string;
}

type SelectionMode = 'view' | 'manual' | 'csv';

// ============================================================================
// Main Component
// ============================================================================

export function RecipientSelector({
  selectedRecipients,
  onRecipientsChange,
  organizationId,
  className,
}: RecipientSelectorProps) {
  const [mode, setMode] = useState<SelectionMode>('view');
  const [modules, setModules] = useState<CrmModule[]>([]);
  const [views, setViews] = useState<CrmView[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewRecipients, setPreviewRecipients] = useState<Recipient[]>([]);
  const [excludeUnsubscribed, setExcludeUnsubscribed] = useState(true);
  const [excludeRecentlyContacted, setExcludeRecentlyContacted] = useState(false);
  const [recentDays, setRecentDays] = useState(7);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load modules on mount
  useEffect(() => {
    async function loadModules() {
      const { data } = await supabase
        .from('crm_modules')
        .select('id, key, name, name_plural')
        .eq('org_id', organizationId)
        .eq('is_enabled', true)
        .in('key', ['contacts', 'leads', 'accounts'])
        .order('display_order');

      if (data) {
        setModules(data);
        if (data.length > 0) {
          setSelectedModuleId(data[0].id);
        }
      }
    }
    loadModules();
  }, [organizationId, supabase]);

  // Load views when module changes
  useEffect(() => {
    async function loadViews() {
      if (!selectedModuleId) return;

      const { data } = await supabase
        .from('crm_views')
        .select('id, name, module_id')
        .eq('module_id', selectedModuleId)
        .order('name');

      if (data) {
        setViews(data);
      }
    }
    loadViews();
  }, [selectedModuleId, supabase]);

  // Preview recipients from view
  const previewFromView = useCallback(async () => {
    if (!selectedViewId) return;

    setLoading(true);
    try {
      // Get view filters
      const { data: view } = await supabase
        .from('crm_views')
        .select('filters')
        .eq('id', selectedViewId)
        .single();

      // Get records matching the view
      let query = supabase
        .from('crm_records')
        .select('id, title, email, data')
        .eq('module_id', selectedModuleId)
        .not('email', 'is', null);

      // Apply view filters (simplified - in production you'd apply all filter operators)
      // For now, just get all records with email

      const { data: records } = await query.limit(100);

      if (records) {
        // Get the module key for the selected module
        const selectedModule = modules.find(m => m.id === selectedModuleId);
        const moduleKey = selectedModule?.key || 'contacts';

        const recipients: Recipient[] = records
          .filter(r => r.email)
          .map(r => ({
            record_id: r.id,
            module_key: moduleKey,
            email: r.email!,
            first_name: (r.data as Record<string, unknown>)?.first_name as string || null,
            last_name: (r.data as Record<string, unknown>)?.last_name as string || null,
          }));

        setPreviewRecipients(recipients);
      }
    } catch (error) {
      console.error('Error previewing recipients:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedViewId, selectedModuleId, supabase, modules]);

  const addAllPreview = () => {
    const newRecipients = previewRecipients.filter(
      pr => !selectedRecipients.some(sr => sr.record_id === pr.record_id)
    );
    onRecipientsChange([...selectedRecipients, ...newRecipients]);
  };

  const removeRecipient = (recordId: string) => {
    onRecipientsChange(selectedRecipients.filter(r => r.record_id !== recordId));
  };

  const clearAll = () => {
    onRecipientsChange([]);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Selection Mode Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('view')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'view'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <ListFilter className="w-4 h-4" />
          From View
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'manual'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <Users className="w-4 h-4" />
          Manual Select
        </button>
        <button
          type="button"
          onClick={() => setMode('csv')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'csv'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
      </div>

      {/* View Selection */}
      {mode === 'view' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name_plural || module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>View</Label>
              <Select value={selectedViewId} onValueChange={setSelectedViewId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  {views.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={previewFromView}
            disabled={loading}
            className="w-full"
          >
            <Filter className="w-4 h-4 mr-2" />
            {loading ? 'Loading...' : 'Preview Recipients'}
          </Button>

          {/* Preview Results */}
          {previewRecipients.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Found {previewRecipients.length} recipients with email
                </span>
                <Button type="button" size="sm" onClick={addAllPreview}>
                  Add All
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {previewRecipients.slice(0, 10).map((r) => (
                  <div
                    key={r.record_id}
                    className="flex items-center justify-between py-1 px-2 rounded bg-slate-50 dark:bg-slate-800/50 text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      {r.first_name || r.last_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : r.email}
                    </span>
                    <span className="text-slate-500">{r.email}</span>
                  </div>
                ))}
                {previewRecipients.length > 10 && (
                  <div className="text-center text-xs text-slate-500 py-1">
                    +{previewRecipients.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Selection */}
      {mode === 'manual' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search contacts by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Search for contacts to add to your campaign</p>
          </div>
        </div>
      )}

      {/* CSV Import */}
      {mode === 'csv' && (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8
              text-center hover:border-teal-500 transition-colors cursor-pointer"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Drag and drop a CSV file, or click to browse
            </p>
            <p className="text-xs text-slate-400">
              CSV must contain: email (required), first_name, last_name (optional)
            </p>
          </div>
        </div>
      )}

      {/* Exclusion Options */}
      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Label className="text-sm font-medium">Exclusion Options</Label>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="exclude-unsub"
            checked={excludeUnsubscribed}
            onCheckedChange={(checked) => setExcludeUnsubscribed(checked === true)}
          />
          <label htmlFor="exclude-unsub" className="text-sm text-slate-600 dark:text-slate-400">
            Exclude unsubscribed contacts
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="exclude-recent"
            checked={excludeRecentlyContacted}
            onCheckedChange={(checked) => setExcludeRecentlyContacted(checked === true)}
          />
          <label htmlFor="exclude-recent" className="text-sm text-slate-600 dark:text-slate-400">
            Exclude contacts emailed in the last
          </label>
          <Input
            type="number"
            min={1}
            max={90}
            value={recentDays}
            onChange={(e) => setRecentDays(parseInt(e.target.value) || 7)}
            className="w-16 h-7 text-center text-sm"
            disabled={!excludeRecentlyContacted}
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">days</span>
        </div>
      </div>

      {/* Selected Recipients Summary */}
      {selectedRecipients.length > 0 && (
        <div className="bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span className="font-medium text-teal-800 dark:text-teal-200">
                {selectedRecipients.length} recipients selected
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-teal-600 hover:text-teal-800 dark:text-teal-400"
            >
              Clear All
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {selectedRecipients.slice(0, 20).map((recipient) => (
              <span
                key={recipient.record_id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-900 rounded text-sm
                  text-slate-700 dark:text-slate-300 border border-teal-200 dark:border-teal-500/30"
              >
                {recipient.email}
                <button
                  type="button"
                  onClick={() => removeRecipient(recipient.record_id)}
                  className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedRecipients.length > 20 && (
              <span className="text-sm text-teal-600 dark:text-teal-400">
                +{selectedRecipients.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
