'use client';

import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function LeadForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      firstName: String(formData.get('firstName') ?? ''),
      lastName: String(formData.get('lastName') ?? ''),
      email: String(formData.get('email') ?? ''),
      company: String(formData.get('company') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      productInterest: String(formData.get('productInterest') ?? 'both'),
      notes: String(formData.get('notes') ?? ''),
      website: String(formData.get('website') ?? ''),
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      setStatus('success');
      event.currentTarget.reset();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-8 text-center">
        <h3 className="font-heading text-lg font-semibold text-foreground">Thanks — we&rsquo;ll be in touch.</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your request landed in our queue. Expect a reply within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div
        className="pointer-events-none absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" required />
        <Field label="Last name" name="lastName" required />
      </div>
      <Field label="Work email" name="email" type="email" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" name="company" />
        <Field label="Phone" name="phone" type="tel" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/70">I&rsquo;m interested in</label>
        <select name="productInterest" defaultValue="both" className="dh-select">
          <option value="crm">CRM Core</option>
          <option value="admin">Admin Enrollment</option>
          <option value="both">Both</option>
          <option value="undecided">Just exploring</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/70">Anything we should know?</label>
        <textarea name="notes" rows={3} className="dh-textarea" />
      </div>
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="group dh-btn-island dh-btn-primary mt-1 w-full justify-between disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Request access'}
        <span className="dh-btn-ico">
          <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
        </span>
      </button>
      {status === 'error' && errorMessage && (
        <p className="text-sm text-red-500 dark:text-red-400">{errorMessage}</p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-foreground/70">
        {label}
        {required && <span className="text-cyan-600 dark:text-cyan-400"> *</span>}
      </label>
      <input id={name} name={name} type={type} required={required} className="dh-input" />
    </div>
  );
}
