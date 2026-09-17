'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@crm-eco/ui';

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
  due_date: string | null;
}

interface ApprovalRow {
  id: string;
  status: string;
  role: string;
  member_id: string | null;
  name: string;
  email: string | null;
}

export function EmployerSponsorConsole({
  sponsorId,
  sponsorName,
  role,
  roster,
  invoices,
  approvals,
}: {
  sponsorId: string;
  sponsorName: string;
  role: string;
  roster: RosterRow[];
  invoices: InvoiceRow[];
  approvals: ApprovalRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [person, setPerson] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    email: '',
    relationship: 'employee',
  });
  const [csvText, setCsvText] = useState('');
  const [enrollMode, setEnrollMode] = useState<'eligible_only' | 'known_roster'>('eligible_only');

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/employer/${sponsorId}/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not add person');
      setPerson({ first_name: '', last_name: '', date_of_birth: '', email: '', relationship: 'employee' });
      setMessage('Person added to the roster');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add person');
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(mode: 'dry_run' | 'apply') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/employer/${sponsorId}/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, mode, enrollMode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Import failed');
      setMessage(
        `${mode === 'apply' ? 'Applied' : 'Dry-run'}: ${body.inserted_rows} insert, ${body.updated_rows} update, ${body.terminated_rows} terminate, ${body.error_rows} error`
      );
      if (mode === 'apply') router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{sponsorName}</h1>
        <p className="text-sm text-slate-600">Signed in as {role}. Roster changes take effect on the next eligibility job.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Add eligible person</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addPerson} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ee_first">First name</Label>
              <Input id="ee_first" required value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee_last">Last name</Label>
              <Input id="ee_last" required value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee_dob">Date of birth</Label>
              <Input id="ee_dob" type="date" value={person.date_of_birth} onChange={(e) => setPerson({ ...person, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee_email">Email</Label>
              <Input id="ee_email" type="email" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ee_rel">Relationship</Label>
              <select
                id="ee_rel"
                className="h-10 w-full rounded-md border px-3 text-sm"
                value={person.relationship}
                onChange={(e) => setPerson({ ...person, relationship: e.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="spouse">Spouse</option>
                <option value="child">Child</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>Add to roster</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setCsvText(await file.text());
            }}
          />
          <textarea
            className="min-h-28 w-full rounded-md border p-3 font-mono text-xs"
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
            Known roster (create members; sponsor invoice pays)
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy || !csvText.trim()} onClick={() => importCsv('dry_run')}>
              Dry-run
            </Button>
            <Button type="button" disabled={busy || !csvText.trim()} onClick={() => importCsv('apply')}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roster ({roster.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {roster.length === 0 ? (
            <p className="text-sm text-slate-500">No people yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th>DOB</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2">
                      {row.first_name} {row.last_name}
                    </td>
                    <td>{row.date_of_birth || '—'}</td>
                    <td>{row.relationship}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approvals ({approvals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {approvals.length === 0 ? (
            <p className="text-sm text-slate-500">No pending employer approvals.</p>
          ) : (
            <ul className="space-y-2">
              {approvals.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {row.name}
                    {row.email ? ` · ${row.email}` : ''}
                    {' · '}
                    {row.role}
                  </span>
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const res = await fetch(`/api/employer/${sponsorId}/approvals`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sponsorshipId: row.id, decision: 'approve' }),
                          });
                          const body = await res.json();
                          if (!res.ok) throw new Error(body.error || 'Approve failed');
                          setMessage('Enrollment approved');
                          router.refresh();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Approve failed');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const res = await fetch(`/api/employer/${sponsorId}/approvals`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sponsorshipId: row.id, decision: 'deny' }),
                          });
                          const body = await res.json();
                          if (!res.ok) throw new Error(body.error || 'Deny failed');
                          setMessage('Enrollment denied');
                          router.refresh();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Deny failed');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Deny
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No sponsor invoices yet. Your administrator generates them.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Number</th>
                  <th>Period</th>
                  <th>Due</th>
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
                    <td>{inv.due_date || '—'}</td>
                    <td>{inv.status}</td>
                    <td>${Number(inv.total ?? 0).toFixed(2)}</td>
                    <td>
                      <a
                        className="text-teal-700 underline"
                        href={`/api/employer/${sponsorId}/invoices/${inv.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Print
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
