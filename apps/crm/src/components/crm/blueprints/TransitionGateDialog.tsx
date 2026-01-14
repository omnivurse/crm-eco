'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  ShieldAlert,
  FileCheck,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { FieldRequirement } from '@/lib/blueprints/types';

interface ValidationError {
  field: string;
  message: string;
  rule_name: string;
  rule_type?: string;
}

interface TransitionGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  currentStage: string | null;
  currentStageLabel?: string;
  targetStage: string;
  targetStageLabel: string;
  targetStageColor?: string;
  onComplete: (result: { success: boolean; record?: unknown }) => void;
}

interface TransitionCheckResult {
  allowed: boolean;
  valid: boolean;
  requiresApproval: boolean;
  requiresReason: boolean;
  missingFields: FieldRequirement[];
  allRequiredFields?: FieldRequirement[];
  validationErrors: ValidationError[];
  blueprintError?: string;
}

export function TransitionGateDialog({
  open,
  onOpenChange,
  recordId,
  currentStage,
  currentStageLabel,
  targetStage,
  targetStageLabel,
  targetStageColor,
  onComplete,
}: TransitionGateDialogProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkResult, setCheckResult] = useState<TransitionCheckResult | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Check transition requirements
  const checkTransition = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/crm/check-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          toStage: targetStage,
          payload: fieldValues,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check transition');
      }

      const result = await response.json();
      setCheckResult(result);
    } catch (err) {
      console.error('Error checking transition:', err);
      setError('Failed to load transition requirements');
    } finally {
      setLoading(false);
    }
  }, [recordId, targetStage, fieldValues]);

  // Initial check when dialog opens
  useEffect(() => {
    if (open) {
      setFieldValues({});
      setReason('');
      checkTransition();
    }
  }, [open, checkTransition]);

  // Re-check when field values change (debounced)
  useEffect(() => {
    if (!open || loading) return;
    
    const timer = setTimeout(() => {
      checkTransition();
    }, 500);

    return () => clearTimeout(timer);
  }, [fieldValues, open]);

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/crm/blueprint-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          toStage: targetStage,
          reason: reason || undefined,
          payload: Object.keys(fieldValues).length > 0 ? fieldValues : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.requiresApproval) {
          setError('This transition requires approval. An approval request has been created.');
          onComplete({ success: true, record: result });
          return;
        }
        
        if (result.validationErrors?.length > 0) {
          setError(`Validation failed: ${result.validationErrors.map((e: ValidationError) => e.message).join(', ')}`);
          return;
        }
        
        if (result.missingFields?.length > 0) {
          setError(`Missing required fields: ${result.missingFields.join(', ')}`);
          return;
        }
        
        throw new Error(result.error || 'Transition failed');
      }

      onComplete({ success: true, record: result.record });
      onOpenChange(false);
    } catch (err) {
      console.error('Error executing transition:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete transition');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = checkResult?.valid && 
    (!checkResult.requiresReason || reason.trim().length > 0) &&
    !submitting;

  const requiredFields = checkResult?.allRequiredFields || checkResult?.missingFields || [];
  const missingFieldKeys = checkResult?.missingFields?.map(f => f.key) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileCheck className="w-5 h-5 text-teal-400" />
            Stage Transition
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Complete the required fields to move this record to the next stage.
          </DialogDescription>
        </DialogHeader>

        {/* Stage transition indicator */}
        <div className="flex items-center justify-center gap-3 py-4">
          <Badge 
            variant="outline" 
            className="bg-slate-800/50 border-slate-600 text-slate-300 px-3 py-1.5"
          >
            {currentStageLabel || currentStage || 'None'}
          </Badge>
          <ArrowRight className="w-5 h-5 text-slate-500" />
          <Badge 
            className="px-3 py-1.5"
            style={{ 
              backgroundColor: targetStageColor ? `${targetStageColor}20` : undefined,
              borderColor: targetStageColor,
              color: targetStageColor || undefined,
            }}
          >
            {targetStageLabel}
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
          </div>
        ) : checkResult && !checkResult.allowed ? (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Transition Not Allowed</p>
              <p className="text-sm text-slate-400 mt-1">
                {checkResult.blueprintError || 'This stage transition is not permitted.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Required fields */}
            {requiredFields.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-300">
                  Required Fields
                </Label>
                {requiredFields.map((field) => {
                  const isMissing = missingFieldKeys.includes(field.key);
                  const currentValue = fieldValues[field.key] ?? (field.value as string) ?? '';
                  
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label 
                          htmlFor={field.key}
                          className="text-sm text-slate-400 flex items-center gap-2"
                        >
                          {field.label}
                          {!isMissing && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          )}
                        </Label>
                        {isMissing && (
                          <span className="text-xs text-amber-400">Required</span>
                        )}
                      </div>
                      {field.type === 'select' ? (
                        <Select 
                          value={currentValue}
                          onValueChange={(v) => handleFieldChange(field.key, v)}
                        >
                          <SelectTrigger className={cn(
                            "glass border-white/10 text-white",
                            isMissing && "border-amber-500/50"
                          )}>
                            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Select...</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : field.type === 'textarea' ? (
                        <Textarea
                          id={field.key}
                          value={currentValue}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                          className={cn(
                            "glass border-white/10 text-white placeholder:text-slate-500",
                            isMissing && "border-amber-500/50"
                          )}
                          rows={2}
                        />
                      ) : (
                        <Input
                          id={field.key}
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={currentValue}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                          className={cn(
                            "glass border-white/10 text-white placeholder:text-slate-500",
                            isMissing && "border-amber-500/50"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reason field */}
            {checkResult?.requiresReason && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reason" className="text-sm text-slate-400">
                    Reason for transition
                  </Label>
                  <span className="text-xs text-amber-400">Required</span>
                </div>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this transition is being made..."
                  className="glass border-white/10 text-white placeholder:text-slate-500"
                  rows={2}
                />
              </div>
            )}

            {/* Validation errors */}
            {checkResult?.validationErrors && checkResult.validationErrors.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Validation Errors
                </Label>
                <div className="space-y-1">
                  {checkResult.validationErrors.map((err, idx) => (
                    <div 
                      key={idx}
                      className="text-sm text-slate-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2"
                    >
                      <span className="text-red-400">{err.field}:</span> {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval notice */}
            {checkResult?.requiresApproval && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Approval Required</p>
                  <p className="text-xs text-slate-400 mt-1">
                    This transition will create an approval request.
                  </p>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="glass border-white/10 text-slate-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || !checkResult?.allowed}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : checkResult?.requiresApproval ? (
              'Request Approval'
            ) : (
              'Complete Transition'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
