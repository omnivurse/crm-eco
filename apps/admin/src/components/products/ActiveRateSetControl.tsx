'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui';
import { Settings, Shield, Loader2, CheckCircle2 } from 'lucide-react';

type RateSetValue = 'current' | 'rates_2026' | 'auto';

interface ActiveRateSetControlProps {
  compact?: boolean;
}

export function ActiveRateSetControl({ compact = false }: ActiveRateSetControlProps) {
  const [currentValue, setCurrentValue] = useState<RateSetValue>('auto');
  const [pendingValue, setPendingValue] = useState<RateSetValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastChanged, setLastChanged] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSetting();
  }, []);

  const loadSetting = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rates/settings');
      if (res.ok) {
        const data = await res.json();
        setCurrentValue(data.active_rate_set || 'auto');
        setLastChanged(data.last_changed_at);
      }
    } catch {
      // Ignore — will show as 'auto'
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: RateSetValue) => {
    setPendingValue(value);
    setShowConfirm(true);
  };

  const confirmChange = async () => {
    if (pendingValue === null) return;
    setSaving(true);
    try {
      const apiValue = pendingValue === 'auto' ? null : pendingValue;
      const res = await fetch('/api/rates/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_rate_set: apiValue }),
      });

      if (res.ok) {
        setCurrentValue(pendingValue);
        setLastChanged(new Date().toISOString());
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
      setShowConfirm(false);
      setPendingValue(null);
    }
  };

  const getLabel = (val: RateSetValue) => {
    switch (val) {
      case 'auto': return 'Auto (date-based)';
      case 'current': return 'Force: Current Rates';
      case 'rates_2026': return 'Force: 2026 Rates';
    }
  };

  const getBadgeVariant = (val: RateSetValue): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (val === 'auto') return 'secondary';
    if (val === 'rates_2026') return 'default';
    return 'outline';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Shield className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-600">Active Rate Set:</span>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : (
          <>
            <Badge variant={getBadgeVariant(currentValue)} className="text-xs">
              {getLabel(currentValue)}
            </Badge>
            {saved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Active Rate Set Override
          </CardTitle>
          <CardDescription>
            Control which rate set the system uses for quotes and enrollment.
            Leave on "Auto" to select based on coverage start date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading setting...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Select value={currentValue} onValueChange={(v) => handleChange(v as RateSetValue)}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (date-based)</SelectItem>
                    <SelectItem value="current">Force: Current Rates</SelectItem>
                    <SelectItem value="rates_2026">Force: 2026 Rates</SelectItem>
                  </SelectContent>
                </Select>

                <Badge variant={getBadgeVariant(currentValue)}>
                  {getLabel(currentValue)}
                </Badge>

                {saved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </span>
                )}
              </div>

              {currentValue !== 'auto' && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <strong>Override active:</strong> All quotes and enrollments will use the{' '}
                  <strong>{currentValue === 'current' ? 'Current' : '2026'}</strong> rate set,
                  regardless of coverage start date.
                </div>
              )}

              {lastChanged && (
                <p className="text-xs text-slate-400">
                  Last changed: {new Date(lastChanged).toLocaleString()}
                </p>
              )}

              <div className="p-3 rounded-lg bg-slate-50 border text-sm text-slate-600 space-y-1">
                <p className="font-medium">How rate set selection works:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
                  <li><strong>Auto:</strong> Coverage start before Jan 1, 2026 = Current rates; on/after = 2026 rates</li>
                  <li><strong>Force Current:</strong> Always use current rates regardless of date</li>
                  <li><strong>Force 2026:</strong> Always use 2026 rates regardless of date</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rate Set Change</DialogTitle>
            <DialogDescription>
              This will change the active rate set used for all new quotes and enrollments.
              An audit log entry will be recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(currentValue)} className="text-xs">
                {getLabel(currentValue)}
              </Badge>
              <span className="text-slate-400">→</span>
              <Badge variant={getBadgeVariant(pendingValue || 'auto')} className="text-xs">
                {getLabel(pendingValue || 'auto')}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={confirmChange} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
