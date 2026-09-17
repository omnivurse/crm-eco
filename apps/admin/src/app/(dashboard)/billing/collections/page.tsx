'use client';

import { useEffect, useState } from 'react';
import { ArrowClockwise, CreditCard, Warning } from '@phosphor-icons/react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@crm-eco/ui';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from 'sonner';

interface DunningStep {
  attempt: number;
  daysAfterFailure: number;
  template: string;
}

interface ExpiringCard {
  id: string;
  member_id: string;
  last_four: string | null;
  expiration_date: string | null;
  member_name: string | null;
  email: string | null;
}

export default function BillingCollectionsPage() {
  const [schedule, setSchedule] = useState<DunningStep[]>([]);
  const [cards, setCards] = useState<ExpiringCard[]>([]);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [dunningRes, cardsRes] = await Promise.all([
        fetch('/api/billing/dunning-schedule'),
        fetch('/api/billing/expiring-cards?withinDays=60'),
      ]);
      const dunning = await dunningRes.json();
      const expiring = await cardsRes.json();
      if (!dunningRes.ok) throw new Error(dunning.error || 'Could not load dunning schedule');
      if (!cardsRes.ok) throw new Error(expiring.error || 'Could not load expiring cards');
      setSchedule(dunning.schedule ?? []);
      setCards(expiring.cards ?? []);
      setScanned(expiring.scanned ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/billing/dunning-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save schedule');
      setSchedule(payload.schedule ?? schedule);
      toast.success('Dunning schedule saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/invoices"
        backLabel="Invoices"
        title="Collections"
        description="Configurable dunning and cards expiring in the next 60 days"
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <ArrowClockwise weight="light" className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dunning schedule</CardTitle>
            <CardDescription>
              Days after the first failure. The billing-retry job reads this after it is deployed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              schedule.map((step, index) => (
                <div key={step.attempt} className="grid grid-cols-3 gap-2 items-center">
                  <div className="text-sm font-medium">Attempt {step.attempt}</div>
                  <Input
                    type="number"
                    min="0"
                    value={step.daysAfterFailure}
                    onChange={(e) => {
                      const daysAfterFailure = Number(e.target.value) || 0;
                      setSchedule((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, daysAfterFailure } : row
                        )
                      );
                    }}
                  />
                  <Input
                    value={step.template}
                    onChange={(e) => {
                      const template = e.target.value;
                      setSchedule((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, template } : row
                        )
                      );
                    }}
                  />
                </div>
              ))
            )}
            <Button onClick={() => void saveSchedule()} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save schedule'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiring cards</CardTitle>
            <CardDescription>
              {scanned} active profiles scanned. {cards.length} expire within 60 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : cards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard weight="light" className="h-8 w-8 mx-auto mb-2" />
                No cards expiring in the next 60 days
              </div>
            ) : (
              <div className="space-y-2">
                {cards.map((card) => (
                  <div key={card.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium">{card.member_name || 'Member'}</p>
                      <p className="text-sm text-muted-foreground">
                        •••• {card.last_four} · {card.email || 'no email'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <Warning weight="light" className="h-4 w-4" />
                      <span className="text-sm font-medium">{card.expiration_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
