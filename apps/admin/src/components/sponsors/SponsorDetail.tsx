'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import { toast } from 'sonner';
import { SponsorForm } from './SponsorForm';

interface SponsorRow {
  id: string;
  name: string;
  legal_name: string | null;
  status: 'draft' | 'active' | 'inactive';
  billing_email: string | null;
  phone: string | null;
  enrollment_cutoff_day: number;
  backbill_months: number;
  dependent_cap: number | null;
  allow_multiple_plans: boolean;
  billing_start_date: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

interface PlanRow {
  id: string;
  name: string;
  code: string;
}

interface SponsorPlanRow {
  id: string;
  plan_id: string;
  is_default: boolean;
  available_for_enrollment: boolean;
}

interface RosterRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  relationship: string;
  status: string;
  eligible_end: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  status: string | null;
  total: number | null;
  period_start: string | null;
  period_end: string | null;
}

interface AdminRow {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  accepted_at: string | null;
}

interface ImportPlan {
  total_rows: number;
  matched_rows: number;
  inserted_rows: number;
  updated_rows: number;
  terminated_rows: number;
  error_rows: number;
  rows: Array<{ row_number: number; action: string; message?: string }>;
}

export function SponsorDetail({
  sponsor,
  plans,
  sponsorPlans,
  roster,
  invoices,
  admins,
}: {
  sponsor: SponsorRow;
  plans: PlanRow[];
  sponsorPlans: SponsorPlanRow[];
  roster: RosterRow[];
  invoices: InvoiceRow[];
  admins: AdminRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const attached = useMemo(() => new Set(sponsorPlans.map((p) => p.plan_id)), [sponsorPlans]);

  const [csvText, setCsvText] = useState('');
  const [filename, setFilename] = useState('');
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const period = currentPeriod();
  const [periodStart, setPeriodStart] = useState(period.start);
  const [periodEnd, setPeriodEnd] = useState(period.end);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'billing' | 'roster'>('admin');
  const [enrollMode, setEnrollMode] = useState<'eligible_only' | 'known_roster'>('eligible_only');

  async function togglePlan(planId: string, attachedNow: boolean) {
    try {
      if (!attachedNow && !sponsor.allow_multiple_plans && sponsorPlans.length >= 1) {
        toast.error('This sponsor allows only one plan');
        return;
      }
      if (attachedNow) {
        const { error } = await (supabase as any)
          .from('sponsor_plans')
          .delete()
          .eq('sponsor_id', sponsor.id)
          .eq('plan_id', planId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user!.id)
          .single();
        const { error } = await (supabase as any).from('sponsor_plans').insert({
          organization_id: (profile as { organization_id: string }).organization_id,
          sponsor_id: sponsor.id,
          plan_id: planId,
          is_default: sponsorPlans.length === 0,
        });
        if (error) throw error;
      }
      toast.success('Plan updated');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update plan');
    }
  }

  async function runRoster(mode: 'dry_run' | 'apply') {
    setBusy(true);
    try {
      const res = await fetch(`/api/sponsors/${sponsor.id}/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, mode, enrollMode, filename }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Import failed');
      setImportPlan(body);
      toast.success(mode === 'apply' ? 'Roster applied' : 'Dry-run complete');
      if (mode === 'apply') router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Roster import failed');
    } finally {
      setBusy(false);
    }
  }

  async function generateInvoice() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sponsors/${sponsor.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart, periodEnd }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Invoice failed');
      toast.success(
        body.already_exists
          ? `Invoice already exists for this period — ${body.headcount ?? 0} lives, $${Number(body.total ?? 0).toFixed(2)}`
          : `Draft invoice ready — ${body.headcount ?? 0} lives, $${Number(body.total ?? 0).toFixed(2)}`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invoice failed');
    } finally {
      setBusy(false);
    }
  }

  async function inviteAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/sponsors/${sponsor.id}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Invite failed');
      toast.success(body.note || 'Admin saved');
      setInviteEmail('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tabs defaultValue="account" className="space-y-4">
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="plans">Plans</TabsTrigger>
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="admins">Admins</TabsTrigger>
      </TabsList>

      <TabsContent value="account">
        <SponsorForm
          initial={{
            id: sponsor.id,
            name: sponsor.name,
            legal_name: sponsor.legal_name || '',
            status: sponsor.status,
            billing_email: sponsor.billing_email || '',
            phone: sponsor.phone || '',
            enrollment_cutoff_day: sponsor.enrollment_cutoff_day,
            backbill_months: sponsor.backbill_months,
            dependent_cap: sponsor.dependent_cap == null ? '' : String(sponsor.dependent_cap),
            allow_multiple_plans: sponsor.allow_multiple_plans,
            billing_start_date: sponsor.billing_start_date || '',
            address_line1: sponsor.address_line1 || '',
            city: sponsor.city || '',
            state: sponsor.state || '',
            postal_code: sponsor.postal_code || '',
          }}
        />
      </TabsContent>

      <TabsContent value="plans">
        <Card>
          <CardHeader>
            <CardTitle>Offered plans</CardTitle>
            <CardDescription>Employees can enroll in attached plans from the bound landing page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans.length === 0 && <p className="text-sm text-slate-500">No active plans in this organization.</p>}
            {plans.map((plan) => {
              const isOn = attached.has(plan.id);
              return (
                <div key={plan.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-slate-500">{plan.code}</p>
                  </div>
                  <Button variant={isOn ? 'secondary' : 'outline'} size="sm" onClick={() => togglePlan(plan.id, isOn)}>
                    {isOn ? 'Attached' : 'Attach'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="roster" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>CSV import</CardTitle>
            <CardDescription>
              Columns: first_name, last_name, date_of_birth, email, relationship, eligible_start, eligible_end, status.
              Always dry-run first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFilename(file.name);
                setCsvText(await file.text());
              }}
            />
            <textarea
              className="min-h-32 w-full rounded-md border p-3 font-mono text-xs"
              placeholder="first_name,last_name,date_of_birth,email"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enrollMode === 'known_roster'}
                onChange={(e) => setEnrollMode(e.target.checked ? 'known_roster' : 'eligible_only')}
              />
              Known roster (create members without employee card charge — needs SPONSOR_KNOWN_ROSTER_ENABLED)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy || !csvText.trim()} onClick={() => runRoster('dry_run')}>
                Dry-run
              </Button>
              <Button type="button" disabled={busy || !csvText.trim()} onClick={() => runRoster('apply')}>
                Apply roster
              </Button>
            </div>
            {importPlan && (
              <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                <p>
                  {importPlan.total_rows} rows · {importPlan.inserted_rows} insert · {importPlan.updated_rows} update ·{' '}
                  {importPlan.terminated_rows} terminate · {importPlan.error_rows} error
                </p>
                {importPlan.rows.filter((r) => r.action === 'error').slice(0, 8).map((row) => (
                  <p key={row.row_number} className="text-red-700">
                    Row {row.row_number}: {row.message}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current roster ({roster.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {roster.length === 0 ? (
              <p className="text-sm text-slate-500">No people on this roster yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2">Name</th>
                    <th>DOB</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Eligible end</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2">
                        {row.first_name} {row.last_name}
                        {row.email && <span className="block text-xs text-slate-500">{row.email}</span>}
                      </td>
                      <td>{row.date_of_birth || '—'}</td>
                      <td>{row.relationship}</td>
                      <td>
                        <Badge variant="secondary">{row.status}</Badge>
                      </td>
                      <td>{row.eligible_end || '—'}</td>
                      <td>
                        {row.email && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await fetch(`/api/sponsors/${sponsor.id}/invites`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ rosterId: row.id }),
                                });
                                const body = await res.json();
                                if (!res.ok) throw new Error(body.error || 'Invite failed');
                                toast.success(body.invite?.sent ? 'Invite sent' : body.invite?.dryRun ? 'Invite dry-run (email gated)' : 'Invite stored');
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Invite failed');
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Invite
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="invoices" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Generate sponsor invoice</CardTitle>
            <CardDescription>One invoice per sponsor per period. Existing non-void invoices are left alone.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="period_start">Period start</Label>
              <Input id="period_start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Period end</Label>
              <Input id="period_end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="button" disabled={busy} onClick={generateInvoice}>
                Generate draft
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500">No sponsor invoices yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2">Number</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t">
                      <td className="py-2 font-mono">{inv.invoice_number}</td>
                      <td>
                        {inv.period_start} – {inv.period_end}
                      </td>
                      <td>{inv.status}</td>
                      <td>${Number(inv.total ?? 0).toFixed(2)}</td>
                      <td>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy || inv.status === 'paid'}
                          onClick={async () => {
                            const amount = Number(inv.total ?? 0);
                            if (!(amount > 0)) return;
                            setBusy(true);
                            try {
                              const res = await fetch(`/api/invoices/${inv.id}/payments`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  amount,
                                  kind: 'payment',
                                  paymentMethod: 'offline',
                                  notes: 'Sponsor invoice recorded by staff',
                                }),
                              });
                              const body = await res.json();
                              if (!res.ok) throw new Error(body.error || 'Payment failed');
                              toast.success('Payment recorded');
                              router.refresh();
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Payment failed');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Record paid
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="admins">
        <Card>
          <CardHeader>
            <CardTitle>Employer admins</CardTitle>
            <CardDescription>
              Saving an admin emails them when SPONSOR_EMAIL_ENABLED=true; otherwise the invite is stored as a dry-run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={inviteAdmin} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invite_email">Email</Label>
                <Input id="invite_email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite_role">Role</Label>
                <select
                  id="invite_role"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                >
                  <option value="admin">Admin</option>
                  <option value="roster">Roster</option>
                  <option value="billing">Billing</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={busy}>
                  Save admin
                </Button>
              </div>
            </form>
            {admins.length === 0 ? (
              <p className="text-sm text-slate-500">No employer admins yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2">Email</th>
                    <th>Role</th>
                    <th>Linked</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id} className="border-t">
                      <td className="py-2">{admin.email}</td>
                      <td>{admin.role}</td>
                      <td>{admin.user_id ? 'Yes' : 'Pending account'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function currentPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
