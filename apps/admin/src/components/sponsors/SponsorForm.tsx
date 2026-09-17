'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@crm-eco/ui';
import { toast } from 'sonner';

export interface SponsorFormValues {
  id?: string;
  name: string;
  legal_name: string;
  status: 'draft' | 'active' | 'inactive';
  billing_email: string;
  phone: string;
  enrollment_cutoff_day: number;
  backbill_months: number;
  dependent_cap: string;
  allow_multiple_plans: boolean;
  billing_start_date: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
}

const empty: SponsorFormValues = {
  name: '',
  legal_name: '',
  status: 'active',
  billing_email: '',
  phone: '',
  enrollment_cutoff_day: 15,
  backbill_months: 6,
  dependent_cap: '',
  allow_multiple_plans: false,
  billing_start_date: '',
  address_line1: '',
  city: '',
  state: '',
  postal_code: '',
};

export function SponsorForm({ initial }: { initial?: Partial<SponsorFormValues> }) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SponsorFormValues>({ ...empty, ...initial });

  function set<K extends keyof SponsorFormValues>(key: K, value: SponsorFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single() as { data: { id: string; organization_id: string } | null };

      if (!profile) throw new Error('Profile not found');

      const payload = {
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        status: form.status,
        billing_email: form.billing_email.trim() || null,
        phone: form.phone.trim() || null,
        enrollment_cutoff_day: Number(form.enrollment_cutoff_day) || 1,
        backbill_months: Number(form.backbill_months) || 0,
        dependent_cap: form.dependent_cap === '' ? null : Number(form.dependent_cap),
        allow_multiple_plans: form.allow_multiple_plans,
        billing_start_date: form.billing_start_date || null,
        address_line1: form.address_line1.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim() || null,
        organization_id: profile.organization_id,
        updated_at: new Date().toISOString(),
      };

      if (form.id) {
        const { error } = await (supabase as any).from('sponsors').update(payload).eq('id', form.id);
        if (error) throw error;
        toast.success('Sponsor saved');
        router.refresh();
      } else {
        const { data, error } = await (supabase as any)
          .from('sponsors')
          .insert({ ...payload, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        toast.success('Sponsor created');
        router.push(`/sponsors/${data.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save sponsor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input id="legal_name" value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.status}
              onChange={(e) => set('status', e.target.value as SponsorFormValues['status'])}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_email">Billing email</Label>
            <Input id="billing_email" type="email" value={form.billing_email} onChange={(e) => set('billing_email', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_start_date">Billing start</Label>
            <Input id="billing_start_date" type="date" value={form.billing_start_date} onChange={(e) => set('billing_start_date', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment rules</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="enrollment_cutoff_day">Cutoff day (1–28)</Label>
            <Input
              id="enrollment_cutoff_day"
              type="number"
              min={1}
              max={28}
              value={form.enrollment_cutoff_day}
              onChange={(e) => set('enrollment_cutoff_day', Number(e.target.value))}
            />
            <p className="text-xs text-slate-500">Start dates are always the 1st. After this day, start rolls to next month.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="backbill_months">Backbill months</Label>
            <Input
              id="backbill_months"
              type="number"
              min={0}
              max={24}
              value={form.backbill_months}
              onChange={(e) => set('backbill_months', Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dependent_cap">Dependent cap</Label>
            <Input
              id="dependent_cap"
              type="number"
              min={0}
              value={form.dependent_cap}
              onChange={(e) => set('dependent_cap', e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input
              type="checkbox"
              checked={form.allow_multiple_plans}
              onChange={(e) => set('allow_multiple_plans', e.target.checked)}
            />
            Allow more than one plan on this sponsor
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address_line1">Street</Label>
            <Input id="address_line1" value={form.address_line1} onChange={(e) => set('address_line1', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal code</Label>
              <Input id="postal_code" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !form.name.trim()}>
          {saving ? 'Saving…' : form.id ? 'Save sponsor' : 'Create sponsor'}
        </Button>
      </div>
    </form>
  );
}
