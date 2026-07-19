'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';

interface PlanRow {
  id: string;
  name: string;
  monthly_share: number | null;
}

export default function NewPriceChangePage() {
  const router = useRouter();
  const supabase = createClient();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlans() {
      const { data } = await supabase
        .from('plans')
        .select('id, name, monthly_share')
        .eq('is_active', true)
        .order('name');
      setPlans((data ?? []) as PlanRow[]);
    }
    loadPlans();
  }, [supabase]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('No organization context');

      const { error: insertErr } = await supabase
        .from('price_change_schedules')
        .insert({
          organization_id: profile.organization_id,
          plan_id: selectedPlanId,
          scheduled_date: scheduledDate,
          new_pricing_snapshot: { monthly_share: parseFloat(newAmount) },
          old_pricing_snapshot: { monthly_share: selectedPlan?.monthly_share ?? 0 },
          notify_members: notifyMembers,
          notes: notes || null,
          status: 'pending',
        });

      if (insertErr) throw insertErr;
      router.push('/billing/price-changes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule price change');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/billing/price-changes">
          <Button variant="ghost" size="sm">
            <ArrowLeft weight="light" className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Schedule Price Change</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="plan">Plan</Label>
              <select
                id="plan"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                required
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${p.monthly_share?.toFixed(2) ?? '0.00'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="newAmount">New Monthly Share Amount ($)</Label>
              <Input
                id="newAmount"
                type="number"
                step="0.01"
                min="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                required
              />
              {selectedPlan && newAmount && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Current: ${selectedPlan.monthly_share?.toFixed(2) ?? '0.00'} →
                  New: ${parseFloat(newAmount).toFixed(2)}
                  {' '}
                  (Δ ${(parseFloat(newAmount) - (selectedPlan.monthly_share ?? 0)).toFixed(2)})
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="scheduledDate">Scheduled Date</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes / Reason (optional)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyMembers}
                onChange={(e) => setNotifyMembers(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify affected members via email
            </label>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={submitting || !selectedPlanId}>
                {submitting ? 'Scheduling...' : 'Schedule Price Change'}
              </Button>
              <Link href="/billing/price-changes">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
