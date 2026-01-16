'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { cn } from '@crm-eco/ui/lib/utils';
import { 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
} from 'lucide-react';
import { BlockersPanel } from './BlockersPanel';
import type { CrmField, CrmRecord } from '@/lib/crm/types';

interface StageTransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CrmRecord | null;
  fromStage: string | null;
  fromStageLabel: string;
  fromStageColor?: string;
  toStage: string;
  toStageLabel: string;
  toStageColor?: string;
  requiredFields?: string[];
  requiresReason?: boolean;
  requiresApproval?: boolean;
  onComplete: (success: boolean, newStage?: string) => void;
}

interface FieldValues {
  [key: string]: unknown;
}

export function StageTransitionModal({
  open,
  onOpenChange,
  record,
  fromStage,
  fromStageLabel,
  fromStageColor = '#6366f1',
  toStage,
  toStageLabel,
  toStageColor = '#10b981',
  requiredFields = [],
  requiresReason = false,
  requiresApproval = false,
  onComplete,
}: StageTransitionModalProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<CrmField[]>([]);
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [reason, setReason] = useState('');

  // Load field definitions
  useEffect(() => {
    if (!open || !record) {
      setLoading(false);
      return;
    }

    const currentRecord = record; // Capture for async closure

    async function loadFields() {
      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        const { data: allFields } = await supabase
          .from('crm_fields')
          .select('*')
          .eq('module_id', currentRecord.module_id);

        setFields((allFields || []) as CrmField[]);

        // Initialize field values from record data
        const initialValues: FieldValues = {};
        for (const fieldKey of requiredFields) {
          initialValues[fieldKey] = currentRecord.data?.[fieldKey] ?? null;
        }
        setFieldValues(initialValues);
      } catch (err) {
        console.error('Error loading fields:', err);
        setError('Failed to load field definitions');
      } finally {
        setLoading(false);
      }
    }

    loadFields();
  }, [open, record, requiredFields, supabase]);

  const handleBlockerResolve = useCallback((fieldKey: string, value: unknown) => {
    setFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  }, []);

  // Build blockers list
  const blockers = requiredFields.map(fieldKey => {
    const field = fields.find(f => f.key === fieldKey);
    const currentValue = fieldValues[fieldKey];
    const isResolved = currentValue !== null && currentValue !== undefined && currentValue !== '';

    return {
      fieldKey,
      fieldLabel: field?.label || fieldKey,
      field: field || { key: fieldKey, label: fieldKey, type: 'text' } as CrmField,
      currentValue,
      isResolved,
    };
  });

  const allBlockersResolved = blockers.every(b => b.isResolved);
  const canSubmit = allBlockersResolved && (!requiresReason || reason.trim());

  const handleSubmit = async () => {
    if (!record || !canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      // Build payload
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value !== null && value !== undefined && value !== '') {
          payload[key] = value;
        }
      }

      const response = await fetch('/api/crm/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,
          toStage,
          reason: reason || undefined,
          payload: Object.keys(payload).length > 0 ? payload : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Transition failed');
        return;
      }

      if (result.requiresApproval) {
        setSuccess(true);
        setTimeout(() => {
          onComplete(true);
          onOpenChange(false);
        }, 2000);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onComplete(true, toStage);
          onOpenChange(false);
        }, 1000);
      }
    } catch (err) {
      setError('Failed to complete transition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
      setReason('');
      setError(null);
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-slate-900 dark:text-white">
            {/* Stage transition visualization */}
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: fromStageColor }}
              >
                {fromStageLabel}
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <div
                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: toStageColor }}
              >
                {toStageLabel}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {requiresApproval 
              ? 'This transition requires approval. Complete the requirements to submit for review.'
              : 'Complete any required fields to proceed with this transition.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
          </div>
        ) : success ? (
          <div className="py-8 text-center">
            {requiresApproval ? (
              <>
                <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Approval Request Submitted
                </h3>
                <p className="text-slate-500">
                  Your transition request has been submitted for approval.
                </p>
              </>
            ) : (
              <>
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Transition Complete
                </h3>
                <p className="text-slate-500">
                  Record has been moved to {toStageLabel}.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Blockers Panel */}
            {requiredFields.length > 0 && (
              <BlockersPanel
                blockers={blockers}
                onBlockerResolve={handleBlockerResolve}
              />
            )}

            {/* Reason Field */}
            {requiresReason && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Reason for Transition
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you are making this transition..."
                  className="min-h-[80px] bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
                />
              </div>
            )}

            {/* Approval Notice */}
            {requiresApproval && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                <Clock className="w-4 h-4 flex-shrink-0" />
                This transition requires approval before it takes effect.
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
              className="border-slate-200 dark:border-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : requiresApproval ? (
                'Request Approval'
              ) : (
                'Complete Transition'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
