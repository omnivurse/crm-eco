'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@crm-eco/ui';
import { toast } from 'sonner';

export interface AchOriginatorStatus {
  complete: boolean;
  missing: string[];
}

interface Props {
  onStatus?: (status: AchOriginatorStatus) => void;
}

const EMPTY = {
  destinationRouting: '',
  destinationName: '',
  companyName: '',
  companyId: '',
  odfiId: '',
  fileNamePattern: 'NACHA_yyyyMMdd_HHmmss.txt',
  settlementRouting: '',
  settlementAccount: '',
  settlementAccountType: 'checking' as 'checking' | 'savings',
};

export function AchOriginatorSettings({ onStatus }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [masked, setMasked] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/ach-originator');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load ACH originator settings');
      setComplete(Boolean(data.complete));
      setMissing(Array.isArray(data.missing) ? data.missing : []);
      setForm({
        destinationRouting: data.draft?.destinationRouting ?? '',
        destinationName: data.draft?.destinationName ?? '',
        companyName: data.draft?.companyName ?? '',
        companyId: data.draft?.companyId ?? '',
        odfiId: data.draft?.odfiId ?? '',
        fileNamePattern: data.draft?.fileNamePattern ?? EMPTY.fileNamePattern,
        settlementRouting: data.draft?.settlementRouting ?? '',
        settlementAccount: '',
        settlementAccountType:
          data.draft?.settlementAccountType === 'savings' ? 'savings' : 'checking',
      });
      setMasked(data.draft?.settlementAccountMasked ?? data.originator?.settlementAccountMasked ?? null);
      onStatus?.({
        complete: Boolean(data.complete),
        missing: Array.isArray(data.missing) ? data.missing : [],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load ACH settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: keyof typeof EMPTY, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'destinationRouting' && /^\d{9}$/.test(value) && !current.odfiId) {
        next.odfiId = value.slice(0, 8);
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/billing/ach-originator', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMissing(Array.isArray(data.missing) ? data.missing : []);
        throw new Error(data.error || 'Could not save ACH originator settings');
      }
      setComplete(true);
      setMissing([]);
      setMasked(data.originator?.settlementAccountMasked ?? masked);
      setForm((current) => ({ ...current, settlementAccount: '' }));
      onStatus?.({ complete: true, missing: [] });
      toast.success('ACH originator settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ACH originator</CardTitle>
        <CardDescription>
          Bank of Colorado file header identity. Leave blank until Wendy or the bank gives you the
          real values — do not invent a TIN, routing number, or settlement account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {complete
                ? 'Originator settings are complete. Export still needs an encrypted ACH vault on every selected member.'
                : `Incomplete. Missing: ${missing.join(', ') || 'all required fields'}.`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="destinationRouting">Immediate destination routing (9)</Label>
                <Input
                  id="destinationRouting"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="9-digit ABA from the bank"
                  value={form.destinationRouting}
                  onChange={(e) => setField('destinationRouting', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="odfiId">ODFI (8)</Label>
                <Input
                  id="odfiId"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="First 8 of destination routing"
                  value={form.odfiId}
                  onChange={(e) => setField('odfiId', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="destinationName">Immediate destination name (max 23)</Label>
                <Input
                  id="destinationName"
                  maxLength={23}
                  placeholder="Bank name as they want it on the file"
                  value={form.destinationName}
                  onChange={(e) => setField('destinationName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="companyName">Company name (max 16)</Label>
                <Input
                  id="companyName"
                  maxLength={16}
                  placeholder="e.g. PAY IT FORWARD H"
                  value={form.companyName}
                  onChange={(e) => setField('companyName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="companyId">Company ID (10 digits)</Label>
                <Input
                  id="companyId"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Bank-assigned, often 1 + EIN"
                  value={form.companyId}
                  onChange={(e) => setField('companyId', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fileNamePattern">File name pattern</Label>
                <Input
                  id="fileNamePattern"
                  value={form.fileNamePattern}
                  onChange={(e) => setField('fileNamePattern', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="secCode">SEC code</Label>
                <Input id="secCode" value="PPD" readOnly />
              </div>
              <div>
                <Label htmlFor="settlementRouting">Settlement routing (9)</Label>
                <Input
                  id="settlementRouting"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="PIFH Bank of Colorado ABA"
                  value={form.settlementRouting}
                  onChange={(e) => setField('settlementRouting', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="settlementAccountType">Settlement account type</Label>
                <select
                  id="settlementAccountType"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.settlementAccountType}
                  onChange={(e) =>
                    setField('settlementAccountType', e.target.value as 'checking' | 'savings')
                  }
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="settlementAccount">Settlement account number</Label>
                <Input
                  id="settlementAccount"
                  autoComplete="off"
                  placeholder={masked ? `Saved ${masked} — enter a new number to replace` : 'Full account, not last4'}
                  value={form.settlementAccount}
                  onChange={(e) => setField('settlementAccount', e.target.value)}
                />
              </div>
            </div>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save originator settings'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
