'use client';

import { useState, useEffect } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Badge } from '@crm-eco/ui/components/badge';
import { Progress } from '@crm-eco/ui/components/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Sparkles,
  Calculator,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  RefreshCw,
  X,
  Plus,
  Building,
  MapPin,
  FileText,
} from 'lucide-react';
import type { PricingEstimate, PricingInput } from '@/lib/pricing/types';

interface PricingEstimatorProps {
  needId?: string;
  initialData?: Partial<PricingInput>;
  onEstimateGenerated?: (estimate: PricingEstimate) => void;
  compact?: boolean;
}

const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'urgent_care', label: 'Urgent Care' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'specialist', label: 'Specialist Office' },
  { value: 'imaging', label: 'Imaging Center' },
  { value: 'lab', label: 'Lab/Testing' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'other', label: 'Other' },
];

const NEED_TYPES = [
  { value: 'medical', label: 'Medical Visit' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'procedure', label: 'Procedure/Surgery' },
  { value: 'lab', label: 'Lab Work' },
  { value: 'imaging', label: 'Imaging/Scans' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'therapy', label: 'Therapy/Rehab' },
  { value: 'dental', label: 'Dental' },
  { value: 'vision', label: 'Vision' },
  { value: 'mental_health', label: 'Mental Health' },
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function PricingEstimator({
  needId,
  initialData,
  onEstimateGenerated,
  compact = false,
}: PricingEstimatorProps) {
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!needId);
  const [estimate, setEstimate] = useState<PricingEstimate | null>(null);
  const [suggestedCodes, setSuggestedCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<PricingInput>({
    needType: initialData?.needType || 'medical',
    description: initialData?.description || '',
    procedureCodes: initialData?.procedureCodes || [],
    facilityType: initialData?.facilityType,
    inNetwork: initialData?.inNetwork ?? true,
    memberState: initialData?.memberState || '',
    billedAmount: initialData?.billedAmount,
  });

  const [newCode, setNewCode] = useState('');

  // Load existing estimate if needId provided
  useEffect(() => {
    if (needId) {
      loadExistingEstimate();
    }
  }, [needId]);

  async function loadExistingEstimate() {
    setLoadingExisting(true);
    try {
      const res = await fetch(`/api/pricing/estimate?needId=${needId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.input) {
          setForm(prev => ({ ...prev, ...data.input }));
        }
        if (data.estimate) {
          setEstimate(data.estimate);
        }
        if (data.suggestedCodes) {
          setSuggestedCodes(data.suggestedCodes);
        }
      }
    } catch (err) {
      console.error('Failed to load existing estimate:', err);
    } finally {
      setLoadingExisting(false);
    }
  }

  async function generateEstimate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pricing/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate estimate');
      }

      setEstimate(data.estimate);
      setSuggestedCodes(data.suggestedCodes || []);
      onEstimateGenerated?.(data.estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const addProcedureCode = (code: string) => {
    if (code && !form.procedureCodes?.includes(code)) {
      setForm({
        ...form,
        procedureCodes: [...(form.procedureCodes || []), code.toUpperCase()],
      });
    }
    setNewCode('');
  };

  const removeProcedureCode = (code: string) => {
    setForm({
      ...form,
      procedureCodes: form.procedureCodes?.filter(c => c !== code) || [],
    });
  };

  const getImpactIcon = (impact: 'increase' | 'decrease' | 'neutral') => {
    switch (impact) {
      case 'increase':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg">
          <Sparkles className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            AI Pricing Estimator
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Get cost estimates based on procedure codes, location, and facility type
          </p>
        </div>
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Need Type</Label>
          <Select value={form.needType} onValueChange={(v) => setForm({ ...form, needType: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NEED_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Facility Type</Label>
          <Select value={form.facilityType || ''} onValueChange={(v) => setForm({ ...form, facilityType: v as any })}>
            <SelectTrigger>
              <SelectValue placeholder="Select facility..." />
            </SelectTrigger>
            <SelectContent>
              {FACILITY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Member State</Label>
          <Select value={form.memberState || ''} onValueChange={(v) => setForm({ ...form, memberState: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select state..." />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Billed Amount (if known)</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="number"
              value={form.billedAmount || ''}
              onChange={(e) => setForm({ ...form, billedAmount: parseFloat(e.target.value) || undefined })}
              placeholder="0.00"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe the medical service or procedure..."
          rows={2}
        />
      </div>

      {/* Procedure Codes */}
      <div className="space-y-2">
        <Label>CPT/Procedure Codes</Label>
        <div className="flex gap-2">
          <Input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Enter CPT code"
            onKeyDown={(e) => e.key === 'Enter' && addProcedureCode(newCode)}
          />
          <Button variant="outline" onClick={() => addProcedureCode(newCode)} disabled={!newCode}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {form.procedureCodes && form.procedureCodes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.procedureCodes.map((code) => (
              <Badge key={code} variant="secondary" className="gap-1">
                {code}
                <button onClick={() => removeProcedureCode(code)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {suggestedCodes.length > 0 && (
          <div className="mt-2 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mb-2">
              <Lightbulb className="w-3 h-3 inline mr-1" />
              Suggested codes based on description:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedCodes.map((code) => (
                <button
                  key={code}
                  onClick={() => addProcedureCode(code)}
                  className="px-2 py-1 text-xs bg-white dark:bg-slate-800 rounded border border-violet-200 dark:border-violet-700 hover:border-violet-500 transition-colors"
                >
                  + {code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* In-Network Toggle */}
      <div className="flex items-center gap-3">
        <Switch
          checked={form.inNetwork ?? true}
          onCheckedChange={(checked) => setForm({ ...form, inNetwork: checked })}
        />
        <Label>In-Network Provider</Label>
      </div>

      {/* Generate Button */}
      <Button onClick={generateEstimate} disabled={loading} className="w-full">
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Calculator className="w-4 h-4 mr-2" />
        )}
        Generate Estimate
      </Button>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {estimate && (
        <Card className="border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                Pricing Estimate
              </CardTitle>
              <Badge variant="outline" className={getConfidenceColor(estimate.confidenceScore)}>
                {estimate.confidenceScore}% confidence
              </Badge>
            </div>
            <CardDescription>{estimate.reasoning.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Price Range */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Low</p>
                <p className="text-xl font-bold text-slate-600 dark:text-slate-300">
                  {formatCurrency(estimate.lowEstimate)}
                </p>
              </div>
              <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border-2 border-violet-200 dark:border-violet-700">
                <p className="text-xs text-violet-600 dark:text-violet-400 mb-1">Expected</p>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {formatCurrency(estimate.avgEstimate)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">High</p>
                <p className="text-xl font-bold text-slate-600 dark:text-slate-300">
                  {formatCurrency(estimate.highEstimate)}
                </p>
              </div>
            </div>

            {/* Member Share */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Eligible Amount</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(estimate.estimatedEligibleAmount)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Member Share</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(estimate.estimatedMemberShare)}
                </p>
              </div>
            </div>

            {/* Confidence Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Confidence</span>
                <span className={getConfidenceColor(estimate.confidenceScore)}>
                  {estimate.confidenceScore}%
                </span>
              </div>
              <Progress value={estimate.confidenceScore} className="h-2" />
              <p className="text-xs text-slate-500 mt-1">
                Method: {estimate.pricingMethod.replace('_', ' ')}
              </p>
            </div>

            {/* Factors */}
            {estimate.reasoning.factors.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                  Pricing Factors
                </p>
                <div className="space-y-2">
                  {estimate.reasoning.factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-sm p-2 bg-slate-50 dark:bg-slate-800/50 rounded"
                    >
                      {getImpactIcon(factor.impact)}
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">{factor.name}</p>
                        <p className="text-slate-500">{factor.description}</p>
                      </div>
                      {factor.adjustment && (
                        <Badge variant={factor.impact === 'increase' ? 'destructive' : 'default'}>
                          {factor.adjustment > 0 ? '+' : ''}{factor.adjustment.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {estimate.reasoning.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings
                </p>
                <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-1">
                  {estimate.reasoning.warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {estimate.reasoning.recommendations.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                  <Lightbulb className="w-4 h-4" />
                  Cost-Saving Tips
                </p>
                <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                  {estimate.reasoning.recommendations.map((rec, idx) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Refresh */}
            <Button variant="outline" size="sm" onClick={generateEstimate} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Recalculate
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PricingEstimator;
