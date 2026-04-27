import type { Metadata } from 'next';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import {
  IconMail,
  IconPhone,
  IconArrowRight,
  IconCheckCircle,
} from '@/components/icons';

export const metadata: Metadata = {
  title: 'Contact Sales',
  description:
    'Talk to the Double Helix team about deploying Admin and CRM for your healthcare organization.',
};

const expectations = [
  '30-minute working session, not a sales pitch',
  'Live demo against synthetic copies of your data',
  'Written deployment plan within 48 hours',
  'No procurement run-around — direct line to engineering',
];

type ContactStatus = 'ok' | 'error' | 'rate_limited' | undefined;

const intentLabels: Record<string, string> = {
  demo: 'Platform demo',
  'admin-demo': 'Admin demo',
  'crm-demo': 'CRM demo',
  pricing: 'Pricing & licensing',
  partnership: 'Partnership',
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const status = (typeof params.status === 'string' ? params.status : undefined) as ContactStatus;
  const intentParam = typeof params.intent === 'string' ? params.intent : undefined;
  const initialIntent = intentParam && intentLabels[intentParam] ? intentParam : 'demo';
  return (
    <section className="relative section">
      <div aria-hidden="true" className="aurora-soft" />
      <Container className="relative">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-helix-cyan-300" />
              Contact sales
            </p>
            <h1 className="display-1 mt-5">
              Let&apos;s see if Double Helix is the{' '}
              <span className="text-gradient-helix">right fit</span>.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-helix-mist sm:text-lg">
              Tell us about your enrollment volume, advisor structure, and any
              regulatory constraints. We&apos;ll come back with a working demo
              and a deployment plan.
            </p>

            <ul className="mt-10 space-y-3">
              {expectations.map((e) => (
                <li key={e} className="flex items-start gap-3 text-sm text-white/85">
                  <IconCheckCircle
                    size={16}
                    weight="duotone"
                    className="mt-0.5 shrink-0 text-helix-lime-400"
                  />
                  {e}
                </li>
              ))}
            </ul>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <a
                href="mailto:sales@doublehelix.com"
                className="rounded-xl glass p-4 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2 text-sm text-white">
                  <IconMail size={16} weight="duotone" className="text-helix-cyan-200" />
                  Email sales
                </div>
                <p className="mt-1 font-mono text-xs text-helix-fog">
                  sales@doublehelix.com
                </p>
              </a>
              <a
                href="tel:+18005550100"
                className="rounded-xl glass p-4 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2 text-sm text-white">
                  <IconPhone size={16} weight="duotone" className="text-helix-violet-200" />
                  Call us
                </div>
                <p className="mt-1 font-mono text-xs text-helix-fog">
                  +1 (800) 555-0100
                </p>
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            {status === 'ok' ? (
              <div
                role="status"
                className="mb-6 rounded-2xl border border-helix-lime-500/30 bg-helix-lime-500/[0.06] p-5 text-sm text-white"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-helix-lime-300">
                  Request received
                </p>
                <p className="mt-1 text-helix-mist">
                  Thanks — a Double Helix engineer will reply within one business
                  day. Check your inbox for confirmation.
                </p>
              </div>
            ) : null}
            {status === 'rate_limited' ? (
              <div
                role="alert"
                className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] p-5 text-sm text-white"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300">
                  Slow down
                </p>
                <p className="mt-1 text-helix-mist">
                  We received your request a moment ago. Please wait a few
                  minutes before submitting again.
                </p>
              </div>
            ) : null}
            {status === 'error' ? (
              <div
                role="alert"
                className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/[0.06] p-5 text-sm text-white"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose-300">
                  Something went wrong
                </p>
                <p className="mt-1 text-helix-mist">
                  We could not deliver your request. Email{' '}
                  <a
                    className="underline underline-offset-2 hover:text-white"
                    href="mailto:sales@doublehelix.com"
                  >
                    sales@doublehelix.com
                  </a>{' '}
                  and we will respond manually.
                </p>
              </div>
            ) : null}

            <form
              action="/api/contact"
              method="POST"
              className="rounded-3xl glass-strong p-8 lg:p-10"
            >
              {/* Honeypot — bots fill this; humans never see it. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
              >
                <label>
                  Do not fill this field
                  <input
                    type="text"
                    name="company_url"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>

              <input type="hidden" name="intent" defaultValue={initialIntent} />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" name="name" required />
                <Field label="Work email" name="email" type="email" required />
                <Field label="Company" name="company" required />
                <Field label="Role" name="role" />
                <Field
                  label="Approximate member count"
                  name="member_count"
                  placeholder="e.g. 12,500"
                  className="sm:col-span-2"
                />
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-[0.18em] text-helix-fog">
                    What are you trying to solve?
                  </label>
                  <textarea
                    name="message"
                    rows={5}
                    required
                    minLength={20}
                    maxLength={4000}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white placeholder:text-helix-fog focus:border-helix-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-helix-cyan-500/20"
                    placeholder="A few sentences is plenty. We will follow up to dig in."
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-helix-fog">
                  By submitting, you agree to our{' '}
                  <a className="underline-offset-2 hover:underline" href="/legal/privacy">
                    privacy policy
                  </a>
                  .
                </p>
                <Button variant="helix" size="lg">
                  Request a demo
                  <IconArrowRight size={16} weight="bold" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium uppercase tracking-[0.18em] text-helix-fog">
        {label} {required ? <span className="text-helix-cyan-300">*</span> : null}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-white placeholder:text-helix-fog focus:border-helix-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-helix-cyan-500/20"
      />
    </div>
  );
}
