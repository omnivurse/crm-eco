'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/components/ui/dialog';
import { Button } from '@ui/components/ui/button';
import { Input } from '@ui/components/ui/input';
import { Textarea } from '@ui/components/ui/textarea';
import { Label } from '@ui/components/ui/label';
import { Badge } from '@ui/components/ui/badge';
import { Alert, AlertDescription } from '@ui/components/ui/alert';
import { CheckCircle, AlertCircle, Clock, ArrowRight } from 'lucide-react';

interface TransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  moduleId: string;
  currentStage: string | null;
  targetStage: string;
  targetLabel: string;
  requiredFields: string[];
  requiresReason: boolean;
  requiresApproval: boolean;
  onComplete: (newStage: string) => void;
}

interface FieldDefinition {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export function TransitionModal({
  open,
  onOpenChange,
  recordId,
  moduleId,
  currentStage,
  targetStage,
  targetLabel,
  requiredFields,
  requiresReason,
  requiresApproval,
  onComplete,
}: TransitionModalProps) {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [approvalCreated, setApprovalCreated] = useState(false);
  
  // Form state
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Load field definitions and current values
  useEffect(() => {
    if (!open) return;
    
    async function loadData() {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setApprovalCreated(false);
      
      try {
        // Get field definitions
        const { data: fields } = await supabase
          .from('crm_fields')
          .select('key, label, type, required')
          .eq('module_id', moduleId);
        
        setFieldDefs((fields || []) as FieldDefinition[]);
        
        // Get current record values
        const { data: record } = await supabase
          .from('crm_records')
          .select('data')
          .eq('id', recordId)
          .single();
        
        // Initialize field values for required fields
        const initialValues: Record<string, string> = {};
        const missing: string[] = [];
        
        for (const fieldKey of requiredFields) {
          const currentValue = record?.data?.[fieldKey];
          if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
            initialValues[fieldKey] = String(currentValue);
          } else {
            missing.push(fieldKey);
            initialValues[fieldKey] = '';
          }
        }
        
        setFieldValues(initialValues);
        setMissingFields(missing);
      } catch (err) {
        console.error('Failed to load field data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [open, recordId, moduleId, requiredFields, supabase]);

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
    
    // Update missing fields
    if (value.trim()) {
      setMissingFields(prev => prev.filter(f => f !== key));
    } else if (!missingFields.includes(key)) {
      setMissingFields(prev => [...prev, key]);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    
    try {
      // Build payload with only changed/filled fields
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value.trim()) {
          payload[key] = value;
        }
      }
      
      const response = await fetch('/api/crm/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          toStage: targetStage,
          reason: reason || undefined,
          payload: Object.keys(payload).length > 0 ? payload : undefined,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setError(result.error || 'Failed to transition');
        if (result.missingFields) {
          setMissingFields(result.missingFields);
        }
        return;
      }
      
      if (result.requiresApproval) {
        setApprovalCreated(true);
        setSuccess(true);
      } else if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onComplete(targetStage);
        }, 1000);
      }
    } catch (err) {
      setError('Failed to transition');
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldLabel = (key: string): string => {
    const field = fieldDefs.find(f => f.key === key);
    return field?.label || key;
  };

  const canSubmit = missingFields.length === 0 && (!requiresReason || reason.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Transition to {targetLabel}
            <ArrowRight className="h-4 w-4" />
          </DialogTitle>
          <DialogDescription>
            {requiresApproval ? (
              'This transition requires approval. An approval request will be created.'
            ) : (
              'Complete the required fields to proceed with this transition.'
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : success ? (
          <div className="py-8 text-center">
            {approvalCreated ? (
              <>
                <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Approval Request Created</h3>
                <p className="text-muted-foreground">
                  Your transition request has been submitted for approval.
                </p>
              </>
            ) : (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Transition Complete</h3>
                <p className="text-muted-foreground">
                  Record has been moved to {targetLabel}.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 py-4">
              {/* Required Fields */}
              {requiredFields.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Required Fields</Label>
                    {missingFields.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {missingFields.length} missing
                      </Badge>
                    )}
                  </div>
                  
                  {requiredFields.map(fieldKey => {
                    const isMissing = missingFields.includes(fieldKey);
                    
                    return (
                      <div key={fieldKey} className="space-y-2">
                        <Label className={isMissing ? 'text-destructive' : ''}>
                          {getFieldLabel(fieldKey)}
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                          value={fieldValues[fieldKey] || ''}
                          onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                          placeholder={`Enter ${getFieldLabel(fieldKey).toLowerCase()}`}
                          className={isMissing ? 'border-destructive' : ''}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reason */}
              {requiresReason && (
                <div className="space-y-2">
                  <Label>
                    Reason for Transition
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why you are making this transition..."
                    rows={3}
                  />
                </div>
              )}

              {/* Approval Notice */}
              {requiresApproval && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    This transition requires approval. After submitting, an approval request will be created for review.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                {submitting ? 'Processing...' : requiresApproval ? 'Request Approval' : 'Transition'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
